  function schedule(ms = 2000) {
    clearTimeout(timer);
    if (running && !navigating) timer = setTimeout(tick, ms);
  }
  async function tick() {
    if (!running || busy) return;
    if (syncRemoteControl()) return;
    busy = true;
    const signal = controller.signal;
    let nextScheduleMs = VISIBLE_SCAN_INTERVAL_MS;
    let task;
    try {
      const active = tabTasks().filter(item => !terminal.has(item.state) && item.state !== 'paused');
      // No active work means the runner is idle, not that every task should be
      // rewritten as manually paused. In particular, a terminal error from an
      // older build must remain visible as "需要处理" instead of being
      // silently changed to "已暂停" on the next scan.
      if (!active.length) { haltRunnerForPause(); paint(); return; }
      const focused = active.find(item => item.id === current);
      task = nextSupervisionTask(active);
      if (!task) {
        nextScheduleMs = nextTaskWakeDelay(active);
        return;
      }
      // Keep a queued send, an ambiguous send confirmation, or an approval
      // card on the foreground route. Once a task has a durable conversation
      // URL and is merely waiting/generating/reviewing, rotate to the next
      // active task after the supervision interval.
      if (!focused || focused.id !== task.id) {
        if (current !== task.id) measurements.switches++;
        current = task.id; lastSwitch = Date.now(); paint();
      }
      if (task.cooldownUntil) {
        const remaining = task.cooldownUntil - Date.now();
        if (remaining > 0) {
          nextScheduleMs = remaining;
          return;
        }
        task.cooldownUntil = 0;
        log(task, '休息等待结束，插件恢复自动检查；不会手动刷新页面。');
        save();
      }
      if (task.navigationGuardRetryAt && (task.navigationGuardRetryAt <= Date.now() || taskMatchesCurrentConversation(task))) {
        task.navigationGuardRetryAt = 0;
        task.updatedAt = Date.now();
        save();
      }
      const recoveryUntil = Number(task.noFinalReplyRecoveryUntil || 0);
      if (recoveryUntil > Date.now()) {
        nextScheduleMs = Math.max(1000, recoveryUntil - Date.now());
        if (task.state !== 'waiting') {
          task.state = 'waiting';
          log(task, `异常会话延迟恢复中，约 ${Math.ceil((recoveryUntil - Date.now()) / 60000)} 分钟后自动新开会话；不会自动暂停。`);
        }
        return;
      }
      if (task.noFinalReplyRecoveryUntil) {
        task.noFinalReplyRecoveryUntil = 0;
        task.updatedAt = Date.now();
        log(task, '异常会话延迟恢复等待结束，插件继续自动新开会话。');
        save();
      }
      if (task.attempted) {
        const liveURL = currentConversationURL();
        // A matching URL without the task marker is not enough to confirm a
        // fresh send: it may simply be the previous task's conversation left
        // on screen during an SPA transition. Confirm ownership first, then
        // persist the URL.
        if (liveURL && task.token && hasTaskMarker(task)) {
          const captured = task.url === liveURL ? liveURL : captureConversationURL(task, liveURL);
          if (!captured) return;
          task.attempted = false;
          task.dispatchOriginURL = '';
          task.dispatchStartedAt = 0;
          task.state = 'waiting';
          task.updatedAt = Date.now();
          save();
        } else if (adoptUnboundAttemptedConversation(task)) {
          task.attempted = false;
          task.dispatchOriginURL = '';
          task.dispatchStartedAt = 0;
          task.rendererRecoveryExhausted = false;
          task.routeRecoveryAttempts = 0;
          task.workspaceDocumentRecoveryAttempts = 0;
          task.updatedAt = Date.now();
          state(task, 'waiting', '已从当前唯一的新会话恢复本轮发送结果；沿用原发送标识和附件，开始检查最终回复，不会重复发送。');
          save();
        } else {
          // This is the one runner path without send() or inspect() to own its
          // page checks: keep the ambiguous-send safety guard, but do not pay
          // for it on ordinary bound-task ticks as well.
          const scanContext = createPageScanContext();
          dismissUnexpectedModals(task, scanContext);
          const rateLimit = rateLimitNotice(scanContext.pageRecords);
          if (rateLimit) {
            nextScheduleMs = restForRateLimit(task);
            return;
          }
          const confirmationStartedAt = Number(task.recoveryConfirmationStartedAt || task.sentAt || 0);
          if (confirmationStartedAt && Date.now() - confirmationStartedAt < SEND_CONFIRM_TIMEOUT_MS) {
          // Do not abandon an ambiguous click while the SPA is still loading.
          // The persisted token lets a later scan confirm the original turn.
            if (task.state !== 'sending') state(task, 'sending', '正在确认原消息，暂不重发，等待当前会话完成加载。');
            return;
          }
          // The send had a full 90-second confirmation window and one final
          // safe adoption check. If no current-round conversation can still
          // be bound, immediately fresh-resend the same phase/round payload.
          stopAmbiguousSend(task);
          return;
        }
      }
      if (!task.url) {
        if (sameRouteWaitUntil > Date.now()) {
          nextScheduleMs = sameRouteWaitUntil - Date.now();
          return;
        }
        const dispatchWait = (task.connectionInterruptedFreshDispatch || task.immediateFreshDispatch) ? 0 : dispatchCooldownRemaining();
        if (dispatchWait > 0) {
          nextScheduleMs = dispatchWait;
          state(task, 'queued', `上一会话刚结束，插件正在休息 ${Math.ceil(dispatchWait / 1000)} 秒后再派发；不会连续发送会话。`);
          save();
          return;
        }
        await send(task, signal);
        const attachmentRetryAt = Number(task.attachmentUploadRetryAt || 0);
        if (task.attachmentUploadFailed && attachmentRetryAt > Date.now()) {
          // Wake exactly when the resumable attachment attempt may run again;
          // do not let the generic 2-second scan turn a backoff into a busy
          // loop or mark the active task idle.
          nextScheduleMs = Math.max(250, attachmentRetryAt - Date.now());
        }
      } else await inspect(task, signal);
    } catch (error) {
      if (!signal.aborted && task && task.state !== 'paused' && task.state !== 'cancelled') {
        const reviewRecovery = error.code === 'invalid-review-json' ? queueReviewRepair(task, error.message) : '';
        if (reviewRecovery === 'queued') nextScheduleMs = 100;
        else if (reviewRecovery !== 'blocked') state(task, 'blocked', error.message);
      }
    } finally {
      busy = false;
      if (!signal.aborted) schedule(visibilityAwareDelay(nextScheduleMs, VISIBLE_SCAN_INTERVAL_MS, HIDDEN_SCAN_INTERVAL_MS));
    }
  }
  async function start(restorePaused = true) {
    if (running || busy) return;
    if (!navigator.locks) throw new Error('浏览器不支持单标签互斥锁，无法安全启动。');
    const deadline = Date.now() + RUNNER_RECLAIM_TIMEOUT_MS;
    while (!running && Date.now() <= deadline) {
      const acquired = await new Promise((resolveAttempt, rejectAttempt) => {
        navigator.locks.request(`fabushi-tab-runner-v3:${tabId}`, { ifAvailable:true }, async lock => {
          if (!lock) { resolveAttempt(false); return; }
          const stored = read(KEY, null);
          const nextRevision = Math.max(Number(data.controlRevision || 0), Number(stored?.tabControls?.[tabId]?.controlRevision || 0)) + 1;
          data.controlRevision = nextRevision;
          data.autoResume = true;
          data.pausedAt = 0;
          if (restorePaused) restorePausedTasks(nextRevision);
          save();
          if (data.autoResume === false) { haltRunnerForPause(); resolveAttempt(true); return; }
          running = true; controller = new AbortController();
          const held = new Promise(done => { lockRelease = done; });
          paint(); schedule(100); resolveAttempt(true); await held;
        }).catch(rejectAttempt);
      });
      if (acquired) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(RUNNER_RECLAIM_POLL_MS, remaining)));
    }
    throw new Error('旧页面的任务监督器仍在释放中；插件会继续自动接管，无需手动暂停或重开任务。');
  }
  function autoStart(taskId) {
    if (!taskId) return;
    autoStartTaskId = taskId;
    clearTimeout(autoStartTimer); autoStartTimer = null;
    start(false).then(() => {
      if (autoStartTaskId === taskId) autoStartTaskId = '';
    }).catch(error => {
      if (autoStartTaskId !== taskId) return;
      const task = data.tasks.find(item => item.id === taskId && taskBelongsToTab(item));
      if (!task || terminal.has(task.state)) { autoStartTaskId = ''; return; }
      log(task, `插件自动启动未完成：${error.message}；将自动重试，不需要手动点击继续。`);
      autoStartTimer = setTimeout(() => {
        autoStartTimer = null;
        if (autoStartTaskId === taskId && !running) autoStart(taskId);
      }, AUTO_START_RETRY_MS);
    });
  }
  function pause(manual = false) {
    if (manual) {
      const stored = read(KEY, null);
      data.controlRevision = Math.max(Number(data.controlRevision || 0), Number(stored?.tabControls?.[tabId]?.controlRevision || 0)) + 1;
      data.autoResume = false;
      data.pausedAt = Date.now();
    }
    markTasksPaused();
    save();
    haltRunnerForPause();
    paint();
  }
  function enqueue(goal, taskMode = mode, attachments = [], reasoningPreset = DEFAULT_REASONING_PRESET, modelPreset = DEFAULT_MODEL_PRESET) {
    if (!goal.trim()) throw new Error('请输入任务目标');
    if (tabTasks().length >= 50) throw new Error('每个标签页最多保存 50 个任务，请先归档已完成任务。');
    const normalizedAttachments = Array.from(attachments || []).map(normalizeAttachmentMeta).filter(Boolean);
    const task = { id:id(), ownerTabId:tabId, goal:goal.trim().slice(0,16000), mode:taskMode, modelPreset:normalizeModelPreset(modelPreset), reasoningPreset:normalizeReasoningPreset(reasoningPreset), state:'queued', phase:'work', round:1, url:'', attachments:normalizedAttachments, messages:[], messageVersion:0, goalRevision:0 };
    data.tasks.push(task); selected = task.id;
    // A newly submitted goal must not wait behind an older task whose
    // persisted URL is stale or synthetic. Make it the next scheduler target
    // immediately; the existing single-tab lock still serializes the send.
    current = task.id;
    lastSwitch = Date.now();
    log(task, task.goal, 'user');
    if (running) schedule(100);
    return task;
  }
  function restoreCancelledTask(task) {
    if (!taskBelongsToTab(task) || task.state !== 'cancelled') return false;
    // `task.url` is the active round's identity. `sessionUrl`, `sessionUrls`,
    // and history are evidence for display/recovery, but after a Work round
    // finishes `task.url` is deliberately cleared while the next planner is
    // still queued. Never reopen that previous round when resuming a
    // cancelled, not-yet-dispatched task.
    const knownURL = canonicalConversationURL(task.url);
    if (knownURL) recordConversationURL(task, knownURL);
    if (task.attempted && task.token) task.state = 'sending';
    else if (knownURL) task.state = 'waiting';
    else {
      task.state = 'queued';
      task.url = '';
      task.token = '';
      task.attempted = false;
      task.dispatchOriginURL = '';
      task.dispatchStartedAt = 0;
    }
    task.updatedAt = Date.now();
    selected = task.id;
    current = task.id;
    lastSwitch = Date.now();
    log(task, task.state === 'queued'
      ? '已恢复取消的任务，将从持久化目标继续派发。'
      : '已恢复取消的任务，继续监控取消前的 ChatGPT 会话。');
    return true;
  }
NaN
  function resumeCancelledTask(task) {
    if (!restoreCancelledTask(task)) return Promise.resolve(false);
    data.autoResume = true;
    save();
    if (running) { schedule(100); return Promise.resolve(true); }
    return start(false).then(() => true);
  }
  function prepareTaskForRecovery(task, { automatic = false } = {}) {
    if (!taskBelongsToTab(task) || !task || terminal.has(task.state) && task.state !== 'blocked') return false;
    data.autoResume = true;
    data.pausedAt = 0;
    const adoptedURL = task.state === 'blocked'
      ? adoptUnboundAttemptedConversation(task, { explicit: !automatic })
      : '';
    const knownURL = canonicalConversationURL(task.url);
    if (adoptedURL || knownURL) {
      // A durable conversation URL is already enough to continue inspection;
      // do not send the old ambiguous click through the timeout branch again.
      task.attempted = false;
      task.dispatchOriginURL = '';
      task.dispatchStartedAt = 0;
      task.recoveryConfirmationStartedAt = 0;
      task.url = canonicalConversationURL(task.url) || adoptedURL;
      armRecoveredFinalIdentity(task, { allowStaticFinal: !automatic });
      task.state = 'waiting';
      task.rendererRecoveryExhausted = false;
      task.routeRecoveryAttempts = 0;
      task.workspaceDocumentRecoveryAttempts = 0;
      resetAmbiguousSendRecovery(task);
      task.noFinalReplyRecoveryUntil = 0;
      delete task.pausedState;
      log(task, automatic
        ? '宿主已恢复页面；沿用原会话、发送标识和附件，继续检查最终回复，不会重复发送。'
        : '已恢复任务；沿用原会话、发送标识和附件，继续检查最终回复，不会重复发送。');
    } else if (task.attempted && task.token) {
      // The click may have reached ChatGPT even though the renderer never
      // painted a route. Keep the token and exact attachment metadata; the
      // host capability can now reopen the persisted recovery URL.
      task.state = 'sending';
      task.rendererRecoveryExhausted = false;
      task.routeRecoveryAttempts = 0;
      task.workspaceDocumentRecoveryAttempts = 0;
      task.noFinalReplyRecoveryUntil = 0;
      // The original send timestamp is retained as evidence, but recovery
      // needs its own bounded confirmation window. Without this marker, the
      // first post-recovery scan sees the old timestamp and immediately
      // returns the task to the blocked state forever.
      task.recoveryConfirmationStartedAt = Date.now();
      ensureAutomaticRecoveryTicket(task, { force:true });
      delete task.pausedState;
      log(task, automatic
        ? '宿主已恢复发送中的页面；保留原发送标识和附件，等待会话链接确认，不会重复发送。'
        : '已恢复发送中的任务；保留原发送标识和附件，等待会话链接确认，不会重复发送。');
    } else if (task.attachmentUploadFailed || task.attachmentUploadPending) {
      clearDispatchIntent(task);
      task.state = 'queued';
      delete task.pausedState;
      log(task, '已恢复附件任务；重置上传状态并重新注入附件，确认附件出现前不会发送纯文字目标。');
    } else {
      // A blocked task that never clicked Send is safe to put back in the
      // queue. An ambiguous click takes the branch above and is never
      // converted into a second dispatch.
      clearDispatchIntent(task);
      task.state = 'queued';
      delete task.pausedState;
      log(task, '已恢复未发送任务，将重新准备目标；附件仍从本地持久化记录读取。');
    }
    task.updatedAt = Date.now();
    selected = task.id;
    current = task.id;
    lastSwitch = Date.now();
    return true;
  }
  function recoverPersistedBlockedTasks() {
    if (data.autoResume === false) return '';
    const task = tabTasks().find(item => item.state === 'blocked');
    if (!task) return '';
    queueBlockedFreshRetry(task, '检测到历史“需要处理”任务');
    return task.id;
  }
  function resumeTask(task) {
    if (!taskBelongsToTab(task) || !task || task.state === 'done') return Promise.resolve(false);
    if (task.state === 'paused') {
      // A task may be resumed individually even when the old global pause
      // barrier is still persisted. Advance that barrier before the helper's
      // log/save call, otherwise the stale global pause would immediately
      // rewrite this task back to `paused`.
      if (data.autoResume === false) {
        const stored = read(KEY, null);
        data.controlRevision = Math.max(Number(data.controlRevision || 0), Number(stored?.tabControls?.[tabId]?.controlRevision || 0)) + 1;
        data.autoResume = true;
        data.pausedAt = 0;
      }
      if (!restorePausedTask(task, Number(data.controlRevision || 0), { global:false })) return Promise.resolve(false);
    } else if (task.state === 'cancelled') {
      if (!restoreCancelledTask(task)) return Promise.resolve(false);
    } else if (task.state === 'blocked') {
      if (!prepareTaskForRecovery(task)) return Promise.resolve(false);
    }
    data.autoResume = true;
    data.pausedAt = 0;
    selected = task.id;
    current = task.id;
    lastSwitch = Date.now();
    save();
    if (running) { schedule(100); return Promise.resolve(true); }
    return start(false).then(() => true);
  }
  function deleteTask(task) {
    // Deletion is deliberately limited to tasks that can no longer dispatch a
    // message. A live task must be paused/cancelled first so a user cannot
    // accidentally remove the only durable handle for an in-flight ChatGPT
    // conversation.
    if (!taskBelongsToTab(task) || (!terminal.has(task.state) && task.state !== 'paused')) return false;
    const index = data.tasks.findIndex(item => item.id === task.id);
    if (index < 0) return false;
    data.tasks.splice(index, 1);
    data.deletedTaskIds ||= [];
    if (!data.deletedTaskIds.includes(task.id)) data.deletedTaskIds.push(task.id);
    data.deletedTaskIds = data.deletedTaskIds.slice(-200);
    observations.delete(task.id);
    attachmentDispatchContexts.delete(task.id);
    if (current === task.id) current = '';
    if (selected === task.id) selected = tabTasks()[0]?.id || '';
    save();
    paint();
    if (taskAttachments(task).length && typeof indexedDB !== 'undefined') {
      void deleteTaskAttachmentBlobs(task).catch(error => console.warn('[Fabushi] 删除任务附件失败：', error.message));
    }
    return true;
  }
