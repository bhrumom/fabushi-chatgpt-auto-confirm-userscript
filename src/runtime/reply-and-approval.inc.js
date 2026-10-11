  function assistantTurnContent(roleNode, { tailLimit = 0 } = {}) {
    const messageUnit = conversationMessageUnit(roleNode, 'assistant');
    const fallbackUnit = contentSearchUnitRole(messageUnit) === 'assistant' ? messageUnit : null;
    const transientPrimary = !fallbackUnit
      && messageUnit?.matches?.('[data-markdown-text-style="assistant-message"][data-markdown-text-tone="primary"]')
      && messageUnit.closest?.(contentSearchTurnSelector)
        ? messageUnit
        : null;
    const turn = fallbackUnit || transientPrimary || roleNode?.closest?.(conversationTurnSelector);
    if (!turn || own(turn) || turn.closest?.('[hidden],[inert]')) return assistantSegmentContent(roleNode, { tailLimit });
    // The live fallback-turn renderer puts user and assistant units inside one
    // outer content-search turn. Never expand an assistant read to that shared
    // outer turn; rich user Markdown in the same turn would be misattributed
    // as assistant output. Legacy renderers can still expose agent progress as
    // Markdown siblings of a role host, so they retain the old turn scope.
    const semantic = nodes('.markdown,[data-message-content],[data-selected-text-overlay-target],[data-markdown-text-style="assistant-message"]', turn)
      .filter(node => !node.closest?.(`[hidden],[inert],[data-message-author-role="user"],[data-turn="user"],[data-author-role="user"],[data-content-search-unit-key$=":user"],[data-chatgpt-search-unit-key$=":user"],[data-user-message-bubble="true"],[data-markdown-text-tone="user-message"],[data-testid*="tool"],[data-type*="tool"],[class*="tool-call"],[class*="toolCall"]`));
    const roots = outermostSemanticRoots(semantic).filter(visible);
    let remaining = tailLimit;
    const content = roots.map(node => {
      const value = tailLimit ? textTail(node, remaining) : String(node.textContent || '');
      if (tailLimit) remaining = Math.max(0, remaining - value.length);
      return value.trim();
    }).filter(Boolean).join('\n\n').trim();
    return content || assistantSegmentContent(fallbackUnit || roleNode, { tailLimit });
  }
  function visibleAssistantWorkTranscript(task, { allowExactRouteFallback = false } = {}) {
    if (!task) return { text:'', sourceKind:'' };
    const liveURL = canonicalConversationURL(currentConversationURL());
    const taskURL = canonicalConversationURL(task.url);
    if (!liveURL || !taskURL || liveURL !== taskURL) return { text:'', sourceKind:'' };

    const users = conversationRoleNodes('user');
    const markedUser = taskMarkerUser(task);
    const latestUser = users.at(-1);
    const continuationUser = markedUser
      && latestUser
      && latestUser !== markedUser
      && Number(task.continuationCount || 0) > 0
      && normalize(text(latestUser)) === CONTINUATION_PROMPT
      && Boolean(markedUser.compareDocumentPosition(latestUser) & Node.DOCUMENT_POSITION_FOLLOWING)
        ? latestUser
        : null;
    const ownedBoundary = continuationUser || markedUser;
    let boundary = ownedBoundary;
    let sourceKind = 'owned-visible-assistant-transcript';

    if (boundary) {
      // If another user turn is newer than this task boundary, do not copy any
      // following assistant text/activity into this task. This mirrors
      // latestTurn(task) and keeps manual/foreign follow-up turns fail-closed.
      if (latestUser && latestUser !== boundary) return { text:'', sourceKind:'' };
    } else {
      if (!allowExactRouteFallback) return { text:'', sourceKind:'' };
      const foreignTask = tabTasks().find(item => item.id !== task.id && item.token && hasTaskMarker(item));
      const otherOwner = conversationURLOwner(liveURL, task.id);
      if (foreignTask || otherOwner) return { text:'', sourceKind:'' };
      // Preserve the safety level of the existing exact-route latestTurn()
      // fallback: when the task marker is virtualized, the last mounted user
      // turn becomes the response boundary. The current content-search turn is
      // resolved below from the latest assistant/activity node rather than
      // trusting that older visible user turn as the current turn container.
      boundary = latestUser || null;
      sourceKind = 'exact-route-visible-assistant-transcript';
    }

    const followsBoundary = node => !boundary
      || Boolean(boundary.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
    let assistantNodes = conversationRoleNodes('assistant')
      // The role host itself may be layout-neutral. assistantSegmentContent()
      // decides visibility from semantic/rendered descendants.
      .filter(followsBoundary);
    let activityNodes = nodes(assistantActivitySelector)
      .filter(node => visible(node) && followsBoundary(node));

    // In the current fallback renderer one logical user+agent response lives
    // inside a shared data-content-search-turn-key. Marker-owned turns can use
    // that exact container directly. If the marker has been virtualized, use
    // only the latest visible assistant/activity node's content-search turn so
    // older response activity from the same long conversation cannot leak
    // into this abnormal carry.
    const candidates = [...assistantNodes, ...activityNodes];
    candidates.sort((a, b) => {
      if (a === b) return 0;
      const position = a.compareDocumentPosition(b);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    const ownedBoundaryTurn = ownedBoundary?.closest?.(contentSearchTurnSelector) || null;
    const ownedTurnHasResponse = Boolean(
      ownedBoundaryTurn
      && candidates.some(node => node.closest?.(contentSearchTurnSelector) === ownedBoundaryTurn)
    );
    // Shared-turn renderer: the marker-bearing user and response are in the
    // same outer turn. Other renderer variants may put user and assistant in
    // separate content-search turns, so only trust the user's turn container
    // when it actually contains current assistant/activity evidence.
    let responseTurn = ownedTurnHasResponse
      ? ownedBoundaryTurn
      : candidates.at(-1)?.closest?.(contentSearchTurnSelector) || null;
    if (responseTurn) {
      assistantNodes = assistantNodes.filter(node => node.closest?.(contentSearchTurnSelector) === responseTurn);
      activityNodes = activityNodes.filter(node => node.closest?.(contentSearchTurnSelector) === responseTurn);
    }

    const entries = [];
    const seenMessages = new Set();
    const assistantMessageUnits = [];
    for (const node of assistantNodes) {
      const messageUnit = conversationMessageUnit(node, 'assistant') || node;
      if (seenMessages.has(messageUnit)) continue;
      seenMessages.add(messageUnit);
      assistantMessageUnits.push(messageUnit);
      const value = cleanAbnormalFreshReply(assistantTurnContent(messageUnit));
      if (value) entries.push({ node:messageUnit, text:value, kind:'reply' });
    }
    for (const node of activityNodes) {
      // Some legacy assistant containers already include their tertiary
      // summaries inside assistantTurnContent(). Add standalone activity only
      // when it is not nested under an already captured canonical message.
      if (assistantMessageUnits.some(unit => unit !== node && unit.contains?.(node))) continue;
      const value = cleanAbnormalFreshReply(text(node));
      if (!value) continue;
      if (entries.some(entry => entry.kind === 'reply' && String(entry.text || '').includes(value))) continue;
      entries.push({ node, text:value, kind:'activity' });
    }
    entries.sort((a, b) => {
      if (a.node === b.node) return 0;
      const position = a.node.compareDocumentPosition(b.node);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    const parts = [];
    for (const entry of entries) {
      const value = String(entry.text || '').trim();
      if (!value) continue;
      if (parts.at(-1) === value || parts.includes(value)) continue;
      parts.push(value);
    }
    return {
      text: boundedConversationLengthCarry(parts.join('\n\n').trim()),
      sourceKind: parts.length ? sourceKind : '',
    };
  }
  function persistHandoffReplySnapshot(task, { allowExactRouteFallback = true, now = Date.now() } = {}) {
    if (!task || terminal.has(task.state) || task.state === 'paused') return false;
    const liveURL = canonicalConversationURL(currentConversationURL());
    const taskURL = canonicalConversationURL(task.url);
    if (!liveURL || !taskURL || liveURL !== taskURL) return false;
    const transcript = visibleAssistantWorkTranscript(task, { allowExactRouteFallback });
    let sourceText = String(transcript.text || '').trim();
    if (!sourceText
      && String(task.preview || '').trim()
      && canonicalConversationURL(task.previewSourceURL) === liveURL
      && String(task.previewPhase || '') === String(task.phase || '')
      && Number(task.previewRound || 0) === Number(task.round || 0)) {
      sourceText = String(task.preview || '').trim();
    }
    if (!sourceText) {
      const fallback = taskTurnForInspection(task);
      if (fallback?.owned) sourceText = String(fallback.text || '').trim();
    }
    const snapshot = cleanAbnormalFreshReply(sourceText);
    if (!snapshot) return false;
    const changed = snapshot !== String(task.handoffReplySnapshot || '')
      || canonicalConversationURL(task.handoffReplySnapshotSourceURL) !== liveURL
      || String(task.handoffReplySnapshotPhase || '') !== String(task.phase || '')
      || Number(task.handoffReplySnapshotRound || 0) !== Number(task.round || 0)
      || Number(task.handoffReplySnapshotGoalRevision || 0) !== Number(task.goalRevision || 0);
    task.handoffReplySnapshot = snapshot;
    task.handoffReplySnapshotSourceURL = liveURL;
    task.handoffReplySnapshotPhase = String(task.phase || 'work');
    task.handoffReplySnapshotRound = Number(task.round || 0);
    task.handoffReplySnapshotGoalRevision = Number(task.goalRevision || 0);
    task.handoffReplySnapshotAt = now;
    if (changed && now - Number(task.recentActivitySnapshotLoggedAt || 0) >= 60_000) {
      task.recentActivitySnapshotLoggedAt = now;
      recordRecentActivity(task, {
        at:now,
        role:'assistant',
        text:`最近可见工作内容快照\n${snapshot.slice(0, MAX_TASK_MESSAGE_TEXT)}`,
      }, now);
    }
    return changed;
  }
  function captureOwnedAbnormalFreshCarry(task, turn = null, reason = '', sessionURL = '', now = Date.now(), { allowExactRouteFallback = false } = {}) {
    if (!task) return '';
    const liveURL = canonicalConversationURL(sessionURL || currentConversationURL());
    const taskURL = canonicalConversationURL(task.url);
    if (!liveURL || !taskURL || liveURL !== taskURL) return '';

    // Refresh a durable task-scoped snapshot before clearing this dispatch.
    // This gives a later fresh prompt a pagehide/reload-safe fallback even when
    // the current renderer only partially rehydrates the assistant DOM.
    persistHandoffReplySnapshot(task, { allowExactRouteFallback, now });
    // A single ChatGPT agent response can be rendered as several assistant
    // segments. Capture the whole visible current-response transcript before
    // falling back to the legacy latest-turn text so a final status-only/error
    // segment cannot hide the substantive work that is visibly above it.
    const transcript = visibleAssistantWorkTranscript(task, { allowExactRouteFallback });
    let sourceText = String(transcript.text || '');
    let sourceKind = String(transcript.sourceKind || '');

    // Preferred legacy source: the normal marker-owned latest turn. Keep this
    // fallback because some renderer builds briefly mount only one assistant
    // node without a measurable client rect while the interruption is handled.
    const ownedTurn = turn?.owned ? turn : latestTurn(task);
    if (!sourceText && ownedTurn?.owned) {
      sourceText = String(ownedTurn.text || '');
      sourceKind = sourceText ? 'owned-turn' : '';
    }

    // A preview is only safe when it was produced by a previously owned scan
    // of this exact route and the same phase/round.
    if (!sourceText
      && String(task.preview || '').trim()
      && canonicalConversationURL(task.previewSourceURL) === liveURL
      && String(task.previewPhase || '') === String(task.phase || '')
      && Number(task.previewRound || 0) === Number(task.round || 0)) {
      sourceText = String(task.preview || '');
      sourceKind = 'owned-preview';
    }

    if (!sourceText) {
      const durableSnapshot = handoffReplySnapshotForCurrentPhase(task);
      if (durableSnapshot) {
        sourceText = durableSnapshot;
        sourceKind = 'durable-handoff-snapshot';
      }
    }

    // Retain the old exact-route latest-turn fallback as a final compatibility
    // path. It is reached only after the stricter transcript extractor and only
    // when the same no-foreign-owner/no-foreign-marker guards pass.
    if (!sourceText && allowExactRouteFallback) {
      const foreignTask = tabTasks().find(item => item.id !== task.id && item.token && hasTaskMarker(item));
      const otherOwner = conversationURLOwner(liveURL, task.id);
      if (!foreignTask && !otherOwner) {
        const routeTurn = latestTurn();
        sourceText = String(routeTurn?.text || '');
        if (sourceText) sourceKind = 'exact-route-latest-assistant';
      }
    }

    const carry = cleanAbnormalFreshReply(sourceText);
    if (!carry) return '';
    task.abnormalFreshCarry = carry;
    task.abnormalFreshCarrySourceURL = liveURL;
    task.abnormalFreshCarryReason = String(reason || '').slice(0, 1000);
    task.abnormalFreshCarryPhase = String(task.phase || 'work');
    task.abnormalFreshCarryRound = Number(task.round || 0);
    task.abnormalFreshCarryAt = now;
    task.abnormalFreshCarrySourceKind = sourceKind;
    return carry;
  }
  function queueInterruptedFreshRetry(task, reason = '检测到“连接已中断，正在等待完整回复”', now = Date.now(), turn = null, options = {}) {
    if (!task || terminal.has(task.state) || task.state === 'paused') return false;
    const sessionURL = currentConversationURL() || canonicalConversationURL(task.url);
    if (sessionURL) {
      recordConversationURL(task, sessionURL);
      task.history ||= [];
      task.history.push({
        url:sessionURL,
        phase:task.phase,
        round:task.round,
        reason:String(options.historyReason || 'connection-interrupted-fresh-chat'),
      });
      task.history = task.history.slice(-40);
    }
    const recoveryCount = options.recoveryLabel
      ? Math.min(3, Number(task.stalledRefreshAttempts || 0) + 1)
      : Number(task.connectionInterruptedFreshRetryCount || 0) + 1;
    const carry = captureOwnedAbnormalFreshCarry(task, turn, reason, sessionURL, now, options);
    clearDispatchIntent(task);
    if (!options.recoveryLabel) task.connectionInterruptedFreshRetryCount = recoveryCount;
    task.connectionInterruptedFreshDispatch = true;
    task.noFinalReplyRecoveryUntil = 0;
    task.cooldownUntil = 0;
    task.navigationGuardRetryAt = 0;
    task.state = 'queued';
    task.updatedAt = now;
    delete task.pausedState;
    sameRouteWaitUntil = 0;
    sameRouteWaitSince = 0;
    observations.delete(task.id);
    const carrySourceNote = String(task.abnormalFreshCarrySourceKind || '').startsWith('exact-route-')
      ? '已在任务标识被页面虚拟化后，通过当前任务精确 conversation URL 回退读取最新 assistant 工作内容；'
      : task.abnormalFreshCarrySourceKind === 'owned-preview'
        ? '已从本任务此前确认归属的实时预览恢复 assistant 工作内容；'
        : task.abnormalFreshCarrySourceKind === 'durable-handoff-snapshot'
          ? '已从刷新前持久化的本任务 assistant 回复快照恢复工作内容；'
          : carry
          ? '已保存异常会话当前可见的 ChatGPT 实时工作记录（可见回复 + 实际工作步骤）；'
          : '当前异常会话没有可安全提取的 assistant 工作内容；';
    const recoveryLabel = options.recoveryLabel
      ? `${options.recoveryLabel}第 ${recoveryCount} 次`
      : `连接中断自动恢复第 ${recoveryCount} 次`;
    log(task, `${reason}；已结束当前故障会话派发并切换到新的 ChatGPT 会话恢复当前${task.phase === 'review' ? '规划/验收' : 'Work'}阶段（${recoveryLabel}）。${carrySourceNote}${carry ? '新会话提示词会把可见回复和实际工作步骤作为已完成工作现场一起继续承接；' : ''}保留任务、phase、round、目标/next 和附件；新会话会生成新的发送标识与会话链接，不会在故障旧会话重复发送“${CONTINUATION_PROMPT}”。`);
    save();
    return true;
  }
  function visibleConversationProgressFingerprint() {
    // Task ownership can be temporarily unavailable while ChatGPT virtualizes
    // a user marker. Progress detection must still notice newly rendered reply
    // prose AND visible agent/work activity without using either as task-owned
    // result/completion evidence. Tertiary activity intentionally stays
    // outside conversationRoleNodes(); it is progress-only evidence here.
    // Keep this bounded to the visible transcript tail to limit scan cost on
    // long conversations.
    const allMessageNodes = conversationRoleNodes();
    const renderedMessageNodes = allMessageNodes.filter(renderedConversationMessage);
    const messageNodes = renderedMessageNodes.slice(-8);
    const activityNodes = nodes(assistantActivitySelector)
      .filter(node => visible(node)
        && !renderedMessageNodes.some(message => message !== node && message.contains?.(node)))
      .slice(-8);
    const progressNodes = [
      ...messageNodes.map(node => ({ node, role:conversationRole(node) })),
      ...activityNodes.map(node => ({ node, role:'assistant-activity' })),
    ];
    progressNodes.sort((a, b) => {
      if (a.node === b.node) return 0;
      const position = a.node.compareDocumentPosition(b.node);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    let inspectedTextChars = 0;
    const fingerprint = progressNodes.slice(-12).map(({ node, role }) => {
      const rawTail = textTail(node, 3000);
      inspectedTextChars += rawTail.length;
      const content = rawTail.replace(/\s+/g, ' ').trim();
      return {
        role,
        id:node.getAttribute('data-message-id')
          || node.getAttribute('data-selected-text-overlay-target')
          || node.getAttribute('data-content-search-unit-key')
          || '',
        text:content,
        streaming:node.getAttribute('data-is-streaming') || '',
        busy:node.getAttribute('aria-busy') || '',
      };
    });
    lastFingerprintStats = {
      messageNodes:allMessageNodes.length,
      activityNodes:activityNodes.length,
      inspectedTextChars,
    };
    return fingerprint;
  }
  function stalledProgressSignature(sample) {
    return JSON.stringify({
      text:String(sample?.text || '').slice(-6000),
      final:Boolean(sample?.final),
      responseActions:[...(sample?.responseActions || [])].sort(),
      responseActionsComplete:Boolean(sample?.responseActionsComplete),
      explicitFinal:Boolean(sample?.explicitFinal),
      streaming:Boolean(sample?.streaming),
      stop:Boolean(sample?.stop),
      cards:Number(sample?.cards || 0),
      loading:Boolean(sample?.loading),
      blocker:String(sample?.blocker || ''),
      rateLimit:String(sample?.rateLimit || ''),
      retryableError:Boolean(sample?.retryableError),
      owned:Boolean(sample?.owned),
      routeOwned:Boolean(sample?.routeOwned),
      foreignTaskId:String(sample?.foreignTaskId || ''),
      recoveredStaticCandidate:Boolean(sample?.recoveredStaticCandidate),
      naturalFinalCandidate:Boolean(sample?.naturalFinalCandidate),
      routeEndedOwned:Boolean(sample?.routeEndedOwned),
      activityText:String(sample?.activityText || '').slice(-6000),
      userBoundaryKey:String(sample?.userBoundaryKey || ''),
      composerReady:Boolean(sample?.composerReady),
      composerEmpty:Boolean(sample?.composerEmpty),
      composerHasRecoveryDraft:Boolean(sample?.composerHasRecoveryDraft),
      rawLoading:Boolean(sample?.rawLoading),
      // Unlike sample.text/activityText, this page-tail evidence deliberately
      // survives temporary task-marker ownership gaps. It only resets the
      // no-change clock; it never authorizes completion or continuation.
      conversationTail:sample?.conversationTail || [],
    });
  }
  function stalledConversationContentHash(sample) {
    const tail = Array.isArray(sample?.conversationTail) ? sample.conversationTail.slice(-12) : [];
    if (!tail.some(item => String(item?.text || '').trim())) return '';
    // Persist only a compact checksum, never the transcript used for recovery.
    const source = JSON.stringify(tail.map(item => ({
      role:String(item?.role || ''),
      id:String(item?.id || ''),
      text:String(item?.text || '').slice(-3000),
    }))).slice(-24_000);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function refreshStalledConversation(task, perform = true, now = Date.now(), options = {}) {
    if (!task || task.state === 'paused' || task.state === 'cancelled' || (task.attempted && options.force !== true)) return false;
    const conversationURL = currentConversationURL() || canonicalConversationURL(task.url);
    const taskURL = canonicalConversationURL(task.url);
    if (!conversationURL || !taskURL || conversationURL !== taskURL) return false;
    if (Number(task.cooldownUntil || 0) > now) return false;
    if (task.stalledRefreshURL !== conversationURL) {
      task.stalledRefreshURL = conversationURL;
      task.stalledRefreshAttempts = 0;
      task.stalledRefreshAt = 0;
      task.stalledRefreshExhausted = false;
    }
    const attempts = Number(task.stalledRefreshAttempts || 0);
    // Clear the old terminal-looking marker; the persisted attempt count is
    // now the consecutive no-progress window count.
    if (task.stalledRefreshExhausted) {
      task.stalledRefreshExhausted = false;
      task.state = 'waiting';
      log(task, '已迁移旧版停滞恢复计数；连续无进展达到三段 5 分钟后将转入新会话接力。');
      save();
    }
    if (now - Number(task.stalledRefreshAt || 0) < STALLED_REFRESH_COOLDOWN_MS) return false;
    if (attempts >= 2 && options.allowUnlimitedRefresh !== true) {
      return queueInterruptedFreshRetry(
        task,
        '当前会话连续三段 5 分钟没有可见进展',
        now,
        options.turn || null,
        { allowExactRouteFallback:true, recoveryLabel:'连续停滞接力' },
      );
    }
    const nextAttempt = attempts + 1;
    task.stalledRefreshAttempts = nextAttempt;
    task.stalledRefreshAt = now;
    task.stalledRefreshProgressHash = stalledConversationContentHash(options.sample);
    task.stalledRefreshExhausted = false;
    task.state = 'waiting';
    observations.delete(task.id);
    log(task, options.message || `当前会话连续 5 分钟没有可见变化；正在刷新当前页面（第 ${nextAttempt}/2 次），保留会话、发送标识、附件和当前阶段，不会重复发送。若连续三段 5 分钟仍无进展，将在当前标签页新开会话并接力已完成的工作。`);
    save();
    if (!perform) return true;
    navigating = true;
    try { location.reload(); } catch (error) {
      navigating = false;
      task.state = 'waiting';
      log(task, `停滞会话刷新失败：${error.message}；已保留当前任务，5 分钟后继续尝试。`);
      save();
      return false;
    }
    return true;
  }
  function recoverConversationLoadFailure(task, perform = true, now = Date.now(), turn = null) {
    if (!task || task.state === 'paused' || task.state === 'cancelled' || task.attempted) return false;
    const conversationURL = currentConversationURL() || canonicalConversationURL(task.url);
    const taskURL = canonicalConversationURL(task.url);
    if (!conversationURL || !taskURL || conversationURL !== taskURL) {
      if (clearConversationLoadFailureState(task)) save();
      return false;
    }
    if (task.conversationLoadFailureURL !== conversationURL) {
      task.conversationLoadFailureURL = conversationURL;
      task.conversationLoadFailureAttempts = 0;
      task.conversationLoadFailureAt = now;
      task.state = 'waiting';
      task.updatedAt = now;
      log(task, `检测到 ChatGPT 当前会话无法加载；先等待 ${Math.ceil(CONVERSATION_LOAD_FAILURE_RETRY_MS / 1000)} 秒，再刷新同一会话。最多刷新 ${CONVERSATION_LOAD_FAILURE_REFRESH_LIMIT} 次；仍无法恢复时将新开会话并接力当前任务，不会在故障旧会话重复发送。`);
      save();
      return true;
    }
    const attempts = Number(task.conversationLoadFailureAttempts || 0);
    if (attempts >= CONVERSATION_LOAD_FAILURE_REFRESH_LIMIT) {
      return queueInterruptedFreshRetry(
        task,
        `ChatGPT 当前会话连续 ${CONVERSATION_LOAD_FAILURE_REFRESH_LIMIT} 次刷新后仍无法加载`,
        now,
        turn,
        { allowExactRouteFallback:true, recoveryLabel:'会话加载失败接力', historyReason:'conversation-load-failure-fresh-chat' },
      );
    }
    const lastAt = Number(task.conversationLoadFailureAt || 0);
    if (lastAt && now - lastAt < CONVERSATION_LOAD_FAILURE_RETRY_MS) {
      task.state = 'waiting';
      return true;
    }
    const nextAttempt = attempts + 1;
    task.conversationLoadFailureAttempts = nextAttempt;
    task.conversationLoadFailureAt = now;
    task.state = 'waiting';
    task.updatedAt = now;
    observations.delete(task.id);
    log(task, `ChatGPT 当前会话仍无法加载；正在刷新当前会话（第 ${nextAttempt}/${CONVERSATION_LOAD_FAILURE_REFRESH_LIMIT} 次）。每次至少间隔 ${Math.ceil(CONVERSATION_LOAD_FAILURE_RETRY_MS / 1000)} 秒；不会重复发送任务。`);
    save();
    if (!perform) return true;
    navigating = true;
    try { location.reload(); } catch (error) {
      navigating = false;
      task.state = 'waiting';
      log(task, `会话加载失败刷新未提交：${error.message}；已保留任务，将按 30 秒间隔继续重试。`);
      save();
      return false;
    }
    return true;
  }
  function dispatchCooldownRemaining(now = Date.now()) {
    return Math.max(0, Number(data.lastDispatchAt || 0) + MIN_SEND_INTERVAL_MS - now);
  }
  function restForRateLimit(task, now = Date.now()) {
    const previousCooldownUntil = Number(task.cooldownUntil || 0);
    const newEpisode = previousCooldownUntil <= now;
    if (newEpisode) task.rateLimitEpisodes = Number(task.rateLimitEpisodes || 0) + 1;
    if (newEpisode && Number(task.rateLimitEpisodes || 0) > RATE_LIMIT_FRESH_RETRY_AFTER) {
      const episodes = Number(task.rateLimitEpisodes || 0);
      const carry = captureOwnedAbnormalFreshCarry(task, null, '请求过于频繁升级为 fresh-chat 恢复', '', now);
      clearDispatchIntent(task);
      task.rateLimitEpisodes = 0;
      task.cooldownUntil = 0;
      task.state = 'queued';
      delete task.pausedState;
      log(task, `检测到 ChatGPT 请求过于频繁已超过 ${RATE_LIMIT_FRESH_RETRY_AFTER} 次（第 ${episodes} 次）；已结束当前会话并切换到新的 ChatGPT 会话恢复当前任务。${carry ? '已保存异常会话当前可见的 assistant 实时回复并带入新提示词；' : ''}保留目标、阶段、轮次和附件。`);
      save();
      // Move off the rate-limited conversation immediately. If ChatGPT still
      // exposes a global rate-limit banner on the fresh root, the next scan
      // will safely wait there rather than hammering another request.
      if (location.pathname !== '/') {
        try { directNavigate(new URL('/', location.origin), task); } catch {}
      }
      return 100;
    }
    const cooldownUntil = Math.max(previousCooldownUntil, now + RATE_LIMIT_COOLDOWN_MS);
    task.cooldownUntil = cooldownUntil;
    task.state = 'waiting';
    if (newEpisode) {
      log(task, `检测到 ChatGPT 请求过于频繁（第 ${task.rateLimitEpisodes}/${RATE_LIMIT_FRESH_RETRY_AFTER} 次）；插件暂停发送、导航和刷新，预计 ${Math.ceil((cooldownUntil - now) / 60000)} 分钟后自动恢复。若超过 ${RATE_LIMIT_FRESH_RETRY_AFTER} 次将自动新开会话重发。`);
    }
    save();
    return Math.max(1, cooldownUntil - now);
  }
  function latestTurn(task = null) {
    const users = conversationRoleNodes('user');
    const scoped = Boolean(task && typeof task === 'object');
    const markedUser = scoped ? taskMarkerUser(task) : null;
    const latestUser = users.at(-1);
    // Long conversations can virtualize the original Fabushi marker turn.
    // When that happens, a recorded scripted continuation is a verifiable
    // visible boundary, but only on the exact task route and when no other
    // task owns the route or has a marker mounted in this document. The
    // assistant/toolbar checks below still decide whether its reply is final.
    const liveURL = scoped ? currentConversationURL() : '';
    const routeVirtualizedFallback = Boolean(
      scoped
      && !markedUser
      && task.attempted
      && task.token
      && latestUser
      && Number(task.continuationCount || 0) > 0
      && normalize(text(latestUser)) === CONTINUATION_PROMPT
      && liveURL
      && canonicalConversationURL(task.url) === liveURL
      && !conversationURLOwner(liveURL, task.id)
      && !tabTasks().some(item => item.id !== task.id && item.token && taskMarkerUser(item)),
    );
    // Recovery continuations intentionally do not repeat the Fabushi task
    // marker. Treat the exact continuation prompt as part of the same task
    // only when it follows this task's marked user turn and this task has
    // actually recorded a continuation send.
    const continuationUser = scoped
      && markedUser
      && latestUser
      && latestUser !== markedUser
      && Number(task.continuationCount || 0) > 0
      && normalize(text(latestUser)) === CONTINUATION_PROMPT
      && Boolean(markedUser.compareDocumentPosition(latestUser) & Node.DOCUMENT_POSITION_FOLLOWING)
        ? latestUser
        : null;
    const user = scoped ? (continuationUser || markedUser || (routeVirtualizedFallback ? latestUser : null)) : latestUser;
    // A task marker (or a verified continuation after it) is necessary but not
    // sufficient: if a different user turn is newer, fail closed instead of
    // attributing that response to this task.
    const owned = !scoped || Boolean(user && user === latestUser && (
      user === markedUser
      || user === continuationUser
      || routeVirtualizedFallback
    ));
    if (scoped && !owned) {
      return {
        user: text(user),
        text: '',
        diagnostic:{ userNodes:users.length, assistantNodes:0, inspectedTextChars:0, boundedStreamRead:false },
        final: false,
        owned: false,
        responseActions: [],
        responseActionsComplete: false,
        explicitFinal: false,
        streaming: false,
        article: null,
      };
    }
    const replies = conversationRoleNodes('assistant').filter(node => !user || Boolean(user.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
    const assistant = replies.at(-1);
    const assistantUnit = conversationMessageUnit(assistant, 'assistant') || assistant;
    const fallbackAssistantUnit = contentSearchUnitRole(assistantUnit) === 'assistant' ? assistantUnit : null;
    const transientPrimaryAssistant = !fallbackAssistantUnit
      && assistantUnit?.matches?.('[data-markdown-text-style="assistant-message"][data-markdown-text-tone="primary"]')
      && assistantUnit.closest?.(contentSearchTurnSelector)
        ? assistantUnit
        : null;
    const fallbackResponseBoundary = fallbackAssistantUnit || transientPrimaryAssistant;
    // In fallback-turn DOM, content and response actions have different
    // boundaries: committed content is inside :assistant, while a currently
    // streaming primary assistant Markdown can be a direct descendant of the
    // outer turn. Copy/Share live later in that same outer turn.
    const article = fallbackResponseBoundary
      || assistant?.closest?.('article,[data-testid^="conversation-turn-"],[data-turn-key],[data-content-search-turn-key]')
      || assistant;
    const responseTurn = fallbackResponseBoundary?.closest?.(contentSearchTurnSelector) || article;
    const markdown = article?.querySelector?.('.markdown,[data-message-content],[data-selected-text-overlay-target],[data-markdown-text-style="assistant-message"]');
    const stopVisible = Boolean(stopButton());
    const streamingMarker = Boolean(article?.querySelector('[data-is-streaming="true"],[aria-busy="true"]')
      || [markdown, assistantUnit, article].some(node => node?.getAttribute?.('data-is-streaming') === 'true' || node?.getAttribute?.('aria-busy') === 'true'));
    const boundedStreamRead = stopVisible || streamingMarker;
    const content = assistantTurnContent(assistant, { tailLimit:boundedStreamRead ? STREAM_TEXT_TAIL_LIMIT : 0 });
    const naturalReplyNode = article?.querySelector?.('.markdown,[data-message-content],[data-markdown-text-style="assistant-message"]');
    const hasNaturalReply = Boolean(
      naturalReplyNode
      && hasTextNode(naturalReplyNode)
      && !naturalReplyNode.closest?.('[data-testid*="tool"],[data-type*="tool"],[class*="tool-call"],[class*="toolCall"]')
    );
    // The ChatGPT renderer changes action data-testid values and can mount the
    // action row next to (or, briefly, outside) the response article. Text
    // stability alone is not a final-answer signal, but a single fixed
    // selector is not a reliable one either. Use semantic labels, bind the
    // controls to the latest response turn, and keep the explicit static
    // marker as a second independent signal.
    const responseControlSelector = 'button,a,[role="button"]';
    const responseControlKind = node => {
      const semanticNodes = [node, ...(node?.querySelectorAll?.('svg,[data-icon],[data-testid]') || [])];
      const value = normalize(semanticNodes.flatMap(item => [
        item?.textContent,
        item?.getAttribute?.('aria-label'),
        item?.getAttribute?.('title'),
        item?.getAttribute?.('data-testid'),
        item?.getAttribute?.('data-tooltip'),
        item?.getAttribute?.('data-tooltip-content'),
        item?.getAttribute?.('data-label'),
      ]).filter(Boolean).join(' ')).toLowerCase();
      if (/(?:copy|复制)(?:\s+(?:response|turn|message|content))?|复制(?:回复|回答|内容|消息)?/.test(value)) return 'copy';
      if (/(?:share|分享|共享)(?:[\s_-]*(?:response|reply|turn|message|conversation|link|回答|回复|消息|对话|链接))?/.test(value)) return 'share';
      if (/(?:good[\s_-]*response|positive[\s_-]*feedback|upvote|like|thumbs?[\s_-]*up|赞|喜欢|好的回答|回复优秀)/.test(value)) return 'like';
      if (/(?:bad[\s_-]*response|negative[\s_-]*feedback|downvote|dislike|thumbs?[\s_-]*down|踩|不喜欢|不好的回答|回复不佳)/.test(value)) return 'dislike';
      if (/(?:rate|feedback)(?:[\s_-]*(?:this\s+)?(?:response|reply|answer|message|conversation))?|评价(?:回复|回答|消息)?|评分/.test(value)) return 'feedback';
      if (/(?:sources?|citations?|references?|show[\s_-]*sources?|来源|引用|参考资料|参考来源)/.test(value)) return 'source';
      if (/(?:regenerate|retry|try[\s_-]*again|重新生成|重试|再次生成)/.test(value)) return 'regenerate';
      if (/(?:more(?:\s+actions?)?|更多操作|更多|显示更多)/.test(value)) return 'more';
      if (/(?:branch|continue in (?:a )?new (?:chat|task)|新建(?:聊天)?分支|在新.*聊天.*分支|从这里.*(?:继续|分支))/.test(value)) return 'branch';
      return '';
    };
    const controlsIn = scope => {
      // A live Stop control makes completion impossible. Walking every
      // toolbar and SVG inside a large response is wasted work during output.
      if (!scope || stopVisible) return [];
      const candidates = [];
      if (scope.matches?.(responseControlSelector)) candidates.push(scope);
      candidates.push(...nodes(responseControlSelector, scope));
      return candidates.filter(visible).map(node => ({ node, kind: responseControlKind(node) })).filter(item => item.kind);
    };
    const responseSelector = conversationTurnSelector;
    const hasResponseCompletionAction = kinds => kinds.has('share')
      || kinds.has('feedback')
      || kinds.has('like')
      || kinds.has('dislike')
      || kinds.has('source')
      || kinds.has('more');
    const composerNode = composer();
    const follows = (from, to) => Boolean(from && to && (from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING));
    const responseLaneControl = node => {
      if (!node || !assistantUnit || own(node)) return false;
      // ChatGPT can mount final reply actions beside the assistant content.
      // Accept them only after this exact assistant message and before the
      // composer or any subsequent canonical conversation message.
      if (!follows(assistantUnit, node)) return false;
      if (composerNode && !follows(node, composerNode)) return false;
      const nextMessage = conversationRoleNodes()
        .find(candidate => candidate !== assistantUnit && follows(assistantUnit, candidate));
      if (nextMessage && !follows(node, nextMessage)) return false;
      return !node.closest?.('form,nav,aside,header,[contenteditable="true"]');
    };
    const controlsBelongToLatestResponse = node => {
      if (!node || own(node)) return false;
      // Live fallback-turn DOM keeps the user's Copy inside :user and the
      // assistant Copy outside :assistant but inside the shared outer turn.
      // A user-unit control is therefore an explicit rejection, even though
      // it has the same outer turn key as the assistant response.
      const controlUnit = node.closest?.(contentSearchUnitSelector);
      if (controlUnit) {
        return Boolean(
          fallbackAssistantUnit
          && contentSearchUnitRole(controlUnit) === 'assistant'
          && controlUnit === fallbackAssistantUnit
        );
      }
      if (fallbackResponseBoundary) {
        const controlTurn = node.closest?.(contentSearchTurnSelector);
        if (controlTurn) {
          return controlTurn === responseTurn && responseLaneControl(node);
        }
      }
      const nearestTurn = node.closest?.(responseSelector);
      if (nearestTurn) return nearestTurn === article || nearestTurn === assistantUnit;
      return responseLaneControl(node);
    };
    const scopes = [];
    const addScope = scope => { if (scope && !scopes.includes(scope)) scopes.push(scope); };
    addScope(responseTurn);
    addScope(article);
    addScope(assistantUnit);
    let ancestor = responseTurn?.parentElement || article?.parentElement;
    for (let depth = 0; ancestor && depth < 2; depth++, ancestor = ancestor.parentElement) {
      if (ancestor.matches?.('body')) break;
      addScope(ancestor);
      if (ancestor.matches?.('main,[role="main"]')) break;
    }
    addScope(responseTurn?.closest?.('main,[role="main"]') || article?.closest?.('main,[role="main"]') || assistantUnit?.closest?.('main,[role="main"]'));
    let responseControls = [];
    for (const scope of scopes) {
      const found = controlsIn(scope).filter(item => controlsBelongToLatestResponse(item.node));
      if (!found.length) continue;
      const kinds = new Set(found.map(item => item.kind));
      const complete = kinds.has('copy') && hasResponseCompletionAction(kinds);
      if (!responseControls.length || complete) responseControls = found;
      if (complete) break;
    }
    // Some renderer versions portal the action row. Only accept a portaled
    // control when it carries an explicit message/turn association, so an
    // older response's toolbar cannot make the current turn look complete.
    const messageId = assistantUnit?.getAttribute?.('data-message-id')
      || assistantUnit?.getAttribute?.('data-chatgpt-selection-message-id')
      || assistantUnit?.querySelector?.('[data-chatgpt-selection-message-id]')?.getAttribute?.('data-chatgpt-selection-message-id')
      || '';
    const turnKey = responseTurn?.getAttribute?.('data-turn-key') || responseTurn?.getAttribute?.('data-content-search-turn-key') || '';
    if (!stopVisible && (messageId || turnKey)) {
      for (const item of nodes(responseControlSelector).filter(visible)) {
        const associationParents = [
          item,
          item.closest?.('[data-message-id]'),
          item.closest?.('[data-turn-key]'),
          item.closest?.('[data-content-search-turn-key]'),
          item.closest?.('[data-for-turn]'),
        ].filter(Boolean);
        const association = [
          ...associationParents.flatMap(node => [
            node.getAttribute('aria-controls'),
            node.getAttribute('data-message-id'),
            node.getAttribute('data-turn-key'),
            node.getAttribute('data-content-search-turn-key'),
            node.getAttribute('data-for-turn'),
          ]),
        ].filter(Boolean).join(' ');
        if (!association || (!association.includes(messageId) && !association.includes(turnKey))) continue;
        if (!controlsBelongToLatestResponse(item)) continue;
        const kind = responseControlKind(item);
        if (kind && !responseControls.some(existing => existing.node === item)) responseControls.push({ node: item, kind });
      }
    }
    const responseActions = new Set(responseControls.map(item => item.kind));
    const responseActionsComplete = responseActions.has('copy')
      && hasResponseCompletionAction(responseActions);
    // ChatGPT has shipped renderer variants where the static marker lives on
    // the markdown node (or on a turn wrapper without a message/turn id).
    // The node is already scoped to the latest assistant turn, so requiring a
    // legacy id here rejects a genuinely finished reply after a page rotation.
    const hasCompletionMarker = node => {
      if (!node) return false;
      const streaming = node.getAttribute?.('data-is-streaming');
      const busy = node.getAttribute?.('aria-busy');
      const state = node.getAttribute?.('data-state') || node.getAttribute?.('data-status') || '';
      return streaming === 'false'
        || busy === 'false'
        || node.getAttribute?.('data-complete') === 'true'
        || /^(?:complete|completed|done|finished|success|idle)$/i.test(state);
    };
    const explicitFinal = Boolean(
      markdown
      && [markdown, assistantUnit, article].some(hasCompletionMarker),
    );
    const streaming = boundedStreamRead;
    // Product completion evidence is deliberately smaller than the full
    // response-action row: once Stop is gone, a Copy control that is bound to
    // the latest owned assistant lane proves ChatGPT has committed the reply.
    // Share/feedback/source/more remain useful diagnostics, but renderer
    // variants may delay or omit them and must not turn a visible final answer
    // into "conversation ended without final reply".
    const substantiveReply = Boolean(content && !/^(?:思考了?\s*\d+\s*(?:h|m|s|小时|分钟|秒)(?:\s*\d+\s*(?:m|s|分钟|秒))*|thought for\s*\d+\s*(?:h|m|s|hours?|minutes?|seconds?)(?:\s*\d+\s*(?:m|s|minutes?|seconds?))*)[。.!]?$/iu.test(normalize(content)));
    // A settled thought-only action row proves the generation ended, not that
    // the task delivered a readable answer. Keep this out of final/results.
    const terminalEmptyReply = Boolean(!substantiveReply && responseActionsComplete && !stopVisible && !streaming);
    const finalByCopy = Boolean(
      substantiveReply
      && responseActions.has('copy')
      && !streaming
      && !stopVisible,
    );
    const finalByActions = Boolean(substantiveReply && responseActionsComplete && !stopVisible);
    // Keep the explicit marker path for compatibility and diagnostics. Copy is
    // still response-local and ownership-bound; a bare static marker alone is
    // never sufficient.
    const finalByStaticCopy = Boolean(
      substantiveReply
      && explicitFinal
      && !streaming
      && responseActions.has('copy')
      && !stopVisible,
    );
    return {
      user: text(user),
      text: content,
      diagnostic:{ userNodes:users.length, assistantNodes:replies.length, inspectedTextChars:content.length, boundedStreamRead },
      // Stop can disappear while ChatGPT is waiting for connector approval,
      // running a tool, or rebuilding the renderer. Completion therefore
      // requires the current assistant turn's visible reply toolbar:
      // copy + share/rate/like/dislike, with no Stop button. Static renderer
      // markers remain diagnostic only and never authorize completion.
      final: finalByCopy || finalByActions || finalByStaticCopy,
      owned,
      responseActions: [...responseActions],
      responseActionsComplete,
      explicitFinal,
      terminalEmptyReply,
      streaming,
      hasNaturalReply,
      article,
      responseTurn,
    };
  }
  function taskTurnForInspection(task, scanContext = null) {
    const scoped = latestTurn(task);
    if (!task || scoped.owned || task.attempted) return scoped;
    const liveURL = currentConversationURL();
    const taskURL = canonicalConversationURL(task.url);
    if (!liveURL || !taskURL || liveURL !== taskURL) return scoped;
    // If the original marker is still mounted, latestTurn(task) already made
    // the authoritative ownership decision. An unowned result in that state
    // means a newer user turn exists, so recovery must remain fail-closed.
    if (taskMarkerUser(task)) return scoped;
    if (conversationURLOwner(liveURL, task.id)) return scoped;
    const foreignTask = tabTasks().find(item => item.id !== task.id && item.token && hasTaskMarker(item));
    if (foreignTask) return scoped;
    const stopIdentity = stopObservedGenerationIdentity(task, liveURL);
    const stopBoundGeneration = Boolean(
      stopIdentity
      && task.stopObservedGenerationIdentity === stopIdentity
    );
    if (stopBoundGeneration && !stopButton() && !(scanContext?.cards() || cards()).length) {
      const candidate = latestTurn();
      const observedBoundaryKey = String(task.stopObservedAssistantBoundaryKey || '');
      const candidateBoundaryKey = assistantResponseBoundaryKey(candidate);
      const currentReview = task.phase === 'review'
        && candidate.text
        && candidate.hasNaturalReply
        && !candidate.streaming
          ? currentReviewReport(candidate.text, task)
          : null;
      const structuredReviewFinal = Boolean(currentReview);
      const mountedUser = conversationRoleNodes('user').at(-1);
      const sameObservedUser = Boolean(
        mountedUser
        && task.stopObservedUserBoundaryKey
        && recoveryUserBoundaryKey(mountedUser) === task.stopObservedUserBoundaryKey
      );
      if (mountedUser && task.stopObservedUserBoundaryKey && !sameObservedUser) return scoped;
      const sameObservedResponse = Boolean(
        observedBoundaryKey
        && candidateBoundaryKey === observedBoundaryKey
      );
      // Review has a stronger semantic final identity than ordinary Work:
      // parseReview() requires the exact current taskId + round + status/schema.
      // Once this exact dispatch was observed generating on this exact route,
      // a valid current Review result must not depend on renderer-only turn keys
      // surviving virtualization/remount. Treat the result itself as the final
      // response signal, while keeping structural-boundary + toolbar recovery
      // for non-Review replies and malformed Review text.
      const reviewResultFinal = Boolean(
        structuredReviewFinal
        && candidate.text
        && candidate.hasNaturalReply
        && !candidate.streaming
      );
      if (candidate.text
        && !candidate.streaming
        && (((sameObservedResponse || sameObservedUser) && candidate.final) || reviewResultFinal)) {
        return {
          ...candidate,
          final:Boolean(candidate.final || reviewResultFinal),
          structuredReviewFinal,
          reviewResultFinal,
          owned:true,
          recoveredRouteOwned:true,
          stopBoundRouteFinal:true,
        };
      }
    }

    const identity = task.recoveredFinalIdentity || {};
    const hasRecoveredIdentity = recoveredFinalIdentityMatches(task, liveURL);
    const mountedUsers = conversationRoleNodes('user');
    const latestMountedUser = mountedUsers.at(-1);
    const recoveredContinuation = Boolean(
      latestMountedUser
      && Number(task.continuationCount || 0) > 0
      && normalize(text(latestMountedUser)) === CONTINUATION_PROMPT,
    );
    // A persisted continuation send plus its exact prompt is a verifiable
    // current-turn boundary even after ChatGPT virtualizes the original task
    // marker. Keep this fallback limited to the unique exact route and use
    // latestTurn() below so an older reply toolbar cannot satisfy it.
    if (!hasRecoveredIdentity && !recoveredContinuation) return scoped;
    if (latestMountedUser && !recoveredContinuation) {
      // A stable visible user boundary plus the exact recorded route lets an
      // automatically recovered task accept only a real final toolbar. Any
      // later manual user message changes this key and fails closed.
      if (recoveryUserBoundaryKey(latestMountedUser) !== String(identity.visibleUserBoundaryKey || '')) return scoped;
    }

    // Normal recovery remains final-only. Explicit manual recovery gets two
    // bounded capabilities after the snapshotted user boundary remains
    // unchanged: a natural-language static reply can use the eight-second
    // recovery-final gate, while a tool-only/empty assistant edge can still be
    // owned for ended-conversation detection so the queue can send a
    // continuation instead of waiting fifteen minutes.
    const candidate = latestTurn();
    if (stopButton() || (scanContext?.cards() || cards()).length) return scoped;
    if (!identity.allowStaticFinal) {
      if (!candidate.text || !candidate.final) return scoped;
      return {
        ...candidate,
        owned:true,
        recoveredRouteOwned:true,
      };
    }
    return {
      ...candidate,
      owned:true,
      recoveredRouteOwned:true,
      recoveredStaticCandidate:Boolean(
        candidate.text
        && candidate.hasNaturalReply
        && !candidate.final
        && !candidate.streaming
      ),
    };
  }
  const allowLabel = /^(?:允许(?:一次)?|批准(?:一次)?|allow(?: once| one time)?|approve(?: once| one time)?)$/i;
  const denyLabel = /^(?:拒绝|不允许|deny|decline|reject)$/i;
  function approvalArrow(node, allowButton) {
    return node !== allowButton && (
      node.hasAttribute('aria-haspopup')
      || /箭头|展开|选项|更多|menu|options|expand/i.test(label(node))
      || (!text(node) && Boolean(node.querySelector('svg')) && node.parentElement === allowButton.parentElement)
    );
  }
  function actionText(node) {
    if (!node?.querySelector?.('[aria-hidden="true"]')) return text(node);
    const copy = node?.cloneNode?.(true);
    copy?.querySelectorAll?.('[aria-hidden="true"]').forEach(child => child.remove());
    return normalize(copy?.textContent);
  }
  const actionMatches = (node, pattern) => [actionText(node), node?.getAttribute('aria-label'), node?.getAttribute('title')]
    .some(value => pattern.test(normalize(value)));
  const liveApprovalSurfaceSelector = [
    '[class*="approval-card" i]',
    '[class*="authorization-card" i]',
    '[class*="permission-card" i]',
    '[data-testid*="approval-card" i]',
    '[data-testid*="authorization-card" i]',
    '[data-testid*="permission-card" i]',
    '[data-approval-card]',
    '[data-authorization-card]',
    '[data-permission-card]',
  ].join(',');
  const authorizationGrantTitlePattern = /^(?:允许|授权)\s*ChatGPT\s*(?:使用|访问)\s*[^？?]{1,120}[？?]?$/iu;
  const englishAuthorizationGrantTitlePattern = /^Allow\s+ChatGPT\s+to\s+(?:use|access)\s+.{1,120}[?]?$/iu;
  const authorizationSemanticTextSelector = 'h1,h2,h3,h4,h5,h6,[role="heading"],p,strong,span,div';
  const authorizationSemanticExcludedSelector = [
    'blockquote',
    'pre',
    'code',
    '.markdown',
    '[data-message-content]',
    '[data-selected-text-overlay-target]',
    'form',
    'textarea',
    '[contenteditable="true"]',
  ].join(',');
  function authorizationGrantTitleNode(scope) {
    if (!scope?.querySelectorAll) return null;
    const candidates = [];
    if (scope.matches?.(authorizationSemanticTextSelector)) candidates.push(scope);
    candidates.push(...nodes(authorizationSemanticTextSelector, scope));
    return candidates.find(node => {
      if (!visible(node) || node.closest(authorizationSemanticExcludedSelector)) return false;
      const value = text(node);
      return authorizationGrantTitlePattern.test(value) || englishAuthorizationGrantTitlePattern.test(value);
    }) || null;
  }
  function semanticAuthorizationSurface(button) {
    if (!button || own(button) || !visible(button) || button.hasAttribute('aria-haspopup')) return null;
    if (button.closest(authorizationSemanticExcludedSelector)) return null;
    let container = button.parentElement;
    for (let depth = 0; container && depth < 9; depth += 1, container = container.parentElement) {
      if (container === document.body || container.tagName === 'MAIN') break;
      if (authorizationGrantTitleNode(container)) return container;
    }
    return null;
  }
  const authorizationStructuralExcludedSelector = [
    'blockquote',
    'pre',
    'code',
    '.markdown',
    '[data-message-content]',
    '[data-selected-text-overlay-target]',
    'textarea',
    '[contenteditable="true"]',
    'nav',
    'aside',
    'header',
  ].join(',');
  function authorizationCardShell(node) {
    if (!node || node === document.body || node.tagName === 'MAIN') return false;
    if (node.matches?.(liveApprovalSurfaceSelector)) return true;
    if (node.matches?.('[role="dialog"],[role="alertdialog"],[data-radix-dialog-content],[data-dialog-content]')) return true;
    const structural = normalize(`${node.getAttribute?.('class') || ''} ${node.getAttribute?.('data-testid') || ''}`);
    return /(?:^|[\s_:/-])(?:card|panel|surface|rounded|border|container)(?:$|[\s_:/-])/i.test(structural);
  }
  function structuralAuthorizationSurface(button) {
    if (!button || own(button) || !visible(button) || button.hasAttribute('aria-haspopup')) return null;
    if (button.closest(authorizationStructuralExcludedSelector)) return null;
    let container = button.parentElement;
    for (let depth = 0; container && depth < 9; depth += 1, container = container.parentElement) {
      if (container === document.body || container.tagName === 'MAIN') break;
      if (!authorizationCardShell(container)) continue;
      const actions = nodes('button,[role=button]', container);
      const deny = actions.find(node => actionMatches(node, denyLabel));
      const arrow = actions.find(node => approvalArrow(node, button));
      if (deny || arrow) return container;
    }
    return null;
  }
  function authorizationCardScopes({ wide = false } = {}) {
    const scopes = [];
    const add = node => {
      if (node && !own(node) && !scopes.includes(node)) scopes.push(node);
    };
    const main = document.querySelector('main,[role="main"]');
    // Current ChatGPT renders connector grants in an explicit approval-card
    // surface (for example class="@container/approval-card"). This surface is
    // authoritative even when it sits outside the role-derived message nodes.
    for (const surface of nodes(liveApprovalSurfaceSelector, document)) {
      if (visible(surface) && !surface.closest(authorizationStructuralExcludedSelector)) add(surface);
    }
    // Renderer revisions can change card copy and provider names. Discover
    // authorization by product structure first: a real Allow/Approve control
    // plus independent approval topology on a card-like live surface. Semantic
    // title matching remains only a compatibility hint, never a requirement.
    if (main) {
      for (const button of nodes('button,[role=button]', main)) {
        if (!actionMatches(button, allowLabel) || button.hasAttribute('aria-haspopup')) continue;
        const surface = structuralAuthorizationSurface(button)
          || semanticAuthorizationSurface(button);
        if (surface) add(surface);
      }
    }
    const dialogs = document.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"],[data-radix-dialog-content],[data-dialog-content]');
    for (const dialog of dialogs) {
      if (!main || !dialog.contains(main)) add(dialog);
    }
    // Content-search turns are stable structural boundaries even while the
    // user/assistant role units are being remounted. Keep the latest few as
    // bounded approval scopes independently of role recognition.
    if (main) nodes(contentSearchTurnSelector, main).slice(-3).forEach(add);
    const recent = conversationRoleNodes('', main).slice(-8);
    if (!recent.length) {
      // On a fresh ChatGPT route there is no transcript to search; the primary
      // surface is small and may contain a global authorization prompt.
      add(main || document.body);
      return scopes;
    }
    for (const message of recent) {
      add(message.closest?.(conversationTurnSelector) || message);
    }
    // Some renderer builds portal a current approval card beside (rather than
    // inside) its latest turn. Walk both sides of the latest response because
    // live connector cards can be mounted between the latest user boundary and
    // the assistant activity, not only after the assistant node.
    const latest = recent.at(-1);
    let anchor = latest.closest?.(conversationTurnSelector) || latest;
    for (let depth = 0; anchor && depth < 5 && anchor !== main; depth += 1) {
      for (const direction of ['previousElementSibling','nextElementSibling']) {
        let sibling = anchor[direction];
        for (let count = 0; sibling && count < 8; count += 1, sibling = sibling[direction]) {
          if (sibling.matches?.(`${conversationRoleSelector},form,nav,aside,header,textarea,[contenteditable="true"]`)) break;
          add(sibling);
        }
      }
      anchor = anchor.parentElement;
    }
    // Wide mode is reserved for safety-critical boundaries (resume, pre-Send,
    // interruption/Stop handoff). Explicit authorization metadata and approval
    // control topology are content-independent; isolated ordinary Allow
    // controls still do not qualify.
    if (wide) add(main || document.body);
    return scopes;
  }
  function cards(options = {}) {
    const startedAt = performance.now();
    const result = [], seen = new Set();
    // Presence and actionability are intentionally separate. ChatGPT disables
    // approval controls while a connector grant is being submitted, and may
    // remount the same card. A disabled card is still a pending authorization
    // surface and must block Stop-disappearance recovery.
    const allButtons = [];
    const buttonSeen = new Set();
    for (const scope of authorizationCardScopes(options)) {
      if (scope.matches?.('button,[role=button]') && !own(scope) && !buttonSeen.has(scope)) {
        buttonSeen.add(scope);
        allButtons.push(scope);
      }
      for (const button of nodes('button,[role=button]', scope)) {
        if (buttonSeen.has(button)) continue;
        buttonSeen.add(button);
        allButtons.push(button);
      }
    }
    const allowCandidates = allButtons.filter(button => actionMatches(button, allowLabel));
    scanDiagnostics.cardsButtons += allButtons.length;
    scanDiagnostics.cardsCandidates += allowCandidates.length;
    for (const button of allowCandidates) {
      if (!actionMatches(button, allowLabel) || button.hasAttribute('aria-haspopup')) continue;
      let completeContainer = null;
      let completeDeny = null;
      let completeArrow = null;
      let container = button.parentElement;
      for (let depth = 0; container && depth < 9; depth++, container = container.parentElement) {
        if (container === document.body || container.tagName === 'MAIN') break;
        const actions = nodes('button,[role=button]', container);
        const deny = actions.find(node => actionMatches(node, denyLabel));
        const arrow = actions.find(node => approvalArrow(node, button));
        if (deny && arrow) {
          completeContainer = container;
          completeDeny = deny;
          completeArrow = arrow;
          break;
        }
      }
      if (completeContainer) {
        if (!seen.has(completeContainer)) {
          seen.add(completeContainer);
          result.push({
            container:completeContainer,
            button,
            arrow:completeArrow,
            deny:completeDeny,
            actionable:Boolean(enabled(button) && enabled(completeArrow) && enabled(completeDeny)),
          });
        }
        continue;
      }
      // Presence fallback: authorization-card identity is structural first.
      // A renderer may expose explicit approval metadata, or only part of the
      // approval-control topology, before the full Reject + Allow + split-menu
      // cluster hydrates. Title/provider copy is never required.
      const trustedContainer = button.closest?.(liveApprovalSurfaceSelector)
        || structuralAuthorizationSurface(button)
        || semanticAuthorizationSurface(button);
      if (trustedContainer && !seen.has(trustedContainer)) {
        seen.add(trustedContainer);
        const actions = nodes('button,[role=button]', trustedContainer);
        result.push({
          container:trustedContainer,
          button,
          arrow:actions.find(node => approvalArrow(node, button)) || null,
          deny:actions.find(node => actionMatches(node, denyLabel)) || null,
          actionable:false,
        });
      }
    }
    // An explicit authorization-card surface is authoritative even before
    // any known Allow label has mounted (or when the UI is localized beyond
    // our action-label vocabulary). Record presence as non-actionable so every
    // lifecycle path fails closed on the current conversation.
    for (const surface of nodes(liveApprovalSurfaceSelector, document)) {
      if (!visible(surface) || own(surface) || surface.closest(authorizationStructuralExcludedSelector)) continue;
      const alreadyCovered = result.some(card => card.container === surface
        || surface.contains(card.container)
        || card.container?.contains?.(surface));
      if (alreadyCovered) continue;
      seen.add(surface);
      const actions = nodes('button,[role=button]', surface);
      const allow = actions.find(node => actionMatches(node, allowLabel) && !node.hasAttribute('aria-haspopup')) || null;
      result.push({
        container:surface,
        button:allow,
        arrow:allow ? (actions.find(node => approvalArrow(node, allow)) || null) : null,
        deny:actions.find(node => actionMatches(node, denyLabel)) || null,
        actionable:false,
      });
    }
    scanDiagnostics.cardsCalls += 1;
    scanDiagnostics.cardsMs += performance.now() - startedAt;
    return result;
  }
  // ChatGPT occasionally shows product announcements, image-generation tips,
  // feedback prompts, and other modal overlays that block the composer. These
  // are not authorization cards: close only an explicit dismiss control and
  // leave every approval card for the dedicated arrow/menu flow below.
  const popupCloseLabel = /^(?:×|✕|✖|x|关闭|close|dismiss|取消|cancel|稍后|以后再说|跳过|skip|not now|maybe later)(?:\s+(?:弹窗|窗口|对话框|modal|dialog|popup))?$/iu;
  function popupDialogs() {
    const selectors = [
      '[role="dialog"]', '[role="alertdialog"]', '[aria-modal="true"]',
      '[data-radix-dialog-content]', '[data-dialog-content]',
      '[data-modal="true"]', '[class*="modal"]', '[class*="Modal"]',
      '[class*="dialog"]', '[class*="Dialog"]',
    ].join(',');
    const seen = new Set();
    return nodes(selectors).filter(node => {
      if (seen.has(node) || !visible(node)) return false;
      seen.add(node);
      return true;
    });
  }
  function modalCloseButton(dialog) {
    const candidates = nodes('button,[role="button"]', dialog).filter(enabled);
    const labelled = candidates.find(node => [text(node), node.getAttribute('aria-label'), node.getAttribute('title')]
      .some(value => popupCloseLabel.test(normalize(value))));
    if (labelled) return labelled;
    const classClose = candidates.find(node => /(?:modal|dialog|popup)[-_]?(?:close|dismiss)|(?:close|dismiss|close-button)[-_]?(?:modal|dialog|popup)?/i.test(`${node.className || ''} ${node.getAttribute('data-testid') || ''}`));
    if (classClose) return classClose;
    // Some ChatGPT overlays render an icon-only close button without an
    // aria-label. Restrict this fallback to an icon in the dialog's upper
    // right corner so ordinary action buttons are not clicked accidentally.
    const bounds = dialog.getBoundingClientRect?.();
    if (!bounds) return null;
    return candidates.filter(node => !text(node) && node.querySelector('svg')).find(node => {
      const buttonBounds = node.getBoundingClientRect?.();
      return buttonBounds && buttonBounds.top <= bounds.top + 96 && buttonBounds.right >= bounds.right - 140;
    }) || null;
  }
  // The ChatGPT Work *continuation offer* is a product decision in an
  // already-running Chat conversation, not a connector authorization card,
  // final reply, or connection interruption. Its Stop button may disappear
  // while the short-lived choice is shown. Only the exact titled, two-action
  // surface may trigger the requested "stay in chat" action.
  const chatWorkOfferStayLabel = /^(?:留在聊天模式|留在聊天中|保持聊天模式|stay in chat(?: mode)?|keep chatting)(?:\s*[（(]?\d{1,3}(?:\s*(?:秒|s|sec))?[）)]?)?$/iu;
  const chatWorkOfferMoveLabel = /^(?:在\s*(?:ChatGPT\s*)?Work\s*中继续|continue (?:in|with) (?:ChatGPT\s*)?Work)$/iu;
  const chatWorkOfferTitleLabel = /^(?:在\s*ChatGPT\s*Work\s*中继续|continue (?:in|with) ChatGPT\s*Work)$/iu;
  function chatWorkContinueOffer() {
    const main = document.querySelector('main,[role="main"]');
    if (!main || !visible(main)) return null;
    // Button-first search avoids walking/materializing a long transcript on
    // every four-second task scan; the ancestor/title checks are only for the
    // few buttons that match the exact "stay" action.
    const buttons = nodes('button,[role="button"]', main);
    for (const stay of buttons.slice(-80)) {
      if (!visible(stay) || stay.closest('nav,aside,form,blockquote,pre,code,[contenteditable="true"],[data-message-author-role="user"],[data-user-message-bubble="true"]')) continue;
      const labels = [actionText(stay),stay.getAttribute('aria-label'),stay.getAttribute('title')];
      if (!labels.some(value => chatWorkOfferStayLabel.test(normalize(value)))) continue;
      for (let scope = stay.parentElement, depth = 0;
        scope && scope !== main && !scope.matches('body,html') && depth < 8;
        scope = scope.parentElement, depth++) {
        if (own(scope) || !visible(scope)) break;
        // Exclude response-sized ancestors: a title elsewhere in the thread
        // must never be combined with an unrelated "stay" button.
        const direct = nodes('button,[role="button"]', scope);
        if (direct.length < 2 || direct.length > 6) continue;
        const work = direct.find(node => node !== stay && visible(node)
          && [actionText(node),node.getAttribute('aria-label'),node.getAttribute('title')]
            .some(value => chatWorkOfferMoveLabel.test(normalize(value))));
        if (!work) continue;
        const headings = nodes('h1,h2,h3,h4,[role="heading"],div,span,p,strong', scope);
        const title = headings.find(node => visible(node)
          && !node.closest('button,[role="button"],blockquote,pre,code,[data-message-author-role="user"],[data-user-message-bubble="true"]')
          && chatWorkOfferTitleLabel.test(text(node)));
        if (title) return {container:scope,stay,work,title};
      }
    }
    return null;
  }
  function chatWorkStayIdentity(task, liveURL = currentConversationURL()) {
    const taskURL = canonicalConversationURL(task?.url);
    if (!taskURL || taskURL !== canonicalConversationURL(liveURL) || !task?.token) return '';
    return JSON.stringify([taskURL,String(task.token),String(task.phase || ''),Number(task.round || 0),Number(task.goalRevision || 0)]);
  }
  function clearChatWorkStayState(task) {
    if (!task) return false;
    const changed = Boolean(task.chatWorkStayIdentity || task.chatWorkStayClickedAt || task.chatWorkStayLastAttemptAt);
    task.chatWorkStayIdentity = '';
    task.chatWorkStayClickedAt = 0;
    task.chatWorkStayLastAttemptAt = 0;
    return changed;
  }
  function handleChatWorkContinueOffer(task, signal, now = Date.now()) {
    if (!task || !running || data.autoResume === false || !taskBelongsToTab(task)
      || terminal.has(task.state) || task.state === 'paused' || task.attempted) return false;
    const identity = chatWorkStayIdentity(task);
    if (!identity || tabTasks().some(other => other.id !== task.id && other.token && hasTaskMarker(other))
      || conversationURLOwner(canonicalConversationURL(task.url), task.id)) return false;
    const offer = chatWorkContinueOffer();
    if (task.chatWorkStayIdentity && task.chatWorkStayIdentity !== identity) {
      clearChatWorkStayState(task);
      task.updatedAt = now;
      save();
    }
    if (offer) {
      // Connector permissions take precedence over this product prompt.
      if (cards({wide:true}).length) return false;
      check(signal);
      if (task.chatWorkStayIdentity !== identity) {
        clearChatWorkStayState(task);
        task.chatWorkStayIdentity = identity;
        log(task, '当前会话出现“在 ChatGPT Work 中继续”卡片；将选择留在聊天模式，停止按钮暂时消失不代表异常中断。');
      }
      if (enabled(offer.stay) && now - Number(task.chatWorkStayLastAttemptAt || 0) >= CHAT_WORK_STAY_RETRY_MS) {
        task.chatWorkStayLastAttemptAt = now;
        // Latch before clicking: React may immediately unmount the buttons.
        task.chatWorkStayClickedAt = now;
        activateControl(offer.stay);
        log(task, '已在当前 ChatGPT 会话点击“留在聊天模式”；保持原会话等待回复恢复，不新开会话。');
      }
      // The unchosen, pending or disabled offer is still a live product gate.
      // Do not release the existing conversation when Stop is temporarily gone.
      clearStopNoApprovalConfirmation(task);
      task.abnormalNoFinalSince = 0;
      task.abnormalNoFinalSignature = '';
      task.state = 'waiting';
      task.updatedAt = now;
      save();
      return true;
    }
    if (task.chatWorkStayIdentity === identity) {
      if (stopButton()) {
        // A new Stop means the existing conversation really resumed.
        clearChatWorkStayState(task);
        task.updatedAt = now;
        save();
        return false;
      }
      if (task.chatWorkStayClickedAt
        && now - Number(task.chatWorkStayClickedAt) < CHAT_WORK_STAY_SETTLEMENT_MS) {
        // Do not promote the transient absence of both card and Stop to an
        // ended/no-final event while ChatGPT hydrates its resumed Chat stream.
        clearStopNoApprovalConfirmation(task);
        task.abnormalNoFinalSince = 0;
        task.abnormalNoFinalSignature = '';
        if (task.state !== 'waiting') {
          task.state = 'waiting';
          task.updatedAt = now;
          save();
        }
        return true;
      }
      // A vanished card without a verified click is not proof of staying in
      // Chat; ordinary route/response guards decide what to do next.
      clearChatWorkStayState(task);
      task.updatedAt = now;
      save();
    }
    return false;
  }
  let lastRunnerOverlayScanAt = 0;
  function dismissUnexpectedModals(task = null, scanContext = null) {
    const approvalContainers = (scanContext?.cards() || cards()).map(card => card.container);
    if (task && running) lastRunnerOverlayScanAt = Date.now();
    let dismissed = 0;

    // Handle the history-only request-frequency popup semantically first. The
    // current ChatGPT renderer may not expose role=dialog/aria-modal at all,
    // so relying on popupDialogs() alone leaves the overlay blocking the task.
    const historyPopup = historyAccessThrottlePopup(scanContext?.pageRecords || pageUiTextRecords);
    if (historyPopup && !approvalContainers.some(container => container === historyPopup.container || historyPopup.container.contains(container) || container.contains(historyPopup.container))) {
      activateControl(historyPopup.button);
      dismissed++;
      if (task) log(task, '检测到仅限制访问历史会话的“请求过于频繁”提示；已点击“明白了”，继续当前任务，不进入限流休息。');
    }

    for (const dialog of popupDialogs()) {
      if (!dialog.isConnected) continue;
      // A connector authorization card may itself be rendered inside a
      // dialog. Never close that card through the generic popup heuristic.
      const actions = nodes('button,[role="button"]', dialog).filter(enabled);
      const approvalLike = actions.some(node => actionMatches(node, allowLabel))
        && actions.some(node => actionMatches(node, denyLabel));
      if (approvalLike || approvalContainers.some(container => container === dialog || dialog.contains(container) || container.contains(dialog))) continue;

      // ChatGPT can show a "请求过于频繁" dialog that only limits access to
      // previous conversation/history records. It does not stop the current
      // chat, a new chat, or current generation. Acknowledge it explicitly and
      // do not route it into the real request-rate-limit cooldown.
      if (historyAccessThrottlePattern.test(normalize(text(dialog)))) {
        const acknowledge = actions.find(node => [text(node), node.getAttribute('aria-label'), node.getAttribute('title')]
          .some(value => historyAccessAckLabel.test(normalize(value))));
        if (acknowledge) {
          activateControl(acknowledge);
          dismissed++;
          if (task) log(task, '检测到仅限制访问历史会话的“请求过于频繁”提示；已点击“明白”，继续当前任务，不进入限流休息。');
          continue;
        }
      }

      const close = modalCloseButton(dialog);
      if (!close) continue;
      activateControl(close);
      dismissed++;
      if (task) log(task, '检测到 ChatGPT 弹窗，已自动关闭。');
    }
    return dismissed;
  }
  function schedulePopupDismissScan(ms = POPUP_DISMISS_SCAN_MS) {
    clearTimeout(popupDismissTimer);
    popupDismissTimer = setTimeout(() => {
      popupDismissTimer = null;
      try {
        // Active task supervision already checks these overlays. Let it own
        // the work and run this fallback only if the task path has gone quiet.
        const runnerRecentlyScanned = running && Date.now() - lastRunnerOverlayScanAt < POPUP_DISMISS_SCAN_MS;
        if ((running || data.globalAutoApprove) && !runnerRecentlyScanned) dismissUnexpectedModals();
      } catch (error) { console.warn('[Fabushi] ChatGPT 弹窗检查暂未完成', error); }
      schedulePopupDismissScan(document.hidden ? HIDDEN_POPUP_DISMISS_SCAN_MS : POPUP_DISMISS_SCAN_MS);
    }, ms);
  }
  function checkAuthorizationRun(signal, queueOwned) {
    const activeTask = data.tasks.find(task => task.id === current && taskBelongsToTab(task));
    if (signal?.aborted || (queueOwned && !running) || activeTask?.state === 'paused' || activeTask?.state === 'cancelled') throw new Error('已暂停');
  }
  function activateControl(node) {
    const PointerCtor = window.PointerEvent || window.MouseEvent;
    node.dispatchEvent(new PointerCtor('pointerdown', { bubbles:true, cancelable:true, button:0, buttons:1, pointerType:'mouse', isPrimary:true }));
    node.click();
  }
  function isConversationScopedAllow(node) {
    const value = label(node);
    if (/始终|总是|永久|所有(?:会话|对话)|always|all (?:chats|conversations|sessions)|future (?:chats|conversations|sessions)/i.test(value)) return false;
    return /^(?:允许本次会话|在此对话中允许|允许此对话|允许\s+.{1,80}?\s+(?:用于|在)?(?:本次会话|此对话)|allow (?:for )?this (?:chat|conversation|session)|allow .{1,80}? for this (?:chat|conversation|session))$/iu.test(value);
  }
  async function authorize(card, task, signal, queueOwned = true) {
    if (!card?.container?.isConnected || !visible(card.container)) return false;
    if (!card.actionable || !enabled(card.button) || !enabled(card.arrow)) {
      if (task) {
        const started = markApprovalUnavailable(task, currentConversationURL(), Date.now());
        if (started) {
          log(task, `授权卡仍存在但控件正在处理或暂不可用；保持当前会话等待。若连续 ${Math.ceil(APPROVAL_UNAVAILABLE_REFRESH_MS / 1000)} 秒仍未恢复，将刷新当前会话而不是一直等待，也不会把 Stop 消失当成结束。`);
        }
      }
      return false;
    }
    const last = approvalAttempts.get(card.button) || 0;
    if (Date.now() - last < 15000) return false;
    approvalAttempts.set(card.button, Date.now());
    const candidates = nodes('button,[role=button]', card.container).filter(enabled);
    const arrow = (enabled(card.arrow) && card.arrow)
      || candidates.find(node => node.hasAttribute('aria-haspopup'))
      || candidates.find(node => node !== card.button && /箭头|展开|选项|更多|menu|options|expand/i.test(label(node)))
      || candidates.find(node => node !== card.button && !text(node) && node.querySelector('svg') && node.parentElement === card.button.parentElement)
      || (enabled(card.button) && card.button.querySelector('svg') ? card.button : null);
    if (!arrow) {
      if (task) {
        const started = markApprovalUnavailable(task, currentConversationURL(), Date.now());
        if (started) log(task, `授权卡已识别，但下拉授权控件尚未完全加载；若连续 ${Math.ceil(APPROVAL_UNAVAILABLE_REFRESH_MS / 1000)} 秒仍不可用，将刷新当前会话。`);
      } else {
        log(task, '授权卡已识别，但尚未找到可用的下拉箭头；保持等待。');
      }
      return false;
    }
    checkAuthorizationRun(signal, queueOwned);
    activateControl(arrow);
    for (let attempt = 0; attempt < 6; attempt++) {
      await delay(250, signal ?? null); checkAuthorizationRun(signal, queueOwned);
      const option = nodes('[role=menuitem],[role=option], [role=menu] button').filter(enabled)
        .find(isConversationScopedAllow);
      if (!option) continue;
      activateControl(option);
      if (task) beginApprovalSettlement(task);
      log(task, '已点击“允许本次会话”，进入授权提交保护期；即使卡片暂时 disabled、重挂载或瞬时消失，也不会切换会话。');
      return true;
    }
    if (task) {
      const started = markApprovalUnavailable(task, currentConversationURL(), Date.now());
      if (started) {
        log(task, `授权菜单尚未加载“允许本次会话”；保持当前会话等待。若连续 ${Math.ceil(APPROVAL_UNAVAILABLE_REFRESH_MS / 1000)} 秒仍缺失，将刷新当前会话，不会选择“始终允许”。`);
      }
    } else {
      log(task, '授权菜单没有“允许本次会话”；保留当前会话等待处理。');
    }
    return false;
  }
  async function processGlobalApprovalCards() {
    if (!data.globalAutoApprove || globalApprovalBusy) return false;
    const pending = cards();
    if (!pending.length) return false;
    globalApprovalBusy = true;
    try {
      await authorize(pending[0], null, globalApprovalController?.signal, false);
      return true;
    } finally {
      globalApprovalBusy = false;
    }
  }
  function scheduleGlobalApprovalScan(ms = GLOBAL_APPROVAL_SCAN_MS) {
    clearTimeout(globalApprovalTimer);
    globalApprovalTimer = null;
    if (!data.globalAutoApprove) return;
    globalApprovalTimer = setTimeout(async () => {
      globalApprovalTimer = null;
      try { await processGlobalApprovalCards(); } catch (error) {
        if (error.message !== '已暂停') console.warn('[Fabushi] 全页面授权检查暂未完成', error);
      } finally {
        scheduleGlobalApprovalScan(document.hidden ? HIDDEN_GLOBAL_APPROVAL_SCAN_MS : GLOBAL_APPROVAL_SCAN_MS);
      }
    }, ms);
  }
  function setGlobalAutoApprove(enabled) {
    globalApprovalController?.abort();
    data.globalAutoApprove = Boolean(enabled);
    globalApprovalController = data.globalAutoApprove ? new AbortController() : null;
    save();
    scheduleGlobalApprovalScan(data.globalAutoApprove ? 50 : GLOBAL_APPROVAL_SCAN_MS);
  }
  function classify(sample, previous, now) {
    if (sample.rateLimit) return { state:'cooldown', reason:sample.rateLimit };
    const ignoredPageNotice = /ChatGPT 使用额度或访问频率受限|达到使用上限|usage limit|rate limit|too many requests|请求过于频繁|达到.*限额/i.test(String(sample.blocker || ''));
    if (sample.blocker && !ignoredPageNotice) return { state:'blocked', reason:sample.blocker };
    if (sample.approvalRouteEligible && sample.cards) return { state:'approval' };
    if (sample.routeOwned === false || !sample.owned) {
      const reason = sample.foreignTaskId
        ? '当前页面仍显示另一个任务的消息；已暂停本轮读取，等待当前任务会话完成交接。'
        : '当前任务的发送消息尚未完成渲染；已暂停本轮读取，避免误读其他任务。';
      // A foreign task's spinner is not a reason to hold the scheduler on
      // this task. Keep the task resumable and let the next supervision slice
      // inspect the other task while this route finishes its own handoff.
      return { state: sample.loading && !sample.foreignTaskId ? 'loading' : 'waiting', reason };
    }
    if (sample.cards) return { state:'approval' };
    if (sample.stop || sample.streaming) return { state:'generating' };
    if (sample.loading) return { state:'loading', reason:'ChatGPT 页面正在加载，等待会话内容完全渲染。' };
    const finalStayedStable = sample.final && sample.text && previous?.final
      && previous?.text === sample.text
      && now - Number(previous.finalSince || previous.since || 0) >= FINAL_REPLY_STABILITY_MS;
    const recoveredStaticStayedStable = Boolean(
      sample.recoveredStaticCandidate
      && sample.text
      && previous?.recoveredStaticCandidate
      && previous?.text === sample.text
      && now - Number(previous.recoveredStaticSince || previous.since || 0) >= RECOVERED_STATIC_FINAL_STABILITY_MS
    );
    const naturalFinalStayedStable = Boolean(
      sample.naturalFinalCandidate
      && sample.text
      && previous?.naturalFinalCandidate
      && previous?.text === sample.text
      && now - Number(previous.naturalFinalSince || previous.since || 0) >= ENDED_NO_FINAL_STABILITY_MS
    );
    if (finalStayedStable || recoveredStaticStayedStable || naturalFinalStayedStable) return { state:'complete' };
    // Stop-disappearance handoff is handled before classification whenever this
    // dispatch actually observed Stop. Reaching this fallback therefore means
    // there is no verified Stop transition for this dispatch (for example a
    // static/manual recovery after reload), so remain bound and fail closed.
    return { state:'waiting' };
  }
  function ownedFinalReplyReady(task) {
    if (!task) return false;
    const liveURL = currentConversationURL();
    const taskURL = canonicalConversationURL(task.url);
    if (!liveURL || !taskURL || liveURL !== taskURL) return false;
    const turn = taskTurnForInspection(task);
    return Boolean(turn.owned && turn.final && turn.text && !stopButton() && !cards().length);
  }
