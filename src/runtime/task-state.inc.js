  function haltRunnerForPause() {
    running = false;
    controller?.abort();
    clearTimeout(timer); timer = null;
    clearTimeout(navigationTimer); navigationTimer = null;
    clearTimeout(autoStartTimer); autoStartTimer = null; autoStartTaskId = '';
    navigating = false;
    sameRouteWaitUntil = 0;
    sameRouteWaitSince = 0;
    lockRelease?.(); lockRelease = null;
    removeSessionStorageRecord(NAV);
  }
  // A document can disappear because the user changed tabs, ChatGPT
  // navigated, or the script was hot-updated. That lifecycle event is not a
  // manual pause. Only the tab that actually owns the runner may stop its
  // local timers, and it must preserve resumable task states so a new
  // document can pick them up. Previously every idle ChatGPT tab called
  // pause() here and globally converted the queue to paused; clicking
  // Continue then immediately became "恢复 -> 暂停" again.
  function suspendRunnerForPagehide() {
    const activeTask = data.tasks.find(item => item.id === current && taskBelongsToTab(item))
      || data.tasks.find(item => item.id === selected && taskBelongsToTab(item));
    let snapshotChanged = false;
    try {
      if (activeTask && !terminal.has(activeTask.state) && activeTask.state !== 'paused') {
        snapshotChanged = persistHandoffReplySnapshot(activeTask, { allowExactRouteFallback:true });
      }
    } catch {}
    if (!running && !busy && !lockRelease) {
      if (snapshotChanged) save();
      return snapshotChanged;
    }
    haltRunnerForPause();
    save();
    paint();
    return true;
  }
  function mergeStoredTasks(stored) {
    const deleted = new Set([...(data.deletedTaskIds || []), ...(Array.isArray(stored?.deletedTaskIds) ? stored.deletedTaskIds : [])]);
    data.deletedTaskIds = [...deleted].slice(-200);
    if (deleted.size) {
      data.tasks = data.tasks.filter(task => !deleted.has(task.id));
      if (selected && deleted.has(selected)) selected = '';
      if (current && deleted.has(current)) current = '';
    }
    for (const remote of stored?.tasks || []) {
      if (deleted.has(remote.id)) continue;
      const local = data.tasks.find(item => item.id === remote.id);
      if (!local) { data.tasks.push(remote); continue; }
      const localRevision = Number(local.pauseRevision || 0);
      const remoteRevision = Number(remote.pauseRevision || 0);
      const remotePaused = remote.state === 'paused';
      // A newer pause/resume transition is authoritative even when an older
      // runner has a later updatedAt from a scan that raced the button click.
      if (remoteRevision > localRevision
        || (taskBelongsToTab(local) && remotePaused && data.autoResume === false && remoteRevision >= localRevision)
        || (remoteRevision >= localRevision
          && !(taskBelongsToTab(local) && local.state === 'paused' && localRevision >= remoteRevision)
          && (remote.updatedAt || 0) > (local.updatedAt || 0))) {
        Object.assign(local, remote);
      }
    }
  }
  function save() {
    const stored = read(KEY, { tasks:[] });
    const storedControl = stored.tabControls?.[tabId] || {};
    const storedRevision = Number(storedControl.controlRevision || 0);
    const localRevision = Number(data.controlRevision || 0);
    // A manual pause from another tab is a durable barrier. Do not let a
    // stale runner write autoResume=true or active task states over it.
    if (storedControl.autoResume === false && (storedRevision > localRevision
      || (storedRevision === localRevision && data.autoResume !== false))) {
      data.controlRevision = storedRevision;
      data.autoResume = false;
      data.pausedAt = Number(storedControl.pausedAt || Date.now());
      mergeStoredTasks(stored);
      for (const task of data.tasks) {
        if (!taskBelongsToTab(task)) continue;
        if (!pausableStates.has(task.state)) continue;
        task.pausedState = task.state;
        task.pauseRevision = storedRevision;
        task.state = 'paused';
      }
      haltRunnerForPause();
    } else if (storedRevision > localRevision) {
      data.controlRevision = storedRevision;
      data.autoResume = storedControl.autoResume !== false;
      data.pausedAt = Number(storedControl.pausedAt || 0);
      mergeStoredTasks(stored);
    } else {
      mergeStoredTasks(stored);
    }
    data.tabControls = { ...(data.tabControls || {}), ...(stored.tabControls || {}), [tabId]:{ ...(stored.tabControls?.[tabId] || {}), ...(data.tabControls?.[tabId] || {}) } };
    data.selectedByTab = { ...(data.selectedByTab || {}), ...(stored.selectedByTab || {}), [tabId]:selected };
    data.selected = selected;
    const persisted = persistWorkbenchState(data);
    writeWorkspaceHeartbeat();
    paint();
    return persisted;
  }
  function syncRemoteControl() {
    const stored = read(KEY, null);
    if (!stored || typeof stored !== 'object') return false;
    const storedControl = stored.tabControls?.[tabId];
    if (!storedControl) return false;
    const storedRevision = Number(storedControl.controlRevision || 0);
    const localRevision = Number(data.controlRevision || 0);
    if (storedRevision < localRevision) return false;
    if (storedControl.autoResume !== false || data.autoResume === false) return false;
    data.controlRevision = storedRevision;
    data.autoResume = false;
    data.pausedAt = Number(storedControl.pausedAt || Date.now());
    mergeStoredTasks(stored);
    for (const task of data.tasks) {
      if (!taskBelongsToTab(task)) continue;
      if (!pausableStates.has(task.state)) continue;
      task.pausedState = task.state;
      task.pauseRevision = storedRevision;
      task.state = 'paused';
    }
    haltRunnerForPause();
    paint();
    return true;
  }
  function quarantineTransientConversationBindings() {
    let recoveredTaskId = '';
    const liveURL = currentConversationURL();
    let changed = false;
    for (const task of data.tasks) {
      if (!taskBelongsToTab(task)) continue;
      const parsed = parseConversationURL(task.url);
      // WEB: has long-standing migration semantics elsewhere. This migration
      // is specifically for the newly observed post-Send local-chatgpt route.
      if (!parsed?.synthetic || !/^local-chatgpt:/i.test(String(parsed.id || ''))) continue;
      const badURL = String(task.url || parsed.href || '');
      const canBindLive = Boolean(
        liveURL
        && task.token
        && hasTaskMarker(task)
        && !conversationURLOwner(liveURL, task.id)
      );

      task.transientConversationURLLast = badURL;
      if (transientConversationURL(task.sessionUrl)) task.sessionUrl = '';
      if (Array.isArray(task.sessionUrls)) {
        task.sessionUrls = task.sessionUrls.filter(url => !transientConversationURL(url));
      }
      if (Array.isArray(task.history)) {
        task.history = task.history.filter(item => !transientConversationURL(item?.url));
      }
      if (transientConversationURL(task.recoveredFinalIdentity?.url)) clearRecoveredFinalIdentity(task);

      if (canBindLive) {
        task.url = '';
        recordConversationURL(task, liveURL);
        task.attempted = false;
        task.dispatchOriginURL = '';
        task.dispatchStartedAt = 0;
        task.recoveryConfirmationStartedAt = 0;
        resetAmbiguousSendRecovery(task);
        task.updatedAt = Date.now();
        log(task, `检测到旧版本误记录的 ChatGPT 本地临时会话链接，已丢弃该临时链接并绑定当前已确认的真实会话：${liveURL}。不会重复发送。`);
        changed = true;
        continue;
      }

      task.url = '';
      task.rendererRecoveryExhausted = false;
      task.routeRecoveryAttempts = 0;
      task.workspaceDocumentRecoveryAttempts = 0;
      task.navigationGuardRetryAt = 0;
      resetAmbiguousSendRecovery(task);

      const sentButUnbound = Boolean(task.token && Number(task.sentAt || 0) > 0 && !terminal.has(task.state));
      if (sentButUnbound) {
        task.attempted = true;
        task.dispatchOriginURL = '';
        task.dispatchStartedAt = Number(task.sentAt || 0);
        if (task.state === 'paused') {
          // Preserve the user's pause. The confirmation clock starts only
          // when they explicitly resume so a long pause can never cause an
          // immediate timeout/resend.
          task.pausedState = 'sending';
          task.recoveryConfirmationStartedAt = 0;
        } else {
          task.state = 'sending';
          task.recoveryConfirmationStartedAt = Date.now();
          recoveredTaskId ||= task.id;
        }
        task.updatedAt = Date.now();
        log(task, '检测到旧版本误记录了 ChatGPT 的 local-chatgpt 本地临时链接；已隔离该链接并恢复为“原消息已发送、等待真实会话链接确认”的状态。保留原发送标识、phase、round、目标和附件，不会导航到临时链接，也不会重复发送。');
      } else if (!terminal.has(task.state)) {
        if (task.state === 'paused') {
          task.pausedState = 'queued';
        } else {
          task.state = 'queued';
          recoveredTaskId ||= task.id;
        }
        task.attempted = false;
        task.token = '';
        task.sendPrepared = false;
        task.preparedPrompt = '';
        task.dispatchOriginURL = '';
        task.dispatchStartedAt = 0;
        task.recoveryConfirmationStartedAt = 0;
        task.updatedAt = Date.now();
        log(task, '检测到旧版本遗留的 ChatGPT 本地临时链接，但没有可继续确认的原发送标识；已丢弃临时链接并安全返回待发送状态。');
      }
      changed = true;
    }
    if (changed) save();
    return recoveredTaskId;
  }

  function restorePausedTask(task, revision = Number(data.controlRevision || 0), { global = false } = {}) {
    if (!taskBelongsToTab(task) || task.state !== 'paused') return false;
    // Only the current phase's URL is resumable. sessionUrl/sessionUrls and
    // history intentionally retain evidence from earlier rounds; using
    // those here would reopen a completed Work chat before dispatching the
    // queued planner or next Work chat.
    const knownURL = canonicalConversationURL(task.url);
    const legacyBlocked = task.pausedState === 'blocked' && legacyNavigationFailureFor(task);
    // `blocked` is a terminal display state, so restoring it verbatim makes
    // the scheduler see no active task and call pause() again immediately.
    // A blocked task with a durable URL can safely inspect that conversation;
    // one without a URL must return to the queue and receive a fresh send.
    const resumeState = legacyBlocked && knownURL
      ? 'waiting'
      : task.pausedState === 'blocked'
        ? (knownURL && (task.token || task.attempted) ? 'waiting' : 'queued')
        : (pausableStates.has(task.pausedState)
          ? task.pausedState
          : (knownURL && task.token ? 'waiting' : 'queued'));
    if (legacyBlocked && knownURL) {
      task.url = knownURL;
      task.attempted = false;
    }
    if (resumeState === 'queued') {
      // A paused task that never obtained a real conversation URL has no
      // safe send-confirmation route to resume. Drop the old click token so
      // Continue can create exactly one fresh dispatch instead of entering
      // the stale attempted-send branch forever.
      task.url = '';
      task.token = '';
      task.attempted = false;
      task.sendPrepared = false;
      task.preparedPrompt = '';
      task.dispatchOriginURL = '';
      task.dispatchStartedAt = 0;
      task.explicitRecoveryActive = false;
    }
    if (resumeState === 'sending' && task.attempted && task.token && !knownURL) {
      // A quarantined local-chatgpt route keeps the original click/token, but
      // manual pause time must not count toward the ambiguous-send timeout.
      task.recoveryConfirmationStartedAt = Date.now();
    }
    delete task.pausedState;
    task.pauseRevision = Math.max(Number(task.pauseRevision || 0) + 1, revision);
    task.state = resumeState;
    // Resume is a safety boundary: if the exact already-bound conversation is
    // currently showing an authorization surface, classify it immediately
    // before loading/final/send recovery gets another chance to run.
    const liveResumeURL = currentConversationURL();
    const resumeApprovalEligible = Boolean(
      knownURL
      && liveResumeURL
      && knownURL === liveResumeURL
      && !tabTasks().some(other => other.id !== task.id && other.token && hasTaskMarker(other))
      && !conversationURLOwner(liveResumeURL, task.id)
    );
    if (resumeApprovalEligible && cards({ wide:true }).length) task.state = 'approval';
    // A pause/resume boundary starts a fresh supervision window. Reusing the
    // pre-pause progress observation can make an already-old 15-minute stall
    // fire only seconds after the user explicitly resumes the task.
    observations.delete(task.id);
    task.abnormalNoFinalSince = 0;
    task.abnormalNoFinalSignature = '';
    if (resumableStates.has(task.state)) armWorkspaceRecoveryIdentity(task, { allowStaticFinal: !global });
    task.updatedAt = Date.now();
    log(task, legacyBlocked && knownURL
      ? '已从旧记录恢复本轮会话链接；继续按链接监控，不等待侧栏。'
      : global
        ? '已恢复全部暂停任务，继续监控并按当前目标推进。'
        : '已恢复当前任务，其他暂停任务保持暂停；正在立即检查当前会话是否已有最终回复。');
    return true;
  }
  function restorePausedTasks(revision = Number(data.controlRevision || 0)) {
    let restored = false;
    for (const task of data.tasks) {
      if (restorePausedTask(task, revision, { global:true })) restored = true;
    }
    if (restored) save();
    return restored;
  }

  function pauseTask(task, message = '已暂停当前任务；其他任务继续运行。') {
    if (!taskBelongsToTab(task) || terminal.has(task.state) || task.state === 'paused') return false;
    task.pausedState = task.state;
    task.pauseRevision = Math.max(Number(task.pauseRevision || 0), Number(data.controlRevision || 0)) + 1;
    task.state = 'paused';
    task.updatedAt = Date.now();
    log(task, message);
    // Keep the current task id until its in-flight operation reaches the next
    // check(). This lets the operation stop without aborting the whole queue;
    // the next scheduler tick will select another runnable task.
    save();
    paint();
    if (running) schedule(100);
    return true;
  }

  function cancelTask(task) {
    if (!taskBelongsToTab(task) || terminal.has(task.state)) return false;
    if (task.state !== 'paused') task.pausedState = task.state;
    clearHandoffReplySnapshot(task);
    clearAbnormalFreshCarry(task);
    clearStopObservedGeneration(task);
    task.state = 'cancelled';
    task.updatedAt = Date.now();
    log(task, '已取消当前任务；其他任务继续运行。');
    save();
    paint();
    if (running) schedule(100);
    return true;
  }
  function markTasksPaused(message = '已暂停；不会发送、导航或刷新，恢复后从当前目标继续。') {
    let changed = false;
    for (const task of data.tasks) {
      if (!taskBelongsToTab(task)) continue;
      if (!pausableStates.has(task.state)) continue;
      task.pausedState = task.state;
      task.pauseRevision = Number(data.controlRevision || 0);
      task.state = 'paused';
      log(task, message);
      changed = true;
    }
    if (changed) save();
    return changed;
  }
  function migratePersistedPause() {
    if (data.autoResume !== false) return false;
    return markTasksPaused('已暂停；沿用上次暂停设置，不会发送、导航或刷新。');
  }
  function log(task, message, role = 'status') {
    if (!task) return;
    task.messages ||= [];
    if (role === 'status' && task.messages.at(-1)?.text === message) return;
    const entry = { at: Date.now(), role, text: String(message).slice(0, MAX_TASK_MESSAGE_TEXT) };
    task.messages.push(entry);
    recordRecentActivity(task, entry, entry.at);
    compactTaskMessages(task, { now:entry.at });
    task.messageVersion = Number(task.messageVersion || 0) + 1;
    task.updatedAt = entry.at;
    save();
  }
  function state(task, value, message) {
    if (value === 'blocked' && data.autoResume !== false) {
      const reason = message || statusNames[value];
      if (task.state !== 'blocked') { task.state = 'blocked'; log(task, reason); }
      queueBlockedFreshRetry(task, reason);
      return;
    }
    if (task.state !== value) { task.state = value; log(task, message || statusNames[value]); }
  }
  function legacyNavigationFailureFor(task) {
    const messages = Array.isArray(task?.messages) ? task.messages.slice(-12) : [];
    return messages.some(item => /会话切换未确认|上次发送结果未确认|目标会话链接尚未出现在侧栏|正在确认会话切换|自动切换到新会话|navigation retry|sidebar.*conversation/i.test(String(item?.text || '')));
  }
  function recoverLegacyNavigationFailures() {
    const recovered = [];
    for (const task of data.tasks) {
      if (!taskBelongsToTab(task)) continue;
      // Migrate navigation/send errors emitted by older builds, including the
      // sidebar-wait wording. A normal in-flight task must keep its URL and
      // ownership token across ChatGPT document reloads, and a rate-limited
      // task must keep waiting instead of being converted into a fresh
      // dispatch.
      const legacyNavigationFailure = legacyNavigationFailureFor(task);
      // This migration is only for tasks that an older build had already
      // stopped as blocked. A transient navigation warning can be the newest
      // log while the same conversation is still generating; redispatching
      // that task would create a second concurrent ChatGPT conversation.
      if (task.state !== 'blocked' || !legacyNavigationFailure) continue;
      const liveURL = currentConversationURL();
      if (task.token && liveURL && hasTaskMarker(task)) captureConversationURL(task, liveURL);
      // Do not resurrect a historical URL after Work has advanced to a
      // queued planner/next round. Only task.url identifies the live phase.
      const knownURL = canonicalConversationURL(task.url);
      if (knownURL) {
        // A real /c/<id> URL is the conversation's durable identity. Keep it
        // and resume inspection directly; never discard it just because the
        // sidebar did not expose an anchor at that moment.
        task.url = knownURL;
        task.state = 'waiting';
        task.attempted = false;
        task.updatedAt = Date.now();
        recovered.push(task);
        continue;
      }
      // Synthetic WEB: handles from old devspace builds are not browser
      // conversation URLs. Without a real URL there is nothing safe to
      // navigate to, so return the task to dispatch instead of retrying a
      // missing sidebar link.
      task.state = 'queued';
      task.url = '';
      task.attempted = false;
      task.token = '';
      task.updatedAt = Date.now();
      recovered.push(task);
    }
    if (!recovered.length) return '';
    for (const task of recovered) log(task, task.url
      ? '已保留本轮会话链接；下一次检查直接按唯一链接恢复，不等待侧栏。'
      : '旧任务没有可用的真实会话链接；已回到派发队列，不会等待侧栏或重复刷新。');
    save();
    return recovered[0].id;
  }
  function recoverLegacyExhaustedNoFinalReplies() {
    if (data.autoResume === false) return '';
    const recovered = [];
    for (const task of data.tasks) {
      if (!taskBelongsToTab(task) || !['blocked', 'paused'].includes(task.state)) continue;
      if (task.state === 'paused' && task.pausedState !== 'blocked') continue;
      const messages = Array.isArray(task.messages) ? task.messages.slice(-16) : [];
      const exhausted = messages.some(item => /会话已结束但没有最终回复[\s\S]*自动重发次数已用尽|自动重发次数已用尽[\s\S]*会话已结束但没有最终回复/i.test(String(item?.text || '')));
      if (!exhausted) continue;
      const knownURL = canonicalConversationURL(task.url);
      // The old path always retained the live conversation URL before it
      // stopped. If no URL exists, the send result is ambiguous and must stay
      // fail-closed rather than creating a duplicate conversation.
      if (!knownURL) continue;
      task.url = knownURL;
      task.attempted = false;
      task.noFinalReplyAttempts = Math.max(Number(task.noFinalReplyAttempts || 0), NO_FINAL_REPLY_RETRY_LIMIT);
      task.noFinalReplyRecoveryUntil = 0;
      task.state = 'waiting';
      delete task.pausedState;
      task.updatedAt = Date.now();
      recovered.push(task);
    }
    if (!recovered.length) return '';
    for (const task of recovered) log(task, '已识别旧版本“异常重发次数用尽”记录；恢复为持续延迟恢复，下一次检查将自动继续，不会自动暂停。');
    save();
    return recovered[0].id;
  }
  function recoverLegacyAttachmentUploadTimeouts() {
    if (data.autoResume === false) return '';
    const recovered = [];
    for (const task of data.tasks) {
      if (!taskBelongsToTab(task) || !taskAttachments(task).length) continue;
      if (!['blocked', 'paused'].includes(task.state)) continue;
      if (task.state === 'paused' && task.pausedState !== 'blocked') continue;
      if (task.attempted || canonicalConversationURL(task.url)) continue;
      const messages = Array.isArray(task.messages) ? task.messages.slice(-16) : [];
      const timedOut = messages.some(item => /附件上传未确认[\s\S]*等待 ChatGPT 显示附件已超过\s*45\s*秒/i.test(String(item?.text || '')));
      if (!timedOut) continue;
      clearDispatchIntent(task);
      delete task.pausedState;
      task.state = 'queued';
      task.updatedAt = Date.now();
      recovered.push(task);
    }
    if (!recovered.length) return '';
    for (const task of recovered) log(task, '已识别上一版本附件等待超时记录；页面加载完成后自动重新上传，不会发送无附件的纯文字。');
    save();
    return recovered[0].id;
  }
  function check(signal = controller?.signal) {
    const activeTask = data.tasks.find(task => task.id === current && taskBelongsToTab(task));
    if (!running || data.autoResume === false || signal?.aborted || activeTask?.state === 'paused' || activeTask?.state === 'cancelled') throw new Error('已暂停');
  }
  function delay(ms, signal = controller?.signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('已暂停'));
      const abort = () => { clearTimeout(handle); reject(new Error('已暂停')); };
      const handle = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
