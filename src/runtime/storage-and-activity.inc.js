  function fabushiOwnedStorageKey(key) {
    const value = String(key || '');
    if (!value) return false;
    if ([KEY, LEGACY_OWNER_KEY, 'fabushi-auto-confirm-queue-v3', 'fabushi-auto-confirm-queue-v2', 'fabushi-auto-confirm-runtime-v2'].includes(value)) return true;
    return [
      WORKSPACE_HEARTBEAT_KEY,
      WORKSPACE_AUTO_RECOVERY_KEY,
      'fabushi-workspace-recovery-v1:',
      TASK_TRANSFER_KEY,
      'fabushi-navigation-guard-v1:',
    ].some(prefix => value.startsWith(prefix));
  }
  function fabushiLocalStorageFootprint(excludingKey = '') {
    const excluded = String(excludingKey || '');
    let chars = 0;
    try {
      for (let index = 0; index < Number(window.localStorage.length || 0); index += 1) {
        const key = window.localStorage.key(index);
        if (!key || key === excluded || !fabushiOwnedStorageKey(key)) continue;
        if (!fabushiStorageSizeCache.has(key)) {
          const value = window.localStorage.getItem(key) || '';
          fabushiStorageSizeCache.set(key, key.length + value.length);
        }
        chars += Number(fabushiStorageSizeCache.get(key) || 0);
      }
    } catch {}
    return chars;
  }
  function storageBudgetError(projectedChars) {
    let error;
    try { error = new DOMException(`Fabushi localStorage budget exceeded (${projectedChars}/${FABUSHI_LOCAL_STORAGE_MAX_CHARS})`, 'QuotaExceededError'); }
    catch { error = new Error('Fabushi localStorage budget exceeded'); error.name = 'QuotaExceededError'; }
    return error;
  }
  function readStorageString(key) {
    const storageKey = String(key || '');
    if (volatileStorageShadow.has(storageKey)) return volatileStorageShadow.get(storageKey);
    try { return window.localStorage.getItem(storageKey); } catch { return null; }
  }
  function tryLocalStorageSet(key, value, { shadow = true } = {}) {
    const storageKey = String(key || ''), serialized = String(value ?? '');
    if (fabushiOwnedStorageKey(storageKey)) {
      const projected = fabushiLocalStorageFootprint(storageKey) + storageKey.length + serialized.length;
      if (projected > FABUSHI_LOCAL_STORAGE_MAX_CHARS) {
        const error = storageBudgetError(projected);
        if (shadow) volatileStorageShadow.set(storageKey, serialized); else volatileStorageShadow.delete(storageKey);
        return { ok:false, error, projectedChars:projected };
      }
    }
    try {
      window.localStorage.setItem(storageKey, serialized);
      volatileStorageShadow.delete(storageKey);
      if (fabushiOwnedStorageKey(storageKey)) fabushiStorageSizeCache.set(storageKey, storageKey.length + serialized.length);
      return { ok:true, error:null, projectedChars:fabushiLocalStorageFootprint() };
    } catch (error) {
      if (shadow) volatileStorageShadow.set(storageKey, serialized); else volatileStorageShadow.delete(storageKey);
      return { ok:false, error, projectedChars:fabushiLocalStorageFootprint() };
    }
  }
  function removeLocalStorageRecord(key) {
    const storageKey = String(key || '');
    volatileStorageShadow.delete(storageKey);
    fabushiStorageSizeCache.delete(storageKey);
    try { window.localStorage.removeItem(storageKey); return true; } catch { return false; }
  }
  function readSessionStorageString(key) { try { return window.sessionStorage.getItem(String(key || '')); } catch { return null; } }
  function writeSessionStorageRecord(key, value) { try { window.sessionStorage.setItem(String(key || ''), String(value ?? '')); return true; } catch { return false; } }
  function removeSessionStorageRecord(key) { try { window.sessionStorage.removeItem(String(key || '')); return true; } catch { return false; } }

  function normalizeRecentActivityRecord(record, now = Date.now()) {
    if (!record || typeof record !== 'object') return null;
    const at = Number(record.at || 0);
    const taskId = String(record.taskId || '').slice(0, 160);
    const text = String(record.text || '').slice(0, MAX_TASK_MESSAGE_TEXT);
    if (!taskId || !text || !Number.isFinite(at) || at <= 0 || now - at > TASK_MESSAGE_RETENTION_MS || at - now > 60_000) return null;
    return {
      id:String(record.id || '').slice(0, 200) || crypto.randomUUID(),
      taskId,
      ownerTabId:String(record.ownerTabId || '').slice(0, 160),
      at,
      role:String(record.role || 'status').slice(0, 40),
      text,
      phase:String(record.phase || '').slice(0, 40),
      round:Number(record.round || 0),
      state:String(record.state || '').slice(0, 40),
      url:canonicalConversationURL(record.url) || '',
    };
  }
  function trimRecentActivityRecords(records, now = Date.now()) {
    const normalized = Array.from(records || [])
      .map(record => normalizeRecentActivityRecord(record, now))
      .filter(Boolean)
      .sort((a,b) => a.at - b.at);
    const deduped = [];
    const seen = new Set();
    for (const record of normalized) {
      const key = [record.taskId,record.at,record.role,record.text].join('\u0000');
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(record);
    }
    let next = deduped.slice(-RECENT_ACTIVITY_MAX_RECORDS);
    let serialized = JSON.stringify(next);
    while (next.length > 1 && serialized.length > RECENT_ACTIVITY_MAX_CHARS) {
      next.shift();
      serialized = JSON.stringify(next);
    }
    return next;
  }
  function readRecentActivitySession(now = Date.now()) {
    let parsed = [];
    try { parsed = JSON.parse(readSessionStorageString(RECENT_ACTIVITY_SESSION_KEY) || '[]'); } catch {}
    const trimmed = trimRecentActivityRecords(parsed, now);
    if (trimmed.length !== (Array.isArray(parsed) ? parsed.length : 0)) {
      writeSessionStorageRecord(RECENT_ACTIVITY_SESSION_KEY, JSON.stringify(trimmed));
    }
    return trimmed;
  }
  function writeRecentActivitySession(records, now = Date.now()) {
    const trimmed = trimRecentActivityRecords(records, now);
    return writeSessionStorageRecord(RECENT_ACTIVITY_SESSION_KEY, JSON.stringify(trimmed)) ? trimmed : [];
  }
  function openRecentActivityDB() {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('indexeddb-unavailable'));
    if (!recentActivityDBPromise) {
      recentActivityDBPromise = new Promise((resolve, reject) => {
        let request;
        try { request = indexedDB.open(RECENT_ACTIVITY_DB, 1); } catch (error) { reject(error); return; }
        request.onupgradeneeded = () => {
          const db = request.result;
          let store;
          if (!db.objectStoreNames.contains(RECENT_ACTIVITY_STORE)) {
            store = db.createObjectStore(RECENT_ACTIVITY_STORE, { keyPath:'id' });
          } else {
            store = request.transaction.objectStore(RECENT_ACTIVITY_STORE);
          }
          if (!store.indexNames.contains('at')) store.createIndex('at','at',{unique:false});
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => db.close();
          resolve(db);
        };
        request.onerror = () => reject(request.error || new Error('recent-activity-db-open-failed'));
        request.onblocked = () => reject(new Error('recent-activity-db-blocked'));
      }).catch(error => {
        recentActivityDBPromise = null;
        throw error;
      });
    }
    return recentActivityDBPromise;
  }
  function persistRecentActivityDB(record, now = Date.now()) {
    const normalized = normalizeRecentActivityRecord(record, now);
    if (!normalized) return Promise.resolve(false);
    return openRecentActivityDB().then(db => new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = db.transaction(RECENT_ACTIVITY_STORE, 'readwrite');
        const store = transaction.objectStore(RECENT_ACTIVITY_STORE);
        const index = store.index('at');
        store.put(normalized);
        if (typeof IDBKeyRange !== 'undefined') {
          const oldCursor = index.openCursor(IDBKeyRange.upperBound(now - TASK_MESSAGE_RETENTION_MS, true));
          oldCursor.onsuccess = () => {
            const cursor = oldCursor.result;
            if (!cursor) return;
            cursor.delete();
            cursor.continue();
          };
          const recentKeys = index.getAllKeys(IDBKeyRange.lowerBound(now - TASK_MESSAGE_RETENTION_MS));
          recentKeys.onsuccess = () => {
            const keys = recentKeys.result || [];
            const overflow = Math.max(0, keys.length - RECENT_ACTIVITY_MAX_RECORDS);
            for (let indexValue = 0; indexValue < overflow; indexValue += 1) store.delete(keys[indexValue]);
          };
        }
      } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error || new Error('recent-activity-db-write-failed'));
      transaction.onabort = () => reject(transaction.error || new Error('recent-activity-db-write-aborted'));
    })).catch(() => false);
  }
  function readRecentActivityDB(now = Date.now()) {
    return openRecentActivityDB().then(db => new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = db.transaction(RECENT_ACTIVITY_STORE, 'readonly');
        const store = transaction.objectStore(RECENT_ACTIVITY_STORE);
        if (typeof IDBKeyRange !== 'undefined') {
          const request = store.index('at').getAll(IDBKeyRange.lowerBound(now - TASK_MESSAGE_RETENTION_MS));
          request.onsuccess = () => resolve(trimRecentActivityRecords(request.result || [], now));
          request.onerror = () => reject(request.error || new Error('recent-activity-db-read-failed'));
        } else {
          const request = store.getAll();
          request.onsuccess = () => resolve(trimRecentActivityRecords(request.result || [], now));
          request.onerror = () => reject(request.error || new Error('recent-activity-db-read-failed'));
        }
      } catch (error) { reject(error); return; }
    })).catch(() => []);
  }
  function recordRecentActivity(task, message, now = Date.now()) {
    if (!task || !message) return null;
    const record = normalizeRecentActivityRecord({
      id:crypto.randomUUID(),
      taskId:task.id,
      ownerTabId:task.ownerTabId,
      at:Number(message.at || now),
      role:message.role || 'status',
      text:message.text,
      phase:task.phase,
      round:task.round,
      state:task.state,
      url:task.url,
    }, now);
    if (!record) return null;
    const session = readRecentActivitySession(now);
    session.push(record);
    writeRecentActivitySession(session, now);
    void persistRecentActivityDB(record, now);
    return record;
  }
  async function restoreRecentActivityMessages(now = Date.now()) {
    const session = readRecentActivitySession(now);
    const dbRecords = await readRecentActivityDB(now);
    const records = trimRecentActivityRecords([...session, ...dbRecords], now);
    writeRecentActivitySession(records, now);
    const byTask = new Map();
    for (const record of records) {
      if (!byTask.has(record.taskId)) byTask.set(record.taskId, []);
      byTask.get(record.taskId).push(record);
    }
    for (const task of data.tasks || []) {
      const recovered = byTask.get(String(task.id || '')) || [];
      const existing = Array.isArray(task.messages) ? task.messages : [];
      const merged = [];
      const seen = new Set();
      for (const item of [...existing, ...recovered.map(record => ({at:record.at,role:record.role,text:record.text}))]) {
        const at = Number(item?.at || 0);
        const role = String(item?.role || 'status');
        const text = String(item?.text || '').slice(0, MAX_TASK_MESSAGE_TEXT);
        if (!at || !text || now - at > TASK_MESSAGE_RETENTION_MS) continue;
        const key = [at,role,text].join('\u0000');
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({at,role,text});
      }
      const snapshotAt = Number(task.handoffReplySnapshotAt || 0);
      const snapshotText = String(task.handoffReplySnapshot || '').trim();
      if (snapshotText && snapshotAt && now - snapshotAt <= TASK_MESSAGE_RETENTION_MS) {
        const snapshotMessage = {at:snapshotAt,role:'assistant',text:`刷新/切换前保留的最近工作内容\n${snapshotText.slice(0, MAX_TASK_MESSAGE_TEXT)}`};
        const key = [snapshotMessage.at,snapshotMessage.role,snapshotMessage.text].join('\u0000');
        if (!seen.has(key)) merged.push(snapshotMessage);
      }
      task.messages = merged.sort((a,b)=>a.at-b.at);
      compactTaskMessages(task);
      task.messageVersion = Math.max(Number(task.messageVersion || 0), task.messages.length);
    }
    return records.length;
  }
  function cleanupStaleFabushiStorage(now = Date.now()) {
    if (now - storageCleanupLastAt < STORAGE_CLEANUP_COOLDOWN_MS) return 0;
    storageCleanupLastAt = now;
    let keys = [];
    try {
      const limit = Math.min(Number(window.localStorage.length || 0), STORAGE_CLEANUP_SCAN_LIMIT);
      for (let index = 0; index < limit; index += 1) {
        const key = window.localStorage.key(index);
        if (key) keys.push(key);
      }
    } catch { return 0; }
    const policies = [
      [WORKSPACE_HEARTBEAT_KEY, WORKSPACE_HEARTBEAT_STALE_MS * 2],
      [WORKSPACE_AUTO_RECOVERY_KEY, NAV_TICKET_TTL_MS],
      ['fabushi-workspace-recovery-v1:', NAV_TICKET_TTL_MS],
      [TASK_TRANSFER_KEY, 60 * 1000],
      ['fabushi-navigation-guard-v1:', LOCAL_NAVIGATION_BURST_WINDOW_MS * 2],
    ];
    let removed = 0;
    for (const key of keys) {
      const policy = policies.find(([prefix]) => key.startsWith(prefix));
      if (!policy) continue;
      let record = null;
      try { record = JSON.parse(window.localStorage.getItem(key) || 'null'); } catch {}
      const at = Number(record?.at || record?.lastSeenAt || record?.lastAt || 0);
      if (!at || now - at < policy[1]) continue;
      try {
        window.localStorage.removeItem(key);
        volatileStorageShadow.delete(key);
        fabushiStorageSizeCache.delete(key);
        removed += 1;
      } catch {}
    }
    return removed;
  }
  function writeLocalStorageRecord(key, value, { critical = false, cleanupOnFailure = true } = {}) {
    let result = tryLocalStorageSet(key, value, { shadow:!critical });
    if (result.ok) return true;
    if (cleanupOnFailure && isStorageQuotaError(result.error)) {
      cleanupStaleFabushiStorage();
      result = tryLocalStorageSet(key, value, { shadow:!critical });
      if (result.ok) return true;
    }
    return false;
  }
  function overflowStorageKey(ownerTabId = activeWorkspaceStorageId) {
    const owner = String(ownerTabId || '');
    return owner ? WORKBENCH_OVERFLOW_KEY + owner : '';
  }
  function writeWorkbenchOverflowSerialized(serialized, ownerTabId = activeWorkspaceStorageId) {
    const key = overflowStorageKey(ownerTabId);
    if (!key) return false;
    return writeSessionStorageRecord(key, JSON.stringify({
      version:2,
      ownerTabId:String(ownerTabId || ''),
      at:Date.now(),
      serialized:String(serialized || ''),
    }));
  }
  function readWorkbenchOverflow(ownerTabId = activeWorkspaceStorageId) {
    const key = overflowStorageKey(ownerTabId);
    if (!key) return null;
    let record;
    try { record = JSON.parse(readSessionStorageString(key) || 'null'); } catch { record = null; }
    if (!record || ![1,2].includes(Number(record.version)) || record.ownerTabId !== String(ownerTabId || '') || typeof record.serialized !== 'string') return null;
    try {
      const state = JSON.parse(record.serialized);
      return state && Array.isArray(state.tasks) ? state : null;
    } catch { return null; }
  }
  function clearWorkbenchOverflow(ownerTabId = activeWorkspaceStorageId) {
    const key = overflowStorageKey(ownerTabId);
    if (key) removeSessionStorageRecord(key);
  }
  const read = (key, fallback) => { try { return JSON.parse(readStorageString(key)) || fallback; } catch { return fallback; } };
  const lifecycleController = typeof AbortController === 'function' ? new AbortController() : null;
  const listen = (target, type, handler, options = {}) => {
    if (lifecycleController) target.addEventListener(type, handler, { ...options, signal: lifecycleController.signal });
    else target.addEventListener(type, handler, options);
  };
  listen(window, 'storage', event => {
    const key = String(event?.key || '');
    if (!fabushiOwnedStorageKey(key)) return;
    if (event.newValue == null) fabushiStorageSizeCache.delete(key);
    else fabushiStorageSizeCache.set(key, key.length + String(event.newValue).length);
  });
  function readMemorySnapshot() {
    let memory;
    try { memory = window.performance?.memory; } catch { memory = null; }
    if (!memory) return { supported:false, source:'performance.memory', at:Date.now(), reason:'not-exposed' };
    const usedBytes = Number(memory.usedJSHeapSize);
    const totalBytes = Number(memory.totalJSHeapSize);
    const limitBytes = Number(memory.jsHeapSizeLimit);
    if (![usedBytes, totalBytes, limitBytes].every(value => Number.isFinite(value) && value >= 0)) {
      return { supported:false, source:'performance.memory', at:Date.now(), reason:'invalid-snapshot' };
    }
    const ratio = limitBytes > 0 ? usedBytes / limitBytes : 0;
    return {
      supported:true,
      source:'performance.memory',
      at:Date.now(),
      usedBytes,
      totalBytes,
      limitBytes,
      ratio:Number.isFinite(ratio) ? ratio : 0,
    };
  }
  function memoryPressureLevel(snapshot) {
    if (!snapshot?.supported) return 'unsupported';
    const used = Number(snapshot.usedBytes || 0);
    const ratio = Number(snapshot.ratio || 0);
    const ratioEligible = used >= MEMORY_DIAGNOSTIC_RATIO_MIN_BYTES;
    if (used >= MEMORY_DIAGNOSTIC_HIGH_BYTES || (ratioEligible && ratio >= MEMORY_DIAGNOSTIC_HIGH_RATIO)) return 'high';
    if (used >= MEMORY_DIAGNOSTIC_ELEVATED_BYTES || (ratioEligible && ratio >= MEMORY_DIAGNOSTIC_ELEVATED_RATIO)) return 'elevated';
    return 'normal';
  }
  function formatMemoryBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  function compactTaskMessages(task, {
    maxMessages = MAX_TASK_MESSAGES,
    maxText = MAX_TASK_MESSAGE_TEXT,
    maxChars = MAX_TASK_MESSAGE_CHARS,
    now = Date.now(),
  } = {}) {
    if (!task || !Array.isArray(task.messages) || !task.messages.length) return false;
    const original = task.messages;
    const normalized = original.map(item => {
      if (!item || typeof item !== 'object') return null;
      const at = Number(item.at || 0);
      const text = String(item.text || '');
      if (!Number.isFinite(at) || at <= 0 || now - at > TASK_MESSAGE_RETENTION_MS || at - now > 60_000 || !text) return null;
      return { ...item, at, role:String(item.role || 'status'), text:text.slice(0, maxText) };
    }).filter(Boolean);
    let next = normalized.slice(-Math.max(1, maxMessages));
    let total = 0;
    const bounded = [];
    for (let index = next.length - 1; index >= 0; index -= 1) {
      const item = next[index];
      const length = item.text.length;
      if (bounded.length && total + length > maxChars) break;
      bounded.unshift(item);
      total += length;
    }
    next = bounded;
    const changed = next.length !== original.length || next.some((item, index) => {
      const previous = original[original.length - next.length + index];
      return !previous || previous.text !== item.text || previous.at !== item.at || previous.role !== item.role;
    });
    if (changed) task.messages = next;
    return changed;
  }

  let storagePersistenceStatus = { level:'ok', at:0, attemptedChars:0, emergencyChars:0, compactedMessages:0, canonicalChars:0, footprintChars:0, trimmed:false, fallback:'' };
  function isStorageQuotaError(error) {
    if (!error) return false;
    const name = String(error.name || '');
    const code = Number(error.code || 0);
    const message = String(error.message || '');
    return name === 'QuotaExceededError'
      || name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || code === 22
      || code === 1014
      || /(?:quota|storage).*(?:exceed|full)|exceeded.*quota/i.test(message);
  }
  function storageStatusText() {
    if (storagePersistenceStatus.level === 'recovered') {
      return `本地存储已自动恢复；当前脚本占用约 ${Math.max(1, Math.round(Number(storagePersistenceStatus.footprintChars || 0) / 1024))} KB。`;
    }
    if (storagePersistenceStatus.level === 'trimmed') {
      return `本地存储已保持精简，仅保存最新运行必需状态（约 ${Math.max(1, Math.round(Number(storagePersistenceStatus.canonicalChars || 0) / 1024))} KB）。`;
    }
    if (storagePersistenceStatus.level === 'degraded' || storagePersistenceStatus.level === 'blocked') {
      const fallback = storagePersistenceStatus.fallback === 'session' ? '当前标签页应急存储' : '内存应急存储';
      return `本地持久化空间不足；已切换到${fallback}继续运行，Fabushi 不会继续扩大 localStorage。`;
    }
    return '';
  }
  function boundedDurableText(value, maxChars) {
    const text = String(value || '');
    const limit = Math.max(0, Number(maxChars) || 0);
    if (!text || !limit) return '';
    if (text.length <= limit) return text;
    const marker = '\n…[Fabushi durable latest-only]…\n';
    const available = Math.max(0, limit - marker.length);
    const head = Math.floor(available * 0.45);
    const tail = Math.max(0, available - head);
    return text.slice(0, head) + marker + text.slice(-tail);
  }
  function durableTaskSnapshot(task) {
    if (!task || typeof task !== 'object' || String(task.state || '') === 'done') return null;
    const snapshot = { ...task };
    for (const field of [
      'messages','messageVersion','history','sessionUrl','sessionUrls',
      'preview','previewSourceURL','previewPhase','previewRound',
      'prompt','transientConversationURLLast','attachmentUploadLastError',
      'navigationGuardNoticeAt','retainedComposerDraftNotedAt',
      'reasoningPresetConfirmedAt','reasoningPresetConfirmedIndex','modelPresetConfirmedAt','modelPresetConfirmedKey','recentActivitySnapshotLoggedAt',
    ]) delete snapshot[field];

    snapshot.id = String(snapshot.id || '').slice(0, 160);
    snapshot.ownerTabId = String(snapshot.ownerTabId || '').slice(0, 160);
    snapshot.goal = String(snapshot.goal || '').slice(0, 16000);
    snapshot.result = String(snapshot.result || '').slice(0, 24000);
    snapshot.next = String(snapshot.next || '').slice(0, 16000);
    snapshot.url = canonicalConversationURL(snapshot.url) || '';
    snapshot.attachments = Array.isArray(snapshot.attachments)
      ? snapshot.attachments.map(normalizeAttachmentMeta).filter(Boolean)
      : [];

    const keepPreparedPrompt = Boolean(snapshot.sendPrepared || snapshot.attempted);
    if (keepPreparedPrompt && snapshot.preparedPrompt) {
      snapshot.preparedPrompt = boundedDurableText(snapshot.preparedPrompt, DURABLE_PREPARED_PROMPT_MAX_CHARS);
    } else {
      delete snapshot.preparedPrompt;
      delete snapshot.preparedAt;
    }

    for (const field of ['lengthLimitCarry','abnormalFreshCarry','handoffReplySnapshot']) {
      if (snapshot[field]) snapshot[field] = boundedDurableText(snapshot[field], DURABLE_RECOVERY_TEXT_MAX_CHARS);
      else delete snapshot[field];
    }
    if (!snapshot.lengthLimitCarry) {
      delete snapshot.lengthLimitCarrySourceURL;
      delete snapshot.lengthLimitCarryWaitKey;
      delete snapshot.lengthLimitHopCount;
      delete snapshot.lengthLimitLastAt;
    }
    if (!snapshot.abnormalFreshCarry) {
      for (const field of ['abnormalFreshCarryAt','abnormalFreshCarryPhase','abnormalFreshCarryReason','abnormalFreshCarryRound','abnormalFreshCarrySourceKind','abnormalFreshCarrySourceURL']) delete snapshot[field];
    }
    if (!snapshot.handoffReplySnapshot) {
      for (const field of ['handoffReplySnapshotAt','handoffReplySnapshotGoalRevision','handoffReplySnapshotPhase','handoffReplySnapshotRound','handoffReplySnapshotSourceURL']) delete snapshot[field];
    }
    return snapshot;
  }
  function durableWorkbenchSnapshot(state) {
    const source = state && typeof state === 'object' ? state : {};
    const tasks = (Array.isArray(source.tasks) ? source.tasks : []).map(durableTaskSnapshot).filter(Boolean);
    const taskIds = new Set(tasks.map(task => task.id).filter(Boolean));
    const owners = new Set(tasks.map(task => task.ownerTabId).filter(Boolean));
    if (activeWorkspaceStorageId) owners.add(activeWorkspaceStorageId);

    const selectedByTab = {};
    for (const [owner, taskId] of Object.entries(source.selectedByTab || {})) {
      if (owners.has(owner) && taskIds.has(taskId)) selectedByTab[owner] = taskId;
    }
    const tabControls = {};
    for (const [owner, control] of Object.entries(source.tabControls || {})) {
      if (!owners.has(owner) || !control || typeof control !== 'object') continue;
      tabControls[owner] = {
        autoResume:control.autoResume !== false,
        lastDispatchAt:Number(control.lastDispatchAt || 0),
        controlRevision:Number(control.controlRevision || 0),
        pausedAt:Number(control.pausedAt || 0),
        globalAutoApprove:Boolean(control.globalAutoApprove),
        autoApprove:control.autoApprove !== false,
      };
    }
    const selected = taskIds.has(source.selected) ? source.selected : (selectedByTab[activeWorkspaceStorageId] || '');
    return {
      version:3,
      tasks,
      deletedTaskIds:Array.isArray(source.deletedTaskIds) ? source.deletedTaskIds.slice(-50).map(value => String(value || '').slice(0, 160)).filter(Boolean) : [],
      selected,
      selectedByTab,
      tabControls,
      defaultReasoningPreset:Number.isInteger(Number(source.defaultReasoningPreset)) && Number(source.defaultReasoningPreset) >= 0 && Number(source.defaultReasoningPreset) <= 4
        ? Number(source.defaultReasoningPreset)
        : 3,
      defaultModelPreset:normalizeModelPreset(source.defaultModelPreset),
    };
  }
  function normalizeLeanSnapshotReferences(snapshot) {
    const ids = new Set((snapshot.tasks || []).map(task => task.id).filter(Boolean));
    for (const [owner, taskId] of Object.entries(snapshot.selectedByTab || {})) {
      if (!ids.has(taskId)) delete snapshot.selectedByTab[owner];
    }
    if (snapshot.selected && !ids.has(snapshot.selected)) snapshot.selected = snapshot.selectedByTab?.[activeWorkspaceStorageId] || '';
    return snapshot;
  }
  function fitWorkbenchSnapshotToLocalBudget(snapshot, targetChars = WORKBENCH_LOCAL_STORAGE_TARGET_CHARS) {
    const lean = JSON.parse(JSON.stringify(snapshot || { tasks:[] }));
    let serialized = JSON.stringify(lean);
    if (serialized.length <= targetChars) return { snapshot:lean, serialized, trimmed:false, fits:true };

    const selectedIds = new Set(Object.values(lean.selectedByTab || {}).filter(Boolean));
    const priority = [...(lean.tasks || [])].sort((a, b) => {
      const aProtected = selectedIds.has(a.id) || a.attempted || a.sendPrepared ? 1 : 0;
      const bProtected = selectedIds.has(b.id) || b.attempted || b.sendPrepared ? 1 : 0;
      if (aProtected !== bProtected) return aProtected - bProtected;
      return Number(a.updatedAt || 0) - Number(b.updatedAt || 0);
    });
    const clearRecoveryBody = task => {
      for (const field of [
        'lengthLimitCarry','lengthLimitCarrySourceURL','lengthLimitCarryWaitKey','lengthLimitHopCount','lengthLimitLastAt',
        'abnormalFreshCarry','abnormalFreshCarryAt','abnormalFreshCarryPhase','abnormalFreshCarryReason','abnormalFreshCarryRound','abnormalFreshCarrySourceKind','abnormalFreshCarrySourceURL',
        'handoffReplySnapshot','handoffReplySnapshotAt','handoffReplySnapshotGoalRevision','handoffReplySnapshotPhase','handoffReplySnapshotRound','handoffReplySnapshotSourceURL',
      ]) delete task[field];
    };
    for (const task of priority) {
      if (selectedIds.has(task.id) || task.attempted || task.sendPrepared) continue;
      clearRecoveryBody(task);
      serialized = JSON.stringify(lean);
      if (serialized.length <= targetChars) return { snapshot:normalizeLeanSnapshotReferences(lean), serialized, trimmed:true, fits:true };
    }

    for (const stateName of ['cancelled','queued']) {
      const removable = [...(lean.tasks || [])]
        .filter(task => task.state === stateName && !selectedIds.has(task.id) && !task.attempted && !task.sendPrepared)
        .sort((a,b) => Number(a.updatedAt || 0) - Number(b.updatedAt || 0));
      for (const task of removable) {
        lean.tasks = lean.tasks.filter(item => item.id !== task.id);
        normalizeLeanSnapshotReferences(lean);
        serialized = JSON.stringify(lean);
        if (serialized.length <= targetChars) return { snapshot:lean, serialized, trimmed:true, fits:true };
      }
    }

    const currentSelected = lean.selectedByTab?.[activeWorkspaceStorageId] || '';
    const protectedIds = new Set([currentSelected, ...(lean.tasks || []).filter(task => task.attempted || task.sendPrepared).map(task => task.id)].filter(Boolean));
    const removable = [...(lean.tasks || [])]
      .filter(task => !protectedIds.has(task.id))
      .sort((a,b) => Number(a.updatedAt || 0) - Number(b.updatedAt || 0));
    for (const task of removable) {
      lean.tasks = lean.tasks.filter(item => item.id !== task.id);
      normalizeLeanSnapshotReferences(lean);
      serialized = JSON.stringify(lean);
      if (serialized.length <= targetChars) return { snapshot:lean, serialized, trimmed:true, fits:true };
    }

    for (const task of lean.tasks || []) {
      if (task.result) task.result = boundedDurableText(task.result, 12000);
      if (task.next) task.next = boundedDurableText(task.next, 8000);
      if (task.preparedPrompt) task.preparedPrompt = boundedDurableText(task.preparedPrompt, 64000);
      clearRecoveryBody(task);
    }
    serialized = JSON.stringify(normalizeLeanSnapshotReferences(lean));
    return { snapshot:lean, serialized, trimmed:true, fits:serialized.length <= targetChars };
  }
  function persistWorkbenchState(state) {
    const durable = durableWorkbenchSnapshot(state);
    const durableSerialized = JSON.stringify(durable);
    const fitted = fitWorkbenchSnapshotToLocalBudget(durable);
    const attemptedChars = durableSerialized.length;
    const needsOverflow = fitted.trimmed || !fitted.fits;
    const sessionSaved = needsOverflow ? writeWorkbenchOverflowSerialized(durableSerialized) : false;

    if (!fitted.fits) {
      volatileStorageShadow.set(KEY, durableSerialized);
      storagePersistenceStatus = {
        level:'degraded', at:Date.now(), attemptedChars, emergencyChars:fitted.serialized.length,
        compactedMessages:0, canonicalChars:0, footprintChars:fabushiLocalStorageFootprint(),
        trimmed:true, fallback:sessionSaved ? 'session' : 'memory',
      };
      return false;
    }

    let result = tryLocalStorageSet(KEY, fitted.serialized, { shadow:false });
    if (!result.ok && isStorageQuotaError(result.error)) {
      cleanupStaleFabushiStorage();
      result = tryLocalStorageSet(KEY, fitted.serialized, { shadow:false });
    }
    if (result.ok) {
      if (fitted.trimmed) volatileStorageShadow.set(KEY, durableSerialized);
      else {
        volatileStorageShadow.delete(KEY);
        clearWorkbenchOverflow();
      }
      const wasDegraded = ['blocked','degraded'].includes(storagePersistenceStatus.level);
      storagePersistenceStatus = {
        level:fitted.trimmed ? 'trimmed' : (wasDegraded ? 'recovered' : 'ok'),
        at:Date.now(), attemptedChars, emergencyChars:fitted.serialized.length,
        compactedMessages:0, canonicalChars:fitted.serialized.length,
        footprintChars:fabushiLocalStorageFootprint(), trimmed:fitted.trimmed,
        fallback:fitted.trimmed && sessionSaved ? 'session' : '',
      };
      return true;
    }

    volatileStorageShadow.set(KEY, durableSerialized);
    const fallbackSaved = sessionSaved || writeWorkbenchOverflowSerialized(durableSerialized);
    storagePersistenceStatus = {
      level:'degraded', at:Date.now(), attemptedChars, emergencyChars:fitted.serialized.length,
      compactedMessages:0, canonicalChars:0, footprintChars:fabushiLocalStorageFootprint(),
      trimmed:fitted.trimmed, fallback:fallbackSaved ? 'session' : 'memory',
    };
    return false;
  }
