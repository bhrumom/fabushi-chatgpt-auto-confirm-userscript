  function reviewParseError(message, cause = null) {
    const error = new Error(message);
    error.code = 'invalid-review-json';
    if (cause) error.cause = cause;
    return error;
  }
  function reviewFieldValue(source, key) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const field = new RegExp(`(?:["']\\s*)?${escapedKey}(?:\\s*["'])?\\s*:`, 'i').exec(source);
    if (!field) return null;
    let index = field.index + field[0].length;
    while (/\s/.test(source[index] || '')) index += 1;
    if (index >= source.length) return null;
    const quote = source[index];
    if (quote !== '"' && quote !== "'") {
      const start = index;
      while (index < source.length && !',}\n\r'.includes(source[index])) index += 1;
      const value = source.slice(start, index).trim();
      return value ? { value, quoted:false } : null;
    }
    index += 1;
    let value = '';
    const escapes = { '"':'"', "'":"'", '\\':'\\', '/':'/', b:'\\b', f:'\\f', n:'\\n', r:'\\r', t:'\\t' };
    for (; index < source.length; index += 1) {
      const character = source[index];
      if (character === '\\') {
        const escaped = source[index + 1];
        if (!escaped) return null;
        if (escaped === 'u') {
          const hex = source.slice(index + 2, index + 6);
          if (!/^[0-9a-f]{4}$/i.test(hex)) return null;
          value += String.fromCharCode(parseInt(hex, 16));
          index += 5;
        } else {
          value += escapes[escaped] ?? escaped;
          index += 1;
        }
        continue;
      }
      if (character === quote) {
        let next = index + 1;
        while (/\s/.test(source[next] || '')) next += 1;
        // A quote followed by a field delimiter closes the value. A quote
        // followed by another key quote is also a boundary for tolerant
        // reports that omit the comma between fields. Otherwise it is kept
        // as an unescaped quote inside the human-written summary/next text.
        if (next >= source.length || ',}]'.includes(source[next]) || source[next] === '"' || source[next] === "'") {
          return { value, quoted:true };
        }
      }
      value += character;
    }
    return null;
  }
  function recoverReviewReport(source, task = null) {
    const parseCandidate = candidate => {
      const taskId = reviewFieldValue(candidate, 'taskId')?.value?.trim();
      const roundRaw = reviewFieldValue(candidate, 'round')?.value?.trim();
      const status = reviewFieldValue(candidate, 'status')?.value?.trim();
      const summary = reviewFieldValue(candidate, 'summary')?.value?.trim();
      const round = roundRaw && /^\d+$/.test(roundRaw) ? Number(roundRaw) : NaN;
      if (!taskId || !Number.isInteger(round) || !status || !summary) return null;
      const report = { taskId, round, status, summary };
      const next = reviewFieldValue(candidate, 'next')?.value?.trim();
      if (next) report.next = next;
      return report;
    };
    const candidates = [];
    const taskIdField = /(?:["']\s*)?taskId(?:\s*["'])?\s*:/gi;
    for (const match of source.matchAll(taskIdField)) {
      const report = parseCandidate(source.slice(match.index));
      if (report) candidates.push(report);
    }
    if (!candidates.length) {
      const report = parseCandidate(source);
      if (report) candidates.push(report);
    }
    if (task) {
      const exact = candidates.find(report => report.taskId === task.id && report.round === task.round);
      if (exact) return exact;
    }
    return candidates.at(-1) || null;
  }
  function parseReview(value, task) {
    const source = String(value).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let report;
    try {
      report = JSON.parse(source);
    } catch (error) {
      report = recoverReviewReport(source, task);
      if (!report) throw reviewParseError('验收回复 JSON 无法解析；插件将有限重开验收会话，不会重复执行 Work。', error);
    }
    if (!report || typeof report !== 'object' || Array.isArray(report)
      || typeof report.taskId !== 'string' || !Number.isInteger(report.round)
      || typeof report.status !== 'string' || !['complete','next'].includes(report.status)
      || typeof report.summary !== 'string' || !report.summary.trim()) {
      throw reviewParseError('验收回复缺少可验证的任务报告字段；插件将有限重开验收会话，不会重复执行 Work。');
    }
    if (report.taskId !== task.id || report.round !== task.round) {
      throw reviewParseError(`验收回复身份不匹配：期望 taskId=${task.id}、round=${task.round}，实际 taskId=${report.taskId}、round=${report.round}；将仅重开规划/验收会话并保留 Work 结果，不会重复执行 Work。`);
    }
    if (report.status === 'next' && (typeof report.next !== 'string' || !report.next.trim())) throw reviewParseError('验收回复缺少下一轮安排；插件将有限重开验收会话，不会重复执行 Work。');
    return report;
  }
  function currentReviewReport(value, task) {
    if (!task || task.phase !== 'review' || !String(value || '').trim()) return null;
    try { return parseReview(value, task); }
    catch { return null; }
  }
  function queueReviewRepair(task, reason = '验收回复格式无法解析') {
    if (!task || task.phase !== 'review') return '';
    const attempts = Number(task.reviewRepairAttempts || 0);
    if (attempts >= MAX_REVIEW_REPAIR_ATTEMPTS) {
      return queueBlockedFreshRetry(task, `${reason}；已达到 ${MAX_REVIEW_REPAIR_ATTEMPTS} 次当前会话修复上限`);
    }
    task.reviewRepairAttempts = attempts + 1;
    clearDispatchIntent(task);
    task.state = 'queued';
    log(task, `${reason}；已保留 Work 结果并重新开启规划/验收会话（第 ${task.reviewRepairAttempts}/${MAX_REVIEW_REPAIR_ATTEMPTS} 次），不会重复执行 Work。`);
    save();
    return 'queued';
  }
  function finish(task, reply) {
    task.preview = '';
    task.previewSourceURL = '';
    task.previewPhase = '';
    task.previewRound = 0;
    // A real final reply ends the temporary cross-conversation continuation
    // chain. The next phase/round must not inherit the previous session text.
    task.lengthLimitCarry = '';
    task.lengthLimitCarrySourceURL = '';
    task.lengthLimitHopCount = 0;
    task.lengthLimitLastAt = 0;
    clearAbnormalFreshCarry(task);
    clearHandoffReplySnapshot(task);
    clearRecoveredFinalIdentity(task);
    task.explicitRecoveryActive = false;
    task.noFinalReplyAttempts = 0;
    task.noFinalReplyRecoveryCycles = 0;
    task.noFinalReplyRecoveryUntil = 0;
    task.blockedAutoRetryCount = 0;
    task.lastBlockedReason = '';
    task.lastBlockedRecoveryAt = 0;
    task.cooldownUntil = 0;
    task.rateLimitEpisodes = 0;
    task.sendPrepared = false;
    task.preparedPrompt = '';
    task.sendUiWaitSince = 0;
    task.dispatchOriginURL = '';
    task.dispatchStartedAt = 0;
    task.recoveryConfirmationStartedAt = 0;
    task.rendererRecoveryExhausted = false;
    task.routeRecoveryAttempts = 0;
    task.workspaceDocumentRecoveryAttempts = 0;
    task.continuationSentAt = 0;
    task.continuationCount = 0;
    clearChatWorkStayState(task);
    clearApprovalUnavailableRefresh(task);
    clearApprovalSettlement(task);
    task.connectionInterruptedSince = 0;
    task.connectionInterruptedURL = '';
    task.connectionInterruptedRefreshAttempts = 0;
    task.connectionInterruptedRefreshAt = 0;
    task.connectionInterruptedRefreshExhausted = false;
    task.abnormalNoFinalSince = 0;
    task.abnormalNoFinalSignature = '';
    clearPendingContinuation(task);
    resetAmbiguousSendRecovery(task);
    resetAttachmentUploadState(task);
    observations.delete(task.id);
    log(task, reply, 'assistant');
    const sessionURL = canonicalConversationURL(task.url);
    if (sessionURL) recordConversationURL(task, sessionURL);
    task.history ||= []; task.history.push({ url:sessionURL || task.url, phase:task.phase, round:task.round }); task.history = task.history.slice(-40);
    if (task.mode === 'once') { state(task, 'done'); return; }
    if (task.phase === 'work') {
      if (Number(task.dispatchGoalRevision || 0) !== Number(task.goalRevision || 0)) {
        task.result = ''; task.next = ''; task.round++; task.phase = 'work'; task.url = ''; task.token = ''; task.attempted = false; task.state = 'queued'; task.noFinalReplyAttempts = 0;
        task.dispatchOriginURL = ''; task.dispatchStartedAt = 0;
        log(task, '工作会话执行期间目标已更新；已忽略旧目标结果，下一轮 Work 将按新目标开始。');
        save();
        return;
      }
      task.result = reply.slice(0,24000); task.reviewRepairAttempts = 0; task.phase = 'review'; task.url = ''; task.token = ''; task.attempted = false; task.dispatchOriginURL = ''; task.dispatchStartedAt = 0; task.state = 'queued'; task.noFinalReplyAttempts = 0;
      log(task, 'Work 自然回复已确认结束，插件正在新开规划/验收会话。');
    } else {
      const report = parseReview(reply, task);
      task.reviewRepairAttempts = 0;
      if (Number(task.dispatchGoalRevision || 0) !== Number(task.goalRevision || 0)) {
        task.result = ''; task.next = ''; task.round++; task.phase = 'work'; task.url = ''; task.token = ''; task.attempted = false; task.dispatchOriginURL = ''; task.dispatchStartedAt = 0; task.state = 'queued'; task.noFinalReplyAttempts = 0;
        log(task, '验收期间任务目标已更新；已忽略旧验收结论，下一轮 Work 将按新目标开始。');
        save();
        return;
      }
      if (report.status === 'complete') state(task, 'done', `验收完成：${report.summary}`);
      else {
        task.next = report.next.slice(0,16000); task.round++; task.phase = 'work'; task.url = ''; task.token = ''; task.attempted = false; task.dispatchOriginURL = ''; task.dispatchStartedAt = 0; task.state = 'queued'; task.noFinalReplyAttempts = 0;
        log(task, `规划/验收要求继续：${report.summary}`);
      }
    }
    save();
  }
  async function inspect(task, signal) {
    // Existing conversation inspection must not depend on the composer. A
    // stuck/partial renderer can hide the input while still exposing enough
    // turn state to detect an abnormal end and keep recovering the bound chat.
    if (!await navigate(task.url, signal, task, false)) return;
    check(signal);
    const liveURL = currentConversationURL();
    const taskURL = canonicalConversationURL(task.url);
    if (!liveURL || !taskURL || liveURL !== taskURL) {
      observations.delete(task.id);
      state(task, 'waiting', '正在等待切换到当前任务会话；不会读取其他任务的页面内容。');
      return;
    }
    // Handle an in-response Work upsell before any generic modal dismissal or
    // Stop-absent/connection-interrupted fresh-chat decision. The exact task
    // route was checked above and no second ChatGPT prompt is sent here.
    if (handleChatWorkContinueOffer(task, signal)) return;
    const begin = performance.now();
    resetScanDiagnostics();
    // The context is created only after async navigation and route ownership
    // validation. Popup handling and status classifiers share its lazy page
    // text and authorization snapshots for this inspection slice.
    const scanContext = createPageScanContext();
    const getPageUiRecords = scanContext.pageRecords;
    dismissUnexpectedModals(task, scanContext);
    const turnStartedAt = performance.now();
    const turn = taskTurnForInspection(task, scanContext);
    const turnInspectionMs = performance.now() - turnStartedAt;
    const cardsStartedAt = performance.now();
    const pending = scanContext.cards();
    const authorizationScanMs = performance.now() - cardsStartedAt;
    const routeOwned = Boolean(liveURL && taskURL && liveURL === taskURL);
    const foreignTask = tabTasks().find(item => item.id !== task.id && item.token && hasTaskMarker(item));
    const otherRouteOwner = routeOwned ? conversationURLOwner(liveURL, task.id) : null;
    const ownMarkerMounted = Boolean(taskMarkerUser(task));
    // ChatGPT may virtualize the marker-bearing user turn while leaving an
    // approval card visible in this task's already-bound conversation. Route
    // identity is enough to surface that control only when no competing task
    // owns the page; it must never grant ownership of assistant content.
    const approvalRouteEligible = Boolean(routeOwned && !foreignTask && !otherRouteOwner);
    // Reply ownership stays strict. Ended-conversation detection gets a
    // narrower route-only fallback when ChatGPT has virtualized this task's
    // marker: exact route, no competing task/marker, and no contradictory
    // still-mounted own marker. This fallback may participate in a guarded
    // fresh-session handoff, but it never attributes assistant text as a final
    // result without the normal final-evidence rules.
    const routeEndedOwned = Boolean(
      routeOwned
      && !turn.owned
      && !task.attempted
      && !ownMarkerMounted
      && !foreignTask
      && !otherRouteOwner
    );
    const pageBelongsToTask = routeOwned && (turn.owned || routeEndedOwned || !foreignTask);
    const activityTurn = routeEndedOwned ? latestTurn() : turn;
    const stopPresent = (turn.owned || routeEndedOwned) ? Boolean(stopButton()) : false;
    const previous = observations.get(task.id);
    const now = Date.now();
    const activityText = String(activityTurn?.text || '');
    const activityTextStableSince = previous && String(previous.activityText || '') === activityText
      ? Number(previous.activityTextStableSince || now)
      : now;
    // ChatGPT can leave `aria-busy` / `data-is-streaming` and a “thinking”
    // status behind after generation has actually stopped. Without the Stop
    // control, treat those markers as active only while assistant text is
    // still changing; after the ordinary ended-state stability window, they
    // must not hold recovery indefinitely.
    const staleActivityStreaming = Boolean(
      !stopPresent
      && activityTurn?.streaming
      && !activityTurn?.final
      && now - activityTextStableSince >= ENDED_NO_FINAL_STABILITY_MS,
    );
    const observedActivityStreaming = Boolean(activityTurn?.streaming && !activityTurn?.final && !staleActivityStreaming);
    const approvalVisible = approvalRouteEligible && pending.length > 0;
    const approvalSettling = approvalRouteEligible && approvalSettlementActive(task, liveURL, now);
    const approvalBlocking = approvalVisible || approvalSettling;
    if (((!approvalVisible && !approvalSettling) || !data.autoApprove)
      && clearApprovalUnavailableRefresh(task)) {
      task.updatedAt = now;
      save();
    }
    // If an authorization surface appears while an interruption handoff is in
    // its two-scan confirmation window, cancel that confirmation immediately.
    // After authorization/settlement finishes, a brand-new 8-second no-card
    // window is required before the destructive fresh-chat handoff can resume.
    if (approvalBlocking
      && String(task.stopNoApprovalConfirmSignature || '').includes('"connection-interrupted"')) {
      clearStopNoApprovalConfirmation(task);
      task.updatedAt = now;
      save();
    }
    const currentBlocker = blocker();
    const currentRateLimit = rateLimitNotice(getPageUiRecords);
    // Recovery already has a safe exact-route transcript extractor for the
    // current visible assistant response. Review can additionally prove its
    // own semantic identity through taskId + round, so keep that text available
    // even when ChatGPT has virtualized the marker-bearing user turn and this
    // document never persisted a Stop/generation identity.
    const visibleReviewTranscript = task.phase === 'review'
      && routeEndedOwned
      && !foreignTask
      && !otherRouteOwner
        ? visibleAssistantWorkTranscript(task, { allowExactRouteFallback:true })
        : { text:'', sourceKind:'' };
    const visibleReviewText = String(visibleReviewTranscript.text || '').trim();
    const visibleReviewReport = visibleReviewText
      ? currentReviewReport(visibleReviewText, task)
      : null;
    // Live review DOM can remove Stop before its response toolbar is mounted.
    // A complete current-task report is stronger than that transient toolbar
    // gap because parseReview still enforces exact taskId/round and schema.
    const structuredReviewFinal = Boolean(
      task.phase === 'review'
      && routeOwned
      && turn.owned
      && turn.text
      && !stopPresent
      && !observedActivityStreaming
      && !approvalBlocking
      && !currentBlocker
      && !currentRateLimit
      && currentReviewReport(turn.text, task)
    );
    const messagesMountedForLoadFailure = visibleConversationHasMessages();
    const explicitConversationLoadFailure = routeOwned && !messagesMountedForLoadFailure
      ? conversationLoadFailure(getPageUiRecords)
      : '';
    if (explicitConversationLoadFailure
      && !approvalBlocking
      && !currentBlocker
      && !currentRateLimit
      && !task.attempted) {
      recoverConversationLoadFailure(task, true, Date.now(), turn);
      return;
    }
    if (messagesMountedForLoadFailure && clearConversationLoadFailureState(task)) {
      task.updatedAt = Date.now();
      save();
    }
    // A visible connection-interrupted product notice is actionable recovery
    // evidence for this already-bound exact route. Handle it before inherited
    // Stop/hydration gates: after a same-route reload those gates can be based
    // on the previous document and otherwise return early forever even while
    // the current page clearly says it is waiting for the complete answer.
    const explicitConnectionInterrupted = Boolean(
      pageBelongsToTask
      && !approvalBlocking
      && !currentBlocker
      && !currentRateLimit
      && connectionInterruptedNotice(routeEndedOwned ? activityTurn : turn, getPageUiRecords)
    );
    if (explicitConnectionInterrupted) {
      const interruptionTurn = routeEndedOwned ? activityTurn : turn;
      const handoffGate = interruptedFreshHandoffApprovalGate(task, liveURL, now);
      if (handoffGate.state === 'approval') {
        task.state = 'approval';
        task.updatedAt = now;
        log(task, '已识别 ChatGPT 异常中断，但实时复核发现授权卡；先留在当前会话处理授权，不会在授权未解决时切换会话。');
        save();
        if (data.autoApprove && handoffGate.card) await authorize(handoffGate.card, task, signal);
        return;
      }
      if (handoffGate.state === 'confirming') {
        task.state = 'waiting';
        task.updatedAt = now;
        if (handoffGate.started) {
          log(task, `已识别 ChatGPT 连接中断，并归类为异常中断；不再等待 5 分钟或刷新旧会话。先进行至少 ${Math.ceil(STOP_NO_APPROVAL_CONFIRM_MS / 1000)} 秒的二次实时授权复核，确认没有授权卡后直接新开会话接力。`);
        } else {
          save();
        }
        return;
      }
      persistHandoffReplySnapshot(task, { allowExactRouteFallback:true, now });
      if (queueInterruptedFreshRetry(
        task,
        '检测到 ChatGPT 连接中断，按异常中断处理',
        now,
        interruptionTurn,
        { allowExactRouteFallback:true, recoveryLabel:'异常中断接力', historyReason:'connection-interrupted-fresh-chat' },
      )) return;
      task.state = 'waiting';
      task.updatedAt = now;
      save();
      return;
    }
    const stopGenerationIdentity = stopObservedGenerationIdentity(task, liveURL);
    if (stopPresent && stopGenerationIdentity) {
      const generationChanged = task.stopObservedGenerationIdentity !== stopGenerationIdentity;
      const assistantBoundaryKey = assistantResponseBoundaryKey(activityTurn);
      const observedUserBoundaryKey = turn.owned
        ? recoveryUserBoundaryKey(conversationRoleNodes('user').at(-1))
        : (generationChanged ? '' : String(task.stopObservedUserBoundaryKey || ''));
      const nextAssistantBoundaryKey = generationChanged
        ? assistantBoundaryKey
        : (assistantBoundaryKey || String(task.stopObservedAssistantBoundaryKey || ''));
      const changed = generationChanged
        || String(task.stopObservedDocumentId || '') !== DOCUMENT_INSTANCE_ID
        || String(task.stopObservedAssistantBoundaryKey || '') !== nextAssistantBoundaryKey
        || String(task.stopObservedUserBoundaryKey || '') !== observedUserBoundaryKey
        || task.reloadStopAbsentDocumentId
        || task.reloadStopAbsentSince
        || task.reloadStopAbsentSignature;
      task.stopObservedGenerationIdentity = stopGenerationIdentity;
      task.stopObservedGenerationAt = now;
      task.stopObservedDocumentId = DOCUMENT_INSTANCE_ID;
      task.stopObservedAssistantBoundaryKey = nextAssistantBoundaryKey;
      task.stopObservedUserBoundaryKey = observedUserBoundaryKey;
      clearReloadStopAbsenceState(task);
      if (changed) {
        task.updatedAt = now;
        save();
      }
    }
    const stopIdentityMatches = Boolean(
      stopGenerationIdentity
      && task.stopObservedGenerationIdentity === stopGenerationIdentity
    );
    const stopObservedInCurrentDocument = Boolean(
      stopIdentityMatches
      && String(task.stopObservedDocumentId || '') === DOCUMENT_INSTANCE_ID
    );
    const inheritedStopObservation = Boolean(stopIdentityMatches && !stopObservedInCurrentDocument);
    // A complete ChatGPT document can expose the exact conversation route and
    // an enabled composer while the transcript itself never hydrates. Cache
    // these two DOM checks once for the inherited-Stop gate so that shell-only
    // recovery and normal stable-absence handling use the same snapshot.
    const reloadComposerReady = Boolean(composer());
    const reloadMessagesReady = visibleConversationHasMessages();
    const reloadHydrationReady = Boolean(
      inheritedStopObservation
      && !stopPresent
      && document.readyState === 'complete'
      && approvalRouteEligible
      && !approvalBlocking
      && (turn.owned || routeEndedOwned)
      && !foreignTask
      && !otherRouteOwner
      && !task.attempted
      && !currentBlocker
      && !currentRateLimit
      && reloadComposerReady
      && reloadMessagesReady
    );
    // v2.10.0 made inherited-Stop waits observable, but its early return also
    // reset identityMismatchSince to zero. A shell-only route (exact URL +
    // complete document + composer, but no visible message nodes) could
    // therefore never reach the existing 30-second same-route renderer
    // recovery. Preserve that timer only for this tightly guarded state.
    const inheritedShellHydrationReady = Boolean(
      inheritedStopObservation
      && !stopPresent
      && document.readyState === 'complete'
      && approvalRouteEligible
      && !approvalBlocking
      && (turn.owned || routeEndedOwned)
      && !foreignTask
      && !otherRouteOwner
      && !task.attempted
      && !currentBlocker
      && !currentRateLimit
      && reloadComposerReady
      && !reloadMessagesReady
    );
    const inheritedShellHydrationSince = inheritedShellHydrationReady
      ? Number(previous?.identityMismatchSince || now)
      : 0;
    let inheritedStopAbsenceStable = false;
    if (inheritedStopObservation && !stopPresent) {
      if (!reloadHydrationReady) {
        if (task.reloadStopAbsentDocumentId === DOCUMENT_INSTANCE_ID
          || task.reloadStopAbsentSince
          || task.reloadStopAbsentSignature) {
          clearReloadStopAbsenceState(task);
          task.updatedAt = now;
          save();
        }
      } else {
        const reloadSignature = JSON.stringify(visibleConversationProgressFingerprint());
        if (task.reloadStopAbsentDocumentId !== DOCUMENT_INSTANCE_ID
          || String(task.reloadStopAbsentSignature || '') !== reloadSignature
          || !Number(task.reloadStopAbsentSince || 0)) {
          task.reloadStopAbsentDocumentId = DOCUMENT_INSTANCE_ID;
          task.reloadStopAbsentSignature = reloadSignature;
          task.reloadStopAbsentSince = now;
          task.updatedAt = now;
          log(task, `页面刷新后已恢复当前任务内容，但本轮 Stop 观察来自上一份页面；先等待 ${Math.ceil(RELOAD_STOP_ABSENCE_STABILITY_MS / 1000)} 秒稳定加载，期间 Stop 若重新出现将继续留在原会话。`);
          save();
        } else {
          inheritedStopAbsenceStable = now - Number(task.reloadStopAbsentSince || now) >= RELOAD_STOP_ABSENCE_STABILITY_MS;
        }
      }
    }
    // A historical Stop observation must not hide a genuine final reply.
    // Evaluate strong response-local final evidence before deciding whether
    // Stop disappearance means “start a fresh chat”.
    const strongOwnedFinal = Boolean(
      !stopPresent
      && routeOwned
      && turn.owned
      && (turn.final || structuredReviewFinal)
      && turn.text
      && !foreignTask
      && !otherRouteOwner
      && !approvalVisible
      && !currentBlocker
      && !currentRateLimit
      && !task.attempted
    );
    // A conversation-length notice is a hard product boundary, not a normal
    // final answer. Handle it before final-toolbar classification so a visible
    // copy/share toolbar on the notice cannot prematurely finish Work/Review.
    const lengthLimitNotice = pageBelongsToTask && !approvalBlocking ? conversationLengthLimitNotice(turn, getPageUiRecords) : '';
    // ChatGPT may leave a stale conversation-length notice in page chrome
    // after the latest owned assistant answer has already committed its Copy
    // toolbar. Do not let that old chrome text preempt the ordinary two-scan
    // Work -> Review final gate. A notice inside the current response remains
    // authoritative and continues the same Work phase in a fresh chat.
    const currentResponseLengthLimit = strongOwnedFinal && lengthLimitNotice
      ? conversationLengthLimitNotice(turn, () => [])
      : '';
    const staleChromeLengthLimit = Boolean(
      lengthLimitNotice && strongOwnedFinal && !currentResponseLengthLimit
      && !approvalBlocking && !observedActivityStreaming
    );
    if (lengthLimitNotice && !staleChromeLengthLimit) {
      if (observedActivityStreaming || stopPresent) {
        const waitKey = `${taskURL}:${normalize(lengthLimitNotice).slice(0, 200)}:generating`;
        task.state = 'waiting';
        task.updatedAt = Date.now();
        if (task.lengthLimitCarryWaitKey !== waitKey) {
          task.lengthLimitCarryWaitKey = waitKey;
          log(task, '已检测到会话长度上限，但当前 assistant 仍在生成；先留在原会话等待这一轮结束，再提取完整回复接力，不会复制中途内容。');
        }
        save();
        return;
      }
      if (queueConversationLengthHandoff(task, turn, lengthLimitNotice, Date.now())) return;
      // Do not advance with an older assistant reply or with the notice itself
      // when the current task response cannot yet be safely established.
      const waitKey = `${taskURL}:${normalize(lengthLimitNotice).slice(0, 240)}`;
      task.state = 'waiting';
      task.updatedAt = Date.now();
      if (task.lengthLimitCarryWaitKey !== waitKey) {
        task.lengthLimitCarryWaitKey = waitKey;
        log(task, '已检测到会话长度上限，但当前任务的 assistant 回复尚不能安全提取；保留原会话等待内容稳定，不会把旧回复或提示文字带入新会话。');
      }
      save();
      return;
    }
    const stopDisappearedFreshCandidate = Boolean(
      !stopPresent
      // Review uses the bounded settlement/no-final path below so long
      // reasoning and delayed toolbar hydration cannot create duplicate
      // acceptance chats.
      && task.phase !== 'review'
      && stopIdentityMatches
      && (stopObservedInCurrentDocument || inheritedStopAbsenceStable)
      && approvalRouteEligible
      && !approvalBlocking
      && (turn.owned || routeEndedOwned)
      && !foreignTask
      && !otherRouteOwner
      && !task.attempted
      && !currentBlocker
      && !currentRateLimit
      // Strong response-local final evidence must complete normally instead of
      // being discarded by historical Stop-disappearance recovery.
      && !strongOwnedFinal
    );
    let stopDisappearedFreshEligible = false;
    if (stopDisappearedFreshCandidate) {
      // Re-scan authorization from the live DOM at the exact destructive
      // boundary instead of trusting the cached scan taken earlier in this
      // inspection. Wide mode catches approval cards outside message-derived
      // scopes while still requiring the Reject + Allow + split-menu shape.
      const criticalPending = cards({ wide:true });
      if (criticalPending.length) {
        clearStopNoApprovalConfirmation(task);
        task.state = 'approval';
        task.updatedAt = now;
        log(task, '停止按钮已消失，但实时复核仍检测到授权卡；继续保留当前会话等待授权，不会新开会话。');
        save();
        if (data.autoApprove) await authorize(criticalPending[0], task, signal);
        return;
      }
      const confirmSignature = JSON.stringify([
        stopGenerationIdentity,
        DOCUMENT_INSTANCE_ID,
        String(task.phase || ''),
        Number(task.round || 0),
        String(task.token || ''),
      ]);
      if (task.stopNoApprovalConfirmSignature !== confirmSignature
        || !Number(task.stopNoApprovalConfirmSince || 0)) {
        task.stopNoApprovalConfirmSignature = confirmSignature;
        task.stopNoApprovalConfirmSince = now;
        task.state = 'waiting';
        task.updatedAt = now;
        log(task, `停止按钮已消失，当前扫描暂未发现授权卡；先进行至少 ${Math.ceil(STOP_NO_APPROVAL_CONFIRM_MS / 1000)} 秒的二次实时授权复核，期间不会切换会话。`);
        save();
        return;
      }
      if (now - Number(task.stopNoApprovalConfirmSince || now) < STOP_NO_APPROVAL_CONFIRM_MS) {
        task.state = 'waiting';
        return;
      }
      // One final fresh read closes the race where a card mounts between the
      // confirmation timer and this decision.
      const finalCriticalPending = cards({ wide:true });
      if (finalCriticalPending.length) {
        clearStopNoApprovalConfirmation(task);
        task.state = 'approval';
        task.updatedAt = now;
        log(task, '二次复核期间检测到授权卡；已取消异常结束接力并继续当前会话。');
        save();
        if (data.autoApprove) await authorize(finalCriticalPending[0], task, signal);
        return;
      }
      clearStopNoApprovalConfirmation(task);
      stopDisappearedFreshEligible = true;
    } else if (task.stopNoApprovalConfirmSince || task.stopNoApprovalConfirmSignature) {
      clearStopNoApprovalConfirmation(task);
      task.updatedAt = now;
      save();
    }
    const recoveredOwnedFinal = Boolean(
      inheritedStopObservation
      && strongOwnedFinal
    );
    if (inheritedStopObservation
      && !stopPresent
      && !inheritedStopAbsenceStable
      && !approvalBlocking
      && !currentBlocker
      && !currentRateLimit
      && !recoveredOwnedFinal) {
      task.state = 'waiting';
      task.updatedAt = now;
      // This used to return before scan accounting, leaving the workbench at
      // "扫描 0 次" even though the scheduler was repeatedly checking the
      // page. Persist a bounded observation and count the pass so an
      // unresolved hydration gate is visible instead of becoming a silent
      // zero-scan loop.
      observations.set(task.id, {
        ...(previous || {}),
        text:String(turn.text || ''),
        since:Number(previous?.since || now),
        idleSince:Number(previous?.idleSince || now),
        final:Boolean(turn.final),
        finalSince:turn.final ? Number(previous?.finalSince || now) : 0,
        recoveredStaticCandidate:Boolean(turn.recoveredStaticCandidate),
        recoveredStaticSince:turn.recoveredStaticCandidate ? Number(previous?.recoveredStaticSince || now) : 0,
        stop:false,
        streaming:Boolean(turn.streaming),
        loading:true,
        routeEndedOwned:Boolean(routeEndedOwned),
        activityText:String(activityText || ''),
        activityTextStableSince,
        clear:false,
        identityMismatchSince:inheritedShellHydrationSince,
      });
      const inspectionMs = performance.now() - begin;
      measurements.scans++;
      measurements.totalScanMs += inspectionMs;
      if (inheritedShellHydrationSince
        && now - inheritedShellHydrationSince >= ROUTE_HYDRATION_TIMEOUT_MS) {
        let target;
        try { target = safeURL(task.url); } catch { target = null; }
        if (target) {
          // Reuse the existing same-route recovery budget/backoff. A blank
          // transcript is renderer-hydration failure evidence only; it never
          // authorizes a fresh chat or a duplicate send.
          recoverStalledRoute(target, task);
          return;
        }
      }
      if (!reloadHydrationReady) {
        log(task, inheritedShellHydrationReady
          ? `页面刷新后当前会话输入框已就绪，但消息区仍未挂载；最多等待 ${Math.ceil(ROUTE_HYDRATION_TIMEOUT_MS / 1000)} 秒，仍为空时只刷新当前会话，不会重复发送或新开会话。`
          : '页面刷新后仍在恢复当前任务内容；已保留会话并继续监督，等待消息区和输入框完成加载。');
      }
      return;
    }
    if (stopDisappearedFreshEligible) {
      persistHandoffReplySnapshot(task, { allowExactRouteFallback:true, now });
      if (queueInterruptedFreshRetry(
        task,
        '检测到本轮停止按钮已经消失且没有授权卡片',
        now,
        routeEndedOwned ? activityTurn : turn,
        { allowExactRouteFallback:true, recoveryLabel:'停止按钮消失接力', historyReason:'stop-disappeared-fresh-chat' },
      )) return;
    }
    // Product-level interruption is handled above as an abnormal fresh-chat
    // handoff. Other stream recovery failures already use the same fresh-session
    // path and never inject a continuation into the broken conversation.
    const streamPollingTimeout = Boolean(pageBelongsToTask && !approvalBlocking && !turn.final
      && streamRecoveryPollingTimeoutNotice(routeEndedOwned ? activityTurn : turn));
    if (streamPollingTimeout) {
      if (queueInterruptedFreshRetry(task, '检测到 ChatGPT stream recovery polling timed out', Date.now(), routeEndedOwned ? activityTurn : turn)) return;
    }
    // Legacy persisted interruption intent from older versions is migrated to
    // the same abnormal fresh-chat policy. Stop presence no longer authorizes a
    // five-minute same-route wait: after the no-approval safety confirmation,
    // preserve the visible work and continue in a new conversation.
    if (!approvalBlocking && task.pendingContinuationReason) {
      const reason = '检测到旧版本遗留的连接中断状态，按异常中断处理';
      const interruptionTurn = routeEndedOwned ? activityTurn : turn;
      const handoffGate = interruptedFreshHandoffApprovalGate(task, liveURL, now);
      if (handoffGate.state === 'approval') {
        task.state = 'approval';
        task.updatedAt = now;
        log(task, '旧连接中断状态迁移时检测到授权卡；先处理当前授权，不会越过授权直接切换会话。');
        save();
        if (data.autoApprove && handoffGate.card) await authorize(handoffGate.card, task, signal);
        return;
      }
      if (handoffGate.state === 'confirming') {
        task.state = 'waiting';
        task.updatedAt = now;
        if (handoffGate.started) {
          log(task, `旧连接中断状态已升级为异常中断接力；进行至少 ${Math.ceil(STOP_NO_APPROVAL_CONFIRM_MS / 1000)} 秒授权复核后直接新开会话，不再刷新旧会话。`);
        } else {
          save();
        }
        return;
      }
      persistHandoffReplySnapshot(task, { allowExactRouteFallback:true, now });
      if (queueInterruptedFreshRetry(
        task,
        reason,
        now,
        interruptionTurn,
        { allowExactRouteFallback:true, recoveryLabel:'异常中断接力', historyReason:'connection-interrupted-fresh-chat' },
      )) return;
      task.state = 'waiting';
      task.updatedAt = now;
      save();
      return;
    }
    const loadingStartedAt = performance.now();
    const rawLoading = Boolean(pageLoadingState());
    const loadingScanMs = performance.now() - loadingStartedAt;
    if (rawLoading && !visibleConversationHasMessages()) {
      holdForChatGPTLoading(task);
      return;
    }
    const composerNode = composer();
    const composerReady = Boolean(composerNode);
    let composerDraft = normalize(composerNode?.value || composerNode?.textContent);
    let composerEmpty = Boolean(composerReady && !composerDraft);
    let composerHasRecoveryDraft = Boolean(composerReady && composerDraft === CONTINUATION_PROMPT);
    const latestMountedUser = conversationRoleNodes('user').at(-1) || null;
    const userBoundaryKey = recoveryUserBoundaryKey(latestMountedUser);
    const cacheRetry = routeOwned && (turn.owned || routeEndedOwned) && !foreignTask && !otherRouteOwner
      && !turn.final && !approvalBlocking && !task.attempted
      ? streamCacheExpiredRetry(activityTurn, getPageUiRecords) : null;
    const cacheRetryKey = cacheRetry ? JSON.stringify([liveURL, userBoundaryKey,
      activityTurn.article?.getAttribute('data-turn-key') || '',
      stalledConversationContentHash({ conversationTail:[{ role:'assistant', text:activityText }] })]) : '';
    const cacheRetryAttempted = Boolean(cacheRetry && task.streamCacheRetryKey === cacheRetryKey);
    const retryableError = Boolean(cacheRetry || (pageBelongsToTask && !turn.final && !approvalBlocking
      && sendTimeoutNotice(routeEndedOwned ? activityTurn : turn, getPageUiRecords)));
    const visibleReviewFinal = Boolean(
      visibleReviewReport
      && visibleReviewText
      && routeOwned
      && routeEndedOwned
      && !foreignTask
      && !otherRouteOwner
      && !stopPresent
      && !observedActivityStreaming
      && !approvalBlocking
      && !currentBlocker
      && !currentRateLimit
      && !retryableError
      && composerReady
      && composerEmpty
      && !task.attempted
    );
    // ChatGPT can leave aria-busy/stream markers behind after it has rendered
    // an actionable network-error card. The error is terminal evidence only
    // after Stop disappears; the normal ownership, approval, blocker, rate
    // limit, empty-composer, and eight-second stability checks still apply.
    const retryableErrorEnded = Boolean(retryableError && !stopPresent && !approvalBlocking);
    // In a bound owned conversation, active generation exposes Stop. A
    // decorative/stale spinner must not mask an abnormal stop; neither should
    // stale stream markers attached to an explicit retryable failure card.
    const activityStreaming = Boolean(observedActivityStreaming && !retryableErrorEnded);
    const hasConversationEvidence = Boolean(
      String(activityTurn?.text || '').trim()
      || latestMountedUser
      || conversationRoleNodes('assistant').some(renderedConversationMessage)
    );
    // A manually/recovered-owned static reply is normally allowed to finish
    // through the bounded static-final fallback. However, when ChatGPT also
    // leaves a page-global loading marker behind, that stale loader previously
    // kept the task in "loading" until the 15-minute watchdog refreshed the
    // page. Treat this narrow state as an abnormal end instead: exact route,
    // recovered ownership, idle composer, no Stop/streaming/approval/blocker/
    // rate-limit, and no active ambiguous send. The eight-second abnormal-end
    // timer still decides the transition; this signal never declares success.
    const recoveredStaticStaleLoadingEnd = Boolean(
      rawLoading
      && turn.recoveredStaticCandidate
      && routeOwned
      && turn.owned
      && !foreignTask
      && !otherRouteOwner
      && !stopPresent
      && !observedActivityStreaming
      && !approvalBlocking
      && !currentBlocker
      && !currentRateLimit
      && composerReady
      && !task.attempted
    );
    // A completed response-local action row can outlive a decorative page
    // spinner. Only a strongly owned, idle empty-answer terminal may ignore it.
    const terminalEmptyReply = Boolean(
      turn.terminalEmptyReply
      && turn.owned
      && routeOwned
      && !foreignTask
      && !otherRouteOwner
      && !stopPresent
      && !observedActivityStreaming
      && !approvalBlocking
      && !currentBlocker
      && !currentRateLimit
      && !retryableError
      && composerReady
      && composerEmpty
      && !task.attempted
    );
    const effectiveLoading = Boolean(
      rawLoading && !terminalEmptyReply
      && (
        (turn.recoveredStaticCandidate && !retryableErrorEnded && !recoveredStaticStaleLoadingEnd)
        || (!turn.owned && !routeEndedOwned)
        || stopPresent
        || activityStreaming
        // A blank exact route with only a spinner is genuine hydration, not
        // an ended conversation. Ignore broad page-global loaders only after
        // the route already contains visible conversation evidence.
        || (routeEndedOwned && !hasConversationEvidence)
      )
    );
    const canClearComposerForEndedCheck = Boolean(
      routeOwned
      && (turn.owned || routeEndedOwned)
      && !foreignTask
      && !otherRouteOwner
      && !turn.final
      && !stopPresent
      && !activityStreaming
      && !approvalBlocking
      && !effectiveLoading
      && !currentBlocker
      && !currentRateLimit
      && !task.attempted,
    );
    if (canClearComposerForEndedCheck && composerReady && composerDraft) {
      setInput(composerNode, '');
      composerDraft = '';
      composerEmpty = true;
      composerHasRecoveryDraft = false;
      task.abnormalNoFinalSince = 0;
      task.abnormalNoFinalSignature = '';
      log(task, '当前会话没有最终回复、停止按钮已消失且没有授权卡；为避免输入框残留内容阻挡异常结束恢复，已清空输入框并重新计时。');
      save();
    }
    const fingerprintStartedAt = performance.now();
    const conversationTail = visibleConversationProgressFingerprint();
    const fingerprintMs = performance.now() - fingerprintStartedAt;
    const fingerprintStats = lastFingerprintStats;
    // Some ChatGPT renderer variants can finish a natural-language reply
    // without exposing a response action row that this build recognizes.
    // This fallback is intentionally stronger than generic "conversation
    // ended": it requires exact-route + marker-derived ownership and a fully
    // idle, safe composer state. Route-only recovery ownership is excluded.
    const naturalFinalCandidate = Boolean(
      // Review is a structured contract: never promote arbitrary natural
      // language just because Stop disappeared and the composer is idle.
      // Wait for parseReview()-valid JSON or the response-local final toolbar.
      task.phase !== 'review'
      && routeOwned
      && turn.owned
      && String(turn.text || '').trim()
      && turn.hasNaturalReply
      && !turn.final
      && !stopPresent
      && !activityStreaming
      && !approvalBlocking
      && !rawLoading
      && !effectiveLoading
      && !turn.recoveredStaticCandidate
      && !currentBlocker
      && !currentRateLimit
      && !retryableError
      && composerReady
      && composerEmpty
      && !task.attempted
    );
    const sample = {
      stop:stopPresent,
      cards:approvalRouteEligible ? (approvalBlocking ? Math.max(1, pending.length) : 0) : 0,
      approvalRouteEligible,
      loading:effectiveLoading,
      blocker:currentBlocker,
      rateLimit:currentRateLimit,
      retryableError,
      // A matching URL is only the route boundary. The task marker on the
      // latest user turn is the message boundary; both are required before
      // reading Stop, approval cards, or an assistant reply.
      routeOwned,
      owned:Boolean(routeOwned && (turn.owned || visibleReviewFinal)),
      foreignTaskId:routeOwned && !turn.owned && !visibleReviewFinal ? (foreignTask?.id || '') : '',
      text:visibleReviewFinal ? visibleReviewText : turn.text,
      // Final UI/text is completion evidence only after taskTurnForInspection
      // has proved ownership. An unowned final-looking response must not block
      // the bounded Review no-final settlement timer.
      final:Boolean(
        (turn.owned && (turn.final || structuredReviewFinal))
        || visibleReviewFinal
      ),
      responseActions:turn.responseActions,
      responseActionsComplete:turn.responseActionsComplete,
      explicitFinal:turn.explicitFinal,
      recoveredStaticCandidate:Boolean(turn.recoveredStaticCandidate),
      naturalFinalCandidate,
      terminalEmptyReply,
      recoveredStaticStaleLoadingEnd,
      routeEndedOwned,
      activityText,
      activityTextStableSince,
      userBoundaryKey,
      composerReady,
      composerEmpty,
      composerHasRecoveryDraft,
      rawLoading,
      conversationTail,
      // A current-turn streaming/busy marker is stronger evidence than the
      // temporary disappearance of Stop. Once final is true we intentionally
      // ignore a stale streaming marker so completed replies are not held.
      streaming:activityStreaming,
      sentAt:task.sentAt,
    };
    const progressSignature = stalledProgressSignature(sample);
    const progressUnchanged = previous?.progressSignature === progressSignature;
    const progressSince = progressUnchanged && Number.isFinite(Number(previous.progressSince))
      ? Number(previous.progressSince)
      : now;
    const stalledFor = progressUnchanged ? now - progressSince : 0;
    const transcriptHash = stalledConversationContentHash(sample);
    let stalledCounterChanged = false;
    if (previous && !progressUnchanged && Number(task.stalledRefreshAttempts || 0) > 0) {
      task.stalledRefreshAttempts = 0;
      task.stalledRefreshAt = 0;
      task.stalledRefreshProgressHash = transcriptHash;
      stalledCounterChanged = true;
    } else if (previous && progressUnchanged && task.stalledRefreshProgressHash && transcriptHash) {
      if (task.stalledRefreshProgressHash !== transcriptHash) {
        task.stalledRefreshAttempts = 0;
        task.stalledRefreshAt = 0;
      }
      task.stalledRefreshProgressHash = '';
      stalledCounterChanged = true;
    }
    if (stalledCounterChanged) save();
    const abnormalNoFinalEligible = Boolean(
      sample.routeOwned
      && (sample.owned || sample.routeEndedOwned)
      && !sample.final
      && !sample.naturalFinalCandidate
      && (!sample.recoveredStaticCandidate || Boolean(cacheRetry) || sample.recoveredStaticStaleLoadingEnd)
      && !cacheRetryAttempted
      && !sample.stop
      && !sample.streaming
      && !sample.cards
      // pageLoadingState() intentionally scans broad ChatGPT surfaces and can
      // see stale/decorative progress UI from tool history. For an owned
      // conversation, the enabled composer plus no Stop/streaming/cards is the
      // authoritative idle signal. sample.loading remains conversation-scoped.
      && !sample.loading
      && !sample.rateLimit
      && !sample.blocker
      && sample.composerReady
      && sample.composerEmpty
      && !task.attempted,
    );
    let abnormalNoFinalChanged = false;
    if (!abnormalNoFinalEligible) {
      if (task.abnormalNoFinalSince || task.abnormalNoFinalSignature) {
        task.abnormalNoFinalSince = 0;
        task.abnormalNoFinalSignature = '';
        abnormalNoFinalChanged = true;
      }
    } else if (task.abnormalNoFinalSignature !== progressSignature) {
      task.abnormalNoFinalSignature = progressSignature;
      task.abnormalNoFinalSince = staleActivityStreaming ? activityTextStableSince : now;
      abnormalNoFinalChanged = true;
    } else if (!Number(task.abnormalNoFinalSince || 0)) {
      task.abnormalNoFinalSince = now;
      abnormalNoFinalChanged = true;
    }
    if (abnormalNoFinalChanged) save();
    const abnormalNoFinalFor = abnormalNoFinalEligible
      ? Math.max(0, now - Number(task.abnormalNoFinalSince || now))
      : 0;
    const endedNoFinalStabilityMs = task.phase === 'review'
      ? REVIEW_ENDED_NO_FINAL_STABILITY_MS
      : ENDED_NO_FINAL_STABILITY_MS;
    const stallEligible = Boolean(
      sample.routeOwned
      && pageBelongsToTask
      && !sample.final
      && !sample.rateLimit
      && !sample.blocker
      && !sample.cards
      && !task.attempted
      && !abnormalNoFinalEligible
      && stalledFor >= STALLED_REFRESH_MS,
    );
    const pageGenerationActive = activeAssistantGeneration();
    const visibleMessagesMounted = visibleConversationHasMessages();
    if (visibleMessagesMounted && task.rendererRecoveryExhausted) {
      resetRendererRecoveryState(task);
      save();
    }
    const identityMismatchSince = sample.routeOwned && !sample.owned
      ? (visibleMessagesMounted ? 0 : (pageGenerationActive ? now : (previous?.identityMismatchSince || now)))
      : 0;
    if (identityMismatchSince && !pageGenerationActive && now - identityMismatchSince >= ROUTE_HYDRATION_TIMEOUT_MS) {
      let target;
      try { target = safeURL(task.url); } catch { target = null; }
      if (target && !task.rendererRecoveryExhausted) {
        recoverStalledRoute(target, task);
        observations.set(task.id, {
          ...(previous || {}),
          text:sample.text,
          identityMismatchSince,
          since:now,
          clear:false,
        });
        return;
      }
    }
    const result = classify(sample, previous, now);
    const clear = !sample.stop && !sample.streaming && !sample.cards && !sample.loading;
    const stable = previous?.text === sample.text && previous?.clear && clear;
    const finalSince = sample.final && previous?.final && previous?.text === sample.text
      ? (previous.finalSince || previous.since || now)
      : sample.final ? now : 0;
    const recoveredStaticSince = sample.recoveredStaticCandidate
      && previous?.recoveredStaticCandidate
      && previous?.text === sample.text
        ? (previous.recoveredStaticSince || previous.since || now)
        : sample.recoveredStaticCandidate ? now : 0;
    const naturalFinalSince = sample.naturalFinalCandidate
      && previous?.naturalFinalCandidate
      && previous?.text === sample.text
        ? (previous.naturalFinalSince || previous.since || now)
        : sample.naturalFinalCandidate ? now : 0;
    observations.set(task.id, {
      text:sample.text,
      since:stable ? previous.since : now,
      idleSince:previous?.clear ? previous.idleSince : now,
      final:Boolean(sample.final),
      finalSince,
      recoveredStaticCandidate:Boolean(sample.recoveredStaticCandidate),
      recoveredStaticSince,
      naturalFinalCandidate:Boolean(sample.naturalFinalCandidate),
      naturalFinalSince,
      stop:Boolean(sample.stop),
      streaming:Boolean(sample.streaming),
      loading:Boolean(sample.loading),
      routeEndedOwned:Boolean(sample.routeEndedOwned),
      activityText:String(sample.activityText || ''),
      activityTextStableSince,
      userBoundaryKey:String(sample.userBoundaryKey || ''),
      composerEmpty:Boolean(sample.composerEmpty),
      clear,
      identityMismatchSince,
      progressSignature,
      progressSince,
    });
    const inspectionMs = performance.now() - begin;
    measurements.scans++; measurements.totalScanMs += inspectionMs;
    if (inspectionMs >= SLOW_SCAN_DIAGNOSTIC_THRESHOLD_MS
      && Date.now() - lastSlowScanDiagnosticAt >= SLOW_SCAN_DIAGNOSTIC_INTERVAL_MS) {
      lastSlowScanDiagnosticAt = Date.now();
      const otherMs = Math.max(0, inspectionMs - turnInspectionMs - authorizationScanMs - loadingScanMs - fingerprintMs);
      const stats = turn.diagnostic || {};
      log(task, `慢扫描诊断（仅耗时与计数，不含消息内容）：总计 ${inspectionMs.toFixed(0)} ms；当前回复识别 ${turnInspectionMs.toFixed(0)} ms；授权卡扫描 ${authorizationScanMs.toFixed(0)} ms；加载检测 ${loadingScanMs.toFixed(0)} ms；进度指纹 ${fingerprintMs.toFixed(0)} ms；其余检查 ${otherMs.toFixed(0)} ms。消息节点 user=${Number(stats.userNodes || 0)}、assistant=${Number(stats.assistantNodes || 0)}；回复文本读取 ${Number(stats.inspectedTextChars || 0)} 字${stats.boundedStreamRead ? '（流式有界尾读）' : ''}；指纹消息=${fingerprintStats.messageNodes}、工作步骤=${Number(fingerprintStats.activityNodes || 0)}、指纹字符=${fingerprintStats.inspectedTextChars}；页面文字扫描 calls=${scanDiagnostics.pageUiCalls}、耗时=${scanDiagnostics.pageUiMs.toFixed(0)} ms、遍历节点=${scanDiagnostics.pageUiVisited}、文本节点=${scanDiagnostics.pageUiTextNodes}；请求限制检测 calls=${scanDiagnostics.rateLimitCalls}、耗时=${scanDiagnostics.rateLimitMs.toFixed(0)} ms、历史提示祖先检查=${scanDiagnostics.rateLimitAncestorChecks}；当前回复文本扫描 calls=${scanDiagnostics.responseCalls}、耗时=${scanDiagnostics.responseMs.toFixed(0)} ms、文本节点=${scanDiagnostics.responseTextNodes}；授权候选按钮=${scanDiagnostics.cardsCandidates}/${scanDiagnostics.cardsButtons}、授权扫描内部耗时=${scanDiagnostics.cardsMs.toFixed(0)} ms。`);
    }
    if (sample.owned && task.preview !== sample.text) {
      task.preview = sample.text.slice(-6000);
      task.previewSourceURL = liveURL;
      task.previewPhase = String(task.phase || 'work');
      task.previewRound = Number(task.round || 0);
      paint(); // Live preview is transient; streaming does not write localStorage.
    }
    if (abnormalNoFinalEligible
      && abnormalNoFinalFor >= endedNoFinalStabilityMs
      && now - Number(task.continuationSentAt || 0) >= CONTINUATION_SEND_COOLDOWN_MS) {
      if (cacheRetry) {
        task.streamCacheRetryKey = cacheRetryKey;
        task.abnormalNoFinalSince = 0;
        task.abnormalNoFinalSignature = '';
        task.state = 'waiting';
        save();
        activateControl(cacheRetry);
        log(task, '检测到 Stream cache expired：本轮异常结束，已在当前会话点击重试，等待恢复。');
        return;
      }
      const reason = sample.retryableError
        ? `检测到当前会话出现可重试错误、且停止生成已结束但没有最终回复${rawLoading || activityTurn?.streaming ? '（已忽略错误卡片残留的加载/流式状态）' : ''}`
        : '检测到当前会话已经结束但没有最终回复';
      if (queueInterruptedFreshRetry(task, reason, now, routeEndedOwned ? activityTurn : turn, { allowExactRouteFallback:true })) return;
    }
    if (stallEligible && refreshStalledConversation(task, true, now, { sample, turn:routeEndedOwned ? activityTurn : turn })) return;
    if (result.state === 'complete') { finish(task, sample.text); return; }
    if (result.state === 'cooldown') {
      restForRateLimit(task);
      return;
    }
    if (result.state === 'no-final-reply') {
      queueNoFinalReplyRetry(task, result.reason);
      return;
    }
    if (result.state === 'blocked') throw new Error(result.reason);
    state(task, result.state);
    if (result.state === 'approval' && data.autoApprove) {
      const approved = await authorize(pending[0], task, signal);
      const approvalRefreshNow = Date.now();
      if (!approved
        && !sample.final
        && !sample.rateLimit
        && !sample.blocker
        && !approvalSettlementActive(task, liveURL, approvalRefreshNow)
        && refreshUnavailableApproval(task, true, approvalRefreshNow)) return;
    }
  }
