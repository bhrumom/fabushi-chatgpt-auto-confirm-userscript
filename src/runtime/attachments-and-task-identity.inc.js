  function attachmentKind(file) {
    const type = String(file?.type || '').trim().toLocaleLowerCase();
    const name = String(file?.name || '').trim().toLocaleLowerCase();
    if (type.startsWith('image/') || /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(name)) return 'image';
    if (type.startsWith('video/') || /\.(?:avi|m4v|mkv|mov|mp4|mpeg|webm|wmv)$/i.test(name)) return 'video';
    return '';
  }
  function openAttachmentDB() {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('当前浏览器不支持本地附件存储。'));
    if (!attachmentDBPromise) {
      attachmentDBPromise = new Promise((resolve, reject) => {
        let request;
        try { request = indexedDB.open(ATTACHMENT_DB, 1); } catch (error) { reject(error); return; }
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) db.createObjectStore(ATTACHMENT_STORE, { keyPath:'id' });
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => db.close();
          resolve(db);
        };
        request.onerror = () => reject(request.error || new Error('无法打开本地附件存储。'));
        request.onblocked = () => reject(new Error('本地附件存储正被旧页面占用，请刷新 ChatGPT 页面后重试。'));
      }).catch(error => {
        attachmentDBPromise = null;
        throw error;
      });
    }
    return attachmentDBPromise;
  }
  function storeTaskAttachmentFiles(task, files, metas = taskAttachments(task)) {
    const source = Array.from(files || []);
    if (!source.length) return Promise.resolve();
    const normalized = metas.map(normalizeAttachmentMeta).filter(Boolean);
    if (!task?.id || normalized.length !== source.length) return Promise.reject(new Error('附件元数据与文件数量不一致。'));
    return openAttachmentDB().then(db => new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = db.transaction(ATTACHMENT_STORE, 'readwrite');
        const store = transaction.objectStore(ATTACHMENT_STORE);
        source.forEach((file, index) => {
          const meta = normalized[index];
          store.put({
            id: meta.id,
            taskId: task.id,
            file,
            name: meta.name,
            type: meta.type,
            size: meta.size,
            lastModified: meta.lastModified,
          });
        });
      } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('附件无法保存到本地存储。'));
      transaction.onabort = () => reject(transaction.error || new Error('附件保存事务已中止。'));
    }));
  }
  function readTaskAttachmentFile(meta) {
    const normalized = normalizeAttachmentMeta(meta);
    if (!normalized) return Promise.reject(new Error('附件记录缺少文件名。'));
    return openAttachmentDB().then(db => new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = db.transaction(ATTACHMENT_STORE, 'readonly');
        const request = transaction.objectStore(ATTACHMENT_STORE).get(normalized.id);
        request.onsuccess = () => {
          const record = request.result;
          if (!record?.file) { reject(new Error(`本地附件“${normalized.name}”已不存在，请重新选择。`)); return; }
          let file = record.file;
          if (typeof File === 'function' && !(file instanceof File)) {
            try { file = new File([file], normalized.name, { type:normalized.type || file.type || '', lastModified:normalized.lastModified || Date.now() }); } catch {}
          }
          resolve(file);
        };
        request.onerror = () => reject(request.error || new Error(`无法读取本地附件“${normalized.name}”。`));
      } catch (error) { reject(error); return; }
      transaction.onerror = () => reject(transaction.error || new Error(`无法读取本地附件“${normalized.name}”。`));
    }));
  }
  function loadTaskAttachmentFiles(task) {
    const attachments = taskAttachments(task);
    return Promise.all(attachments.map(meta => readTaskAttachmentFile(meta)));
  }
  function deleteTaskAttachmentBlobs(task) {
    const attachments = taskAttachments(task);
    if (!attachments.length || typeof indexedDB === 'undefined') return Promise.resolve();
    return openAttachmentDB().then(db => new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = db.transaction(ATTACHMENT_STORE, 'readwrite');
        const store = transaction.objectStore(ATTACHMENT_STORE);
        attachments.forEach(meta => store.delete(String(meta.id)));
      } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('附件本体删除失败。'));
      transaction.onabort = () => reject(transaction.error || new Error('附件删除事务已中止。'));
    }));
  }
  const taskBelongsToTab = task => Boolean(task && (task.ownerTabId === tabId || (!task.ownerTabId && legacyOwner === tabId)));
  const tabTasks = () => data.tasks.filter(taskBelongsToTab);
  function taskCanBeRecoveredByHost(task) {
    return Boolean(task && (
      AUTO_RECOVERABLE_STATE_NAMES.has(String(task.state || ''))
      || task.state === 'blocked'
    ));
  }
  function heartbeatTask() {
    const active = tabTasks().filter(taskCanBeRecoveredByHost);
    return active.find(task => task.id === current) || active[0] || null;
  }
  function clearAutomaticRecoveryTicket() {
    const key = WORKSPACE_AUTO_RECOVERY_KEY + tabId;
    const ticket = read(key, null);
    if (ticket?.token) removeLocalStorageRecord(RECOVERY_KEY + ticket.token);
    removeLocalStorageRecord(key);
  }
  function ensureAutomaticRecoveryTicket(task, { force = false, destination = '' } = {}) {
    if (!task || data.autoResume === false) return null;
    const key = WORKSPACE_AUTO_RECOVERY_KEY + tabId;
    const targetURL = canonicalConversationURL(task.url) || `${location.origin}/`;
    const destinationURL = destination || targetURL;
    const previous = read(key, null);
    if (!force && previous?.token && previous.taskId === task.id
      && previous.targetURL === targetURL && previous.destinationURL === destinationURL
      && Date.now() - Number(previous.at || 0) < NAV_TICKET_TTL_MS
      && read(RECOVERY_KEY + previous.token, null)) {
      return previous;
    }
    if (previous?.token) removeLocalStorageRecord(RECOVERY_KEY + previous.token);
    const token = id();
    const at = Date.now();
    const ticket = {
      ownerTabId: tabId,
      taskId: task.id,
      targetURL,
      destinationURL,
      token,
      at,
      auto: true,
      recoveryURL: `${destinationURL}#fabushi-resume=${encodeURIComponent(token)}`,
    };
    const recoveryPersisted = writeLocalStorageRecord(RECOVERY_KEY + token, JSON.stringify({
      ownerTabId: tabId, taskId: task.id, url: targetURL, at, auto: true,
    }), { critical:true });
    const ticketPersisted = recoveryPersisted && writeLocalStorageRecord(key, JSON.stringify(ticket), { critical:true });
    if (!recoveryPersisted || !ticketPersisted) {
      if (recoveryPersisted) removeLocalStorageRecord(RECOVERY_KEY + token);
      if (ticketPersisted) removeLocalStorageRecord(key);
      return null;
    }
    return ticket;
  }
  function writeWorkspaceHeartbeat(lifecycle = '') {
    try {
      const tasks=tabTasks(), active=heartbeatTask(), paused=tasks.find(task=>task.state==='paused')||null, now=Date.now();
      if(data.autoResume===false || !active){
        clearAutomaticRecoveryTicket(); releaseHostRecoveryCapability();
        return writeLocalStorageRecord(WORKSPACE_HEARTBEAT_KEY+tabId,JSON.stringify({ownerTabId:tabId,at:now,autoResume:data.autoResume!==false,running:false,lifecycle:lifecycle||(data.autoResume===false?'paused':'idle'),taskId:paused?.id||'',taskState:paused?.state||'',taskURL:canonicalConversationURL(paused?.url)||''}));
      }
      const ticket=ensureAutomaticRecoveryTicket(active);
      const heartbeat={ownerTabId:tabId,at:now,autoResume:true,running:Boolean(running),lifecycle:lifecycle||(running?'running':'handoff'),taskId:active.id,taskState:active.state,taskURL:canonicalConversationURL(active.url)||'',token:String(active.token||''),attempted:Boolean(active.attempted),rendererRecoveryExhausted:Boolean(active.rendererRecoveryExhausted),attachmentUploadPending:Boolean(active.attachmentUploadPending),phase:String(active.phase||'work'),round:Number(active.round||0),recoveryToken:ticket?.token||'',recoveryURL:ticket?.recoveryURL||'',attachmentIds:taskAttachments(active).map(meta=>String(meta.id||'')).filter(Boolean),hostRecoveryGranted:hostRecoveryGranted(now),hostRecoveryExpiresAt:Number(hostRecoveryCapability.expiresAt||0)};
      const persisted=writeLocalStorageRecord(WORKSPACE_HEARTBEAT_KEY+tabId,JSON.stringify(heartbeat));
      requestHostRecoveryCapability(heartbeat); return persisted;
    } catch { return false; }
  }
  let workspaceHeartbeatStopped = false;
  function scheduleWorkspaceHeartbeat(delayMs = WORKSPACE_HEARTBEAT_INTERVAL_MS, { resume = true } = {}) {
    if (resume) workspaceHeartbeatStopped = false;
    clearTimeout(workspaceHeartbeatTimer);
    workspaceHeartbeatTimer = setTimeout(() => {
      workspaceHeartbeatTimer = null;
      try { writeWorkspaceHeartbeat(); }
      finally { if (!workspaceHeartbeatStopped) scheduleWorkspaceHeartbeat(WORKSPACE_HEARTBEAT_INTERVAL_MS, { resume:false }); }
    }, Math.max(1000, Number(delayMs) || WORKSPACE_HEARTBEAT_INTERVAL_MS));
  }
  function stopWorkspaceHeartbeat(lifecycle = 'shutdown') {
    workspaceHeartbeatStopped = true; clearTimeout(workspaceHeartbeatTimer); workspaceHeartbeatTimer = null; writeWorkspaceHeartbeat(lifecycle);
  }
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  function textTail(node, maxChars = STREAM_TEXT_TAIL_LIMIT) {
    if (!node || !Number.isFinite(Number(maxChars)) || Number(maxChars) <= 0) return '';
    const limit = Math.max(1, Math.floor(Number(maxChars)));
    const stack = [node], chunks = [];
    let length = 0;
    // Walk the DOM from the end and stop as soon as the bounded suffix is
    // collected. Reading node.textContent first would materialize the entire
    // growing response on every supervision tick.
    while (stack.length && length < limit) {
      const current = stack.pop();
      if (current.nodeType === Node.TEXT_NODE) {
        const value = String(current.nodeValue || '');
        if (!value) continue;
        const take = Math.min(value.length, limit - length);
        chunks.push(value.slice(-take));
        length += take;
        continue;
      }
      for (let child = current.firstChild; child; child = child.nextSibling) stack.push(child);
    }
    return chunks.reverse().join('');
  }
  function hasTextNode(node) {
    if (!node) return false;
    const stack = [node];
    while (stack.length) {
      const current = stack.pop();
      if (current.nodeType === Node.TEXT_NODE) {
        if (String(current.nodeValue || '').trim()) return true;
        continue;
      }
      for (let child = current.firstChild; child; child = child.nextSibling) stack.push(child);
    }
    return false;
  }
  function transientConversationId(value) {
    const conversationId = String(value || '').trim();
    // ChatGPT can expose local-chatgpt:<uuid> immediately after Send while
    // the server conversation is still being created. Like the older WEB:
    // pseudo route, this is renderer-local state and must never become a
    // durable task identity or recovery destination.
    return /^(?:WEB:|local-chatgpt:)/i.test(conversationId);
  }
  function parseConversationURL(value) {
    let target;
    try { target = new URL(value, location.origin); } catch { return null; }
    if (target.origin !== location.origin) return null;
    const match = target.pathname.match(/^\/c\/([^/?#]+)$/);
    if (!match) return null;
    let conversationId = match[1];
    try { conversationId = decodeURIComponent(conversationId); } catch {}
    if (!conversationId || /^(?:undefined|null)$/i.test(conversationId)) return null;
    return {
      id: conversationId,
      synthetic: transientConversationId(conversationId),
      href: `${target.origin}${target.pathname}`,
      pathname: target.pathname,
    };
  }
  function canonicalConversationURL(value) {
    const parsed = parseConversationURL(value);
    return parsed && !parsed.synthetic ? parsed.href : '';
  }
  function transientConversationURL(value) {
    return Boolean(parseConversationURL(value)?.synthetic);
  }
  function currentConversationURL() { return canonicalConversationURL(location.href); }
  function taskMarkerUser(task) {
    if (!task?.token) return null;
    const marker = `[Fabushi:${task.token}]`;
    return conversationRoleNodes('user').slice().reverse()
      .find(node => text(node).includes(marker)) || null;
  }
  function recoveryUserBoundaryKey(node) {
    if (!node) return '';
    const direct = [
      node.getAttribute?.('data-message-id'),
      node.getAttribute?.('data-turn-key'),
      node.getAttribute?.('data-content-search-turn-key'),
      node.closest?.('[data-message-id]')?.getAttribute?.('data-message-id'),
      node.closest?.('[data-turn-key]')?.getAttribute?.('data-turn-key'),
      node.closest?.('[data-content-search-turn-key]')?.getAttribute?.('data-content-search-turn-key'),
    ].filter(Boolean).join('|');
    if (direct) return `id:${direct}`;
    const value = normalize(text(node));
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `text:${(hash >>> 0).toString(16)}:${value.length}`;
  }
  function assistantResponseBoundaryKey(turn) {
    if (!turn) return '';
    const responseTurn = turn.responseTurn
      || turn.article?.closest?.('[data-content-search-turn-key],[data-turn-key],[data-testid^="conversation-turn-"]')
      || null;
    const stableTurnKey = responseTurn?.getAttribute?.('data-content-search-turn-key')
      || responseTurn?.getAttribute?.('data-turn-key')
      || '';
    if (stableTurnKey) return `turn:${stableTurnKey}`;

    const article = turn.article || null;
    const candidates = [
      article,
      article?.closest?.('[data-content-search-unit-key],[data-chatgpt-search-unit-key]'),
      article?.querySelector?.('[data-message-id],[data-chatgpt-selection-message-id],[data-content-search-unit-key],[data-chatgpt-search-unit-key]'),
      responseTurn,
    ].filter(Boolean);
    for (const node of candidates) {
      const messageId = node.getAttribute?.('data-message-id')
        || node.getAttribute?.('data-chatgpt-selection-message-id')
        || '';
      if (messageId) return `message:${messageId}`;
      const unitKey = node.getAttribute?.('data-content-search-unit-key')
        || node.getAttribute?.('data-chatgpt-search-unit-key')
        || '';
      if (unitKey) return `unit:${unitKey}`;
      const messageIds = node.getAttribute?.('data-chatgpt-search-message-ids') || '';
      if (messageIds) return `messages:${messageIds}`;
    }
    return '';
  }
  function hasTaskMarker(task) {
    return Boolean(taskMarkerUser(task));
  }
  function recordedConversationURL(task) {
    // Only the current-generation binding is resumable. sessionUrls/history
    // are audit history across prior rounds/handoffs and must never be silently
    // promoted when the current binding is absent or transient.
    return canonicalConversationURL(task?.url)
      || canonicalConversationURL(task?.sessionUrl)
      || '';
  }
  function recordConversationURL(task, value) {
    if (!task) return '';
    const canonical = canonicalConversationURL(value);
    if (!canonical) return '';
    task.url = canonical;
    task.sessionUrl = canonical;
    const urls = Array.isArray(task.sessionUrls)
      ? task.sessionUrls.map(canonicalConversationURL).filter(Boolean)
      : [];
    if (!urls.includes(canonical)) urls.push(canonical);
    task.sessionUrls = urls.slice(-40);
    return canonical;
  }
  function armRecoveredFinalIdentity(task, { allowStaticFinal } = {}) {
    const url = canonicalConversationURL(task?.url);
    const token = String(task?.token || '');
    if (!task || !url || !token) return false;
    // Manual recovery is a task-level capability, not a document-lifetime
    // flag. Script/page reloads may re-arm the identity, but they must not
    // silently downgrade an explicitly recovered task back to marker-only
    // ownership. Fresh dispatch/finish clears explicitRecoveryActive.
    const allowRecoveredStatic = Boolean(allowStaticFinal || task.explicitRecoveryActive);
    if (allowRecoveredStatic) task.explicitRecoveryActive = true;
    const latestMountedUser = conversationRoleNodes('user').at(-1) || null;
    task.recoveredFinalIdentity = {
      url,
      token,
      phase:String(task.phase || 'work'),
      round:Number(task.round || 0),
      goalRevision:Number(task.goalRevision || 0),
      // Automatic recovery may accept only the existing strong final toolbar,
      // but it still needs a stable message boundary when the hidden Fabushi
      // marker was virtualized or never mounted. Snapshot that boundary for
      // every recovery identity; allowStaticFinal remains manual-only.
      visibleUserBoundaryKey:recoveryUserBoundaryKey(latestMountedUser),
      ...(allowRecoveredStatic ? {
        allowStaticFinal:true,
      } : {}),
    };
    return true;
  }
  function clearRecoveredFinalIdentity(task) {
    if (task?.recoveredFinalIdentity) delete task.recoveredFinalIdentity;
  }
  function armWorkspaceRecoveryIdentity(task, options = {}) {
    if (!task || !taskBelongsToTab(task) || !resumableStates.has(task.state)) return false;
    if (!canonicalConversationURL(task.url) || !String(task.token || '')) return false;
    return armRecoveredFinalIdentity(task, options);
  }
  function recoveredFinalIdentityMatches(task, liveURL) {
    const identity = task?.recoveredFinalIdentity;
    const canonical = canonicalConversationURL(liveURL);
    return Boolean(identity
      && canonical
      && canonicalConversationURL(identity.url) === canonical
      && String(identity.token || '') === String(task.token || '')
      && String(identity.phase || '') === String(task.phase || 'work')
      && Number(identity.round || 0) === Number(task.round || 0)
      && Number(identity.goalRevision || 0) === Number(task.goalRevision || 0));
  }
  function conversationURLOwner(value, exceptTaskId = '') {
    const canonical = canonicalConversationURL(value);
    if (!canonical) return null;
    return data.tasks.find(item => item?.id !== exceptTaskId
      && canonicalConversationURL(item?.url) === canonical) || null;
  }
  // A newly dispatched turn may briefly expose a stale /c/<id> route while the
  // ChatGPT SPA is switching documents. Never bind that route to a new task
  // until the task's own marker is visible, and never steal a URL already
  // owned by another task.
  function captureConversationURL(task, value, { explicit = false } = {}) {
    const canonical = canonicalConversationURL(value);
    const origin = canonicalConversationURL(task?.dispatchOriginURL);
    if (!canonical || (!explicit && canonical === origin) || conversationURLOwner(canonical, task?.id)) return '';
    if (task?.attempted && (task.sessionUrls || []).some(url => canonicalConversationURL(url) === canonical)) return '';
    return recordConversationURL(task, canonical);
  }
  function adoptUnboundAttemptedConversation(task, { explicit = false } = {}) {
    if (!task?.attempted || !task.token) return '';
    const liveURL = currentConversationURL();
    if (!liveURL) return '';
    const origin = canonicalConversationURL(task.dispatchOriginURL);
    // A normal background scan must not mistake the route that was already on
    // screen before the send for the new conversation. The recovery button is
    // an explicit user choice, however: when the task has no bound URL and the
    // user is looking at this one unique route, binding it is the only safe way
    // to resume the original send without dispatching a duplicate.
    if (!explicit && origin && origin === liveURL) return '';
    if (conversationURLOwner(liveURL, task.id)) return '';
    // An unmarked URL can only be adopted when there is exactly one ambiguous
    // send in this workspace. This is the recovery path for a renderer that
    // accepted the click but never painted the user's marker; it cannot guess
    // between two concurrent sends or reclaim an older task's URL.
    const otherAmbiguous = tabTasks().filter(item => item.id !== task.id
      && item.attempted && item.token && !canonicalConversationURL(item.url));
    const marked = hasTaskMarker(task);
    const confirmationStartedAt = Number(task.recoveryConfirmationStartedAt || task.sentAt || 0);
    const agedEnough = confirmationStartedAt > 0
      && Date.now() - confirmationStartedAt >= SEND_CONFIRM_TIMEOUT_MS;
    if (!marked && (otherAmbiguous.length || (!explicit && !agedEnough))) return '';
    return captureConversationURL(task, liveURL, { explicit });
  }
  function taskMatchesCurrentConversation(task) {
    const currentURL = currentConversationURL();
    const taskURL = canonicalConversationURL(task?.url);
    return Boolean(currentURL && taskURL && currentURL === taskURL);
  }
  function taskHoldsScheduler(task) {
    // Sends, ambiguous send confirmations, and approval menus are exclusive
    // to the current route. A waiting/generating/reviewing task with a real
    // URL can be inspected again after the rotation interval while other
    // conversations continue independently on the server.
    return Boolean(task && !terminal.has(task.state) && task.state !== 'paused'
      && (!task.url || task.attempted || ['sending', 'uploading', 'loading', 'approval'].includes(task.state)));
  }
  function taskDeferredUntil(task, now = Date.now()) {
    if (!task || terminal.has(task.state) || task.state === 'paused') return Number.POSITIVE_INFINITY;
    const deadlines = [
      Number(task.cooldownUntil || 0),
      Number(task.noFinalReplyRecoveryUntil || 0),
    ];
    const navigationRetryAt = Number(task.navigationGuardRetryAt || 0);
    if (navigationRetryAt > now && !taskMatchesCurrentConversation(task)) deadlines.push(navigationRetryAt);
    const attachmentRetryAt = Number(task.attachmentUploadRetryAt || 0);
    if (!task.url && task.attachmentUploadFailed && attachmentRetryAt > now) deadlines.push(attachmentRetryAt);
    if (!task.url && !task.attempted && !task.connectionInterruptedFreshDispatch && !task.immediateFreshDispatch) {
      const dispatchWait = dispatchCooldownRemaining(now);
      if (dispatchWait > 0) deadlines.push(now + dispatchWait);
    }
    return Math.max(now, ...deadlines.filter(value => Number.isFinite(value) && value > 0));
  }
  function nextSupervisionTask(active, now = Date.now()) {
    if (!active.length) return null;
    const runnable = active.filter(item => taskDeferredUntil(item, now) <= now);
    if (!runnable.length) return null;
    const focused = runnable.find(item => item.id === current);
    const canRotate = runnable.length > 1 && focused && !taskHoldsScheduler(focused)
      && now - lastSwitch >= SUPERVISION_INTERVAL_MS;
    if (focused && !canRotate) return focused;
    const currentIndex = active.findIndex(item => item.id === current);
    for (let offset = 1; offset <= active.length; offset++) {
      const candidate = active[(currentIndex + offset + active.length) % active.length];
      if (runnable.includes(candidate)) return candidate;
    }
    return runnable[0];
  }
