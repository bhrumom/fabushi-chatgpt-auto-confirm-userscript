  function visibilityAwareDelay(ordinaryDelay, visibleMs, hiddenMs, hidden = document.hidden) {
    const delayMs = Math.max(0, Number(ordinaryDelay) || 0);
    // Preserve explicit short recovery deadlines while reducing ordinary work
    // on background tabs, where Chrome may throttle timers anyway.
    if (delayMs > 0 && delayMs < 4000) return delayMs;
    return Math.max(delayMs, hidden ? hiddenMs : visibleMs);
  }
  function retainedPreparedComposer(task) {
    if (!task?.attempted || !task?.preparedPrompt) return false;
    const input = composer();
    return Boolean(input && normalize(input.value || input.textContent) === normalize(task.preparedPrompt));
  }
  function nextTaskWakeDelay(active, now = Date.now()) {
    const deadlines = active.map(item => taskDeferredUntil(item, now)).filter(Number.isFinite);
    if (!deadlines.length) return VISIBLE_SCAN_INTERVAL_MS;
    return Math.max(100, Math.min(...deadlines) - now);
  }
  const text = node => normalize(node?.textContent);
  const label = node => normalize(`${text(node)} ${node?.getAttribute('aria-label') || ''} ${node?.getAttribute('title') || ''}`);
  const own = node => Boolean(node?.closest?.(`#${ROOT}`));
  const visible = node => {
    if (!node?.isConnected || own(node) || node.closest('[hidden],[inert]')) return false;
    const css = getComputedStyle(node);
    return css.display !== 'none' && css.visibility !== 'hidden' && node.getClientRects().length > 0;
  };
  const enabled = node => visible(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true';
  const nodes = (selector, scope = document) => scope?.querySelectorAll
    ? [...scope.querySelectorAll(selector)].filter(node => !own(node))
    : [];
  const contentSearchTurnSelector = '[data-content-search-turn-key]';
  const contentSearchUnitSelector = '[data-content-search-unit-key],[data-chatgpt-search-unit-key]';
  // Current ChatGPT agent/work mode renders visible execution summaries as
  // tertiary assistant-message nodes. They are useful abnormal-handoff
  // context, but intentionally stay outside conversationRoleSelector so they
  // can never become final-reply or review-result evidence by themselves.
  const assistantActivitySelector = '[data-markdown-text-style="assistant-message"][data-markdown-text-tone="tertiary"]';
  const conversationTurnSelector = 'article,[data-testid^="conversation-turn-"],[data-turn-key],[data-content-search-turn-key],[data-turn="user"],[data-turn="assistant"],[data-author-role="user"],[data-author-role="assistant"]';
  const semanticMessageSelector = '.markdown,[data-message-content],[data-selected-text-overlay-target],[data-markdown-text-style="assistant-message"],[data-markdown-text-tone="user-message"]';
  const conversationRoleSelector = [
    '[data-message-author-role="user"]',
    '[data-message-author-role="assistant"]',
    '[data-turn="user"]',
    '[data-turn="assistant"]',
    '[data-author-role="user"]',
    '[data-author-role="assistant"]',
    '[data-content-search-unit-key$=":user"]',
    '[data-content-search-unit-key$=":assistant"]',
    '[data-chatgpt-search-unit-key$=":user"]',
    '[data-chatgpt-search-unit-key$=":assistant"]',
    '[data-conversation-role="user"]',
    '[data-conversation-role="assistant"]',
    '[data-user-message-bubble="true"]',
    '[data-markdown-text-style="assistant-message"][data-markdown-text-tone="primary"]',
    '[data-markdown-text-tone="user-message"]',
  ].join(',');
  function contentSearchUnitRole(node) {
    if (!node) return '';
    const unit = node.matches?.(contentSearchUnitSelector) ? node : node.closest?.(contentSearchUnitSelector);
    if (!unit) return '';
    for (const attr of ['data-content-search-unit-key','data-chatgpt-search-unit-key']) {
      const value = String(unit.getAttribute?.(attr) || '').toLowerCase();
      const match = value.match(/:(user|assistant)$/);
      if (match) return match[1];
    }
    return '';
  }
  function conversationRole(node) {
    if (!node) return '';
    for (const attr of ['data-message-author-role','data-turn','data-author-role','data-conversation-role']) {
      const value = String(node.getAttribute?.(attr) || '').toLowerCase();
      if (value === 'user' || value === 'assistant') return value;
    }
    const unitRole = contentSearchUnitRole(node);
    if (unitRole) return unitRole;
    if (node.matches?.('[data-user-message-bubble="true"],[data-markdown-text-tone="user-message"]')) return 'user';
    if (node.matches?.('[data-markdown-text-style="assistant-message"][data-markdown-text-tone="primary"]')) return 'assistant';
    return '';
  }
  function conversationMessageUnit(node, role = '') {
    if (!node) return null;
    const wanted = role === 'user' || role === 'assistant' ? role : conversationRole(node);
    if (!wanted) return null;
    const contentUnit = node.matches?.(contentSearchUnitSelector) ? node : node.closest?.(contentSearchUnitSelector);
    if (contentUnit && contentSearchUnitRole(contentUnit) === wanted) {
      // Live fallback DOM can wrap one user message twice with the same key:
      // an outer data-chatgpt-search-unit-key and an inner
      // data-content-search-unit-key. Canonicalize both representations to
      // the innermost content unit so one visible message is never counted
      // twice and latest-user ownership remains stable.
      const key = contentUnit.getAttribute?.('data-content-search-unit-key')
        || contentUnit.getAttribute?.('data-chatgpt-search-unit-key')
        || '';
      if (!contentUnit.hasAttribute?.('data-content-search-unit-key') && key) {
        const nestedContent = nodes('[data-content-search-unit-key]', contentUnit)
          .find(candidate => candidate.getAttribute('data-content-search-unit-key') === key
            && contentSearchUnitRole(candidate) === wanted);
        if (nestedContent) return nestedContent;
      }
      return contentUnit;
    }
    // Legacy/current transitional DOM can put data-turn/data-author-role on
    // an outer turn and data-message-author-role on an inner host for the same
    // logical message. Prefer that inner legacy host from either direction so
    // the two selector families canonicalize to one node instead of doubling
    // user/assistant counts.
    const legacyHost = node.matches?.(`[data-message-author-role="${wanted}"]`)
      ? node
      : node.closest?.(`[data-message-author-role="${wanted}"]`)
        || node.querySelector?.(`[data-message-author-role="${wanted}"]`);
    if (legacyHost) return legacyHost;
    const direct = node.matches?.(`[data-turn="${wanted}"],[data-author-role="${wanted}"]`)
      ? node
      : node.closest?.(`[data-turn="${wanted}"],[data-author-role="${wanted}"]`);
    if (direct) return direct;
    const conversationRoleHost = node.matches?.(`[data-conversation-role="${wanted}"]`)
      ? node
      : node.closest?.(`[data-conversation-role="${wanted}"]`);
    if (conversationRoleHost) return conversationRoleHost;
    return node;
  }
  function conversationRoleNodes(role = '', scope = document) {
    const wanted = role === 'user' || role === 'assistant' ? role : '';
    const result = [];
    const seenUnits = new Set();
    const candidates = nodes(conversationRoleSelector, scope);
    for (const node of candidates) {
      const resolvedRole = conversationRole(node);
      if (!resolvedRole || (wanted && resolvedRole !== wanted)) continue;
      const unit = conversationMessageUnit(node, resolvedRole);
      if (!unit || seenUnits.has(unit)) continue;
      seenUnits.add(unit);
      result.push(unit);
    }
    return result;
  }
  function renderedConversationMessage(node) {
    if (!node?.isConnected || own(node) || node.closest?.('[hidden],[inert]')) return false;
    const css = getComputedStyle(node);
    if (css.display === 'none' || css.visibility === 'hidden') return false;
    if (node.getClientRects().length > 0) return true;
    // ChatGPT can make the role host layout-neutral (for example
    // display:contents) while the actual message child remains painted.
    const semantic = [];
    if (node.matches?.(semanticMessageSelector)) semantic.push(node);
    semantic.push(...nodes(semanticMessageSelector, node));
    if (semantic.some(visible)) return true;
    // User-message renderer variants do not always expose one of the semantic
    // assistant-content selectors. A visibly painted owning turn plus text in
    // the non-hidden role host is sufficient proof that this role is mounted;
    // role/ownership still come exclusively from canonical role evidence.
    const turn = node.closest?.(conversationTurnSelector);
    return Boolean(turn && visible(turn) && hasTextNode(node));
  }
  const pageUiAuthoredInputSelector = '#prompt-textarea,textarea,input,[contenteditable="true"],[role="textbox"]';
  function pageUiTextRecords() {
    const startedAt = performance.now();
    const main = document.querySelector('main,[role="main"]');
    const body = document.body || document.documentElement;
    if (!main && !body) {
      scanDiagnostics.pageUiCalls += 1;
      scanDiagnostics.pageUiMs += performance.now() - startedAt;
      return [];
    }
    // Page notices normally live in the primary surface. Scanning body used
    // to include the sidebar, hidden menus, and every unrelated page widget on
    // each runner tick. Keep just the main surface plus compact semantic
    // overlays that ChatGPT may portal outside main.
    const roots = [];
    const addRoot = node => {
      if (!node || own(node) || roots.some(root => root === node || root.contains(node))) return;
      for (let index = roots.length - 1; index >= 0; index -= 1) {
        if (node.contains(roots[index])) roots.splice(index, 1);
      }
      roots.push(node);
    };
    addRoot(main || body);
    if (main) {
      for (const overlay of document.querySelectorAll('[role="alert"],[role="status"],[role="dialog"],[role="alertdialog"],[aria-modal="true"],[aria-live="assertive"],[aria-live="polite"]')) {
        if (!main.contains(overlay) && !overlay.contains(main)) addRoot(overlay);
      }
    }
    const records = [];
    let visited = 0;
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Reject transcript, quoted/code, and Fabushi subtrees wholesale.
            if (own(node)
              || node.matches?.(`${conversationRoleSelector},blockquote,pre,code`)
              || node.matches?.(pageUiAuthoredInputSelector)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
          const parent = node.parentElement;
          return parent && !own(parent) && !parent.closest?.(pageUiAuthoredInputSelector)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });
      let current;
      while ((current = walker.nextNode())) {
        visited += 1;
        if (current.nodeType !== Node.TEXT_NODE) continue;
        const direct = normalize(current.nodeValue);
        if (direct) records.push({ node:current, parent:current.parentElement, direct });
      }
    }
    scanDiagnostics.pageUiCalls += 1;
    scanDiagnostics.pageUiMs += performance.now() - startedAt;
    scanDiagnostics.pageUiVisited += visited;
    scanDiagnostics.pageUiTextNodes += records.length;
    return records;
  }
  function createPageScanContext() {
    let pageRecords = null;
    let authorizationCards = null;
    return {
      pageRecords:() => pageRecords || (pageRecords = pageUiTextRecords()),
      cards:() => authorizationCards || (authorizationCards = cards()),
    };
  }
  function clearApprovalSettlement(task) {
    if (!task) return;
    task.approvalSettlementUntil = 0;
    task.approvalSettlementURL = '';
    task.approvalSettlementToken = '';
    task.approvalSettlementPhase = '';
    task.approvalSettlementRound = 0;
  }
  function approvalUnavailableIdentity(task, route = '') {
    if (!task) return '';
    const taskURL = canonicalConversationURL(task.url);
    const liveURL = canonicalConversationURL(route || currentConversationURL() || taskURL);
    if (!taskURL || !liveURL || liveURL !== taskURL || !task.token) return '';
    return JSON.stringify([
      liveURL,
      String(task.token || ''),
      String(task.phase || ''),
      Number(task.round || 0),
    ]);
  }
  function clearApprovalUnavailableRefresh(task) {
    if (!task) return false;
    const changed = Boolean(
      task.approvalUnavailableIdentity
      || task.approvalUnavailableSince
      || task.approvalUnavailableRefreshAt
      || task.approvalUnavailableRefreshCount
    );
    task.approvalUnavailableIdentity = '';
    task.approvalUnavailableSince = 0;
    task.approvalUnavailableRefreshAt = 0;
    task.approvalUnavailableRefreshCount = 0;
    return changed;
  }
  function markApprovalUnavailable(task, route = '', now = Date.now()) {
    const identity = approvalUnavailableIdentity(task, route);
    if (!identity) return false;
    const started = task.approvalUnavailableIdentity !== identity
      || !Number(task.approvalUnavailableSince || 0);
    if (!started) return false;
    clearApprovalUnavailableRefresh(task);
    task.approvalUnavailableIdentity = identity;
    task.approvalUnavailableSince = now;
    task.state = 'approval';
    task.updatedAt = now;
    return true;
  }
  function approvalUnavailableRefreshDue(task, route = '', now = Date.now()) {
    if (!task || !data.autoApprove) return false;
    const identity = approvalUnavailableIdentity(task, route);
    if (!identity || task.approvalUnavailableIdentity !== identity) return false;
    const since = Number(task.approvalUnavailableSince || 0);
    if (!since) return false;
    if (approvalSettlementActive(task, route, now)) return false;
    const lastRefresh = Number(task.approvalUnavailableRefreshAt || 0);
    return now - Math.max(since, lastRefresh) >= APPROVAL_UNAVAILABLE_REFRESH_MS;
  }
  function refreshUnavailableApproval(task, perform = true, now = Date.now()) {
    if (!task || task.state === 'paused' || task.state === 'cancelled' || task.attempted || !data.autoApprove) return false;
    const conversationURL = currentConversationURL() || canonicalConversationURL(task.url);
    const taskURL = canonicalConversationURL(task.url);
    if (!conversationURL || !taskURL || conversationURL !== taskURL) return false;
    if (!approvalUnavailableRefreshDue(task, conversationURL, now)) return false;
    const nextCount = Number(task.approvalUnavailableRefreshCount || 0) + 1;
    task.approvalUnavailableRefreshCount = nextCount;
    task.approvalUnavailableRefreshAt = now;
    task.state = 'approval';
    task.updatedAt = now;
    observations.delete(task.id);
    log(task, `授权卡持续 ${Math.ceil(APPROVAL_UNAVAILABLE_REFRESH_MS / 1000)} 秒仍未完全加载或暂不可用；正在刷新当前会话（第 ${nextCount} 次），保留会话、发送标识、附件和当前阶段，不会新开会话或重复发送。`);
    save();
    if (!perform) return true;
    navigating = true;
    try { location.reload(); } catch (error) {
      navigating = false;
      log(task, `授权卡恢复刷新失败：${error.message}；已保留当前任务，${Math.ceil(APPROVAL_UNAVAILABLE_REFRESH_MS / 1000)} 秒后继续尝试。`);
      save();
      return false;
    }
    return true;
  }
  function beginApprovalSettlement(task, now = Date.now()) {
    if (!task) return;
    clearApprovalUnavailableRefresh(task);
    task.approvalSettlementUntil = now + APPROVAL_SETTLEMENT_MS;
    task.approvalSettlementURL = canonicalConversationURL(currentConversationURL() || task.url);
    task.approvalSettlementToken = String(task.token || '');
    task.approvalSettlementPhase = String(task.phase || '');
    task.approvalSettlementRound = Number(task.round || 0);
    task.updatedAt = now;
    save();
  }
  function approvalSettlementActive(task, route = '', now = Date.now()) {
    if (!task || Number(task.approvalSettlementUntil || 0) <= now) {
      if (task?.approvalSettlementUntil || task?.approvalSettlementURL || task?.approvalSettlementToken
        || task?.approvalSettlementPhase || task?.approvalSettlementRound) {
        clearApprovalSettlement(task);
      }
      return false;
    }
    const liveURL = canonicalConversationURL(route || currentConversationURL());
    const settlementURL = canonicalConversationURL(task.approvalSettlementURL);
    const matches = Boolean(
      liveURL
      && settlementURL
      && liveURL === settlementURL
      && String(task.approvalSettlementToken || '') === String(task.token || '')
      && String(task.approvalSettlementPhase || '') === String(task.phase || '')
      && Number(task.approvalSettlementRound || 0) === Number(task.round || 0)
    );
    if (!matches) {
      clearApprovalSettlement(task);
      return false;
    }
    return true;
  }
  function boundedTextContent(node, maxChars = 600) {
    if (!node) return '';
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let value = '';
    let current;
    while ((current = walker.nextNode())) {
      const chunk = current.nodeValue || '';
      if (chunk.length > maxChars - value.length) return null;
      value += chunk;
    }
    return normalize(value);
  }
  const pageLoadingHint = /animate[-_]spin|spinner|progress(?:bar)?|hydrating|hydrate|loading|加载|水合|请稍候|please wait/i;
  const pageLoadingSelectors = [
    '[aria-busy="true"]',
    '[aria-label*="load" i]',
    '[aria-label*="加载"]',
    '[title*="load" i]',
    '[title*="加载"]',
    '[role="progressbar"]',
    '[role="status"]',
    '[data-loading="true"]',
    '[data-state="loading"]',
    '[data-testid*="loading"]',
    '[data-testid*="Loading"]',
    '[data-testid*="spinner"]',
    '[data-testid*="Spinner"]',
    '[class*="animate-spin"]',
    '[class*="spinner"]',
    '[class*="Spinner"]',
    '[class*="loading"]',
    '[class*="Loading"]',
    '[class*="progress"]',
    '[class*="Progress"]',
  ].join(',');
  function pageLoadingState() {
    const main = document.querySelector('main');
    // Prefer ChatGPT's conversation surface. Scanning the whole body also
    // walks sidebar, workbench, and extension UI on every supervision tick.
    const scope = main || document.body || document.documentElement;
    if (!scope) return '';
    const candidates = [];
    if (scope.matches?.(pageLoadingSelectors)) candidates.push(scope);
    candidates.push(...nodes(pageLoadingSelectors, scope));
    // Class/ARIA/test-id selectors already recognize known loading spinners;
    // enumerating every SVG to inspect computed animation is costly on long
    // transcripts and needlessly treats unrelated animated artwork as loading.
    const turns = conversationRoleNodes('', scope);
    const hasVisibleTurn = turns.slice(-8).some(renderedConversationMessage);
    const seen = new Set();
    for (const node of candidates) {
      if (seen.has(node)) continue;
      seen.add(node);
      if (!visible(node)) continue;
      if (node.closest(`#${ROOT},${conversationRoleSelector},form,nav,aside,header,textarea,[contenteditable="true"]`)) continue;
      const attrs = `${label(node)} ${node.getAttribute('class') || String(node.className || '')} ${node.getAttribute('data-testid') || ''}`;
      const semantic = node.matches('[aria-busy="true"],[role="progressbar"],[data-loading="true"],[data-state="loading"]');
      const statusSpinner = node.getAttribute('role') === 'status'
        && (!text(node) || node.querySelector('svg'))
        && pageLoadingHint.test(attrs);
      if (semantic || pageLoadingHint.test(attrs) || statusSpinner) {
        return 'ChatGPT 页面正在加载，等待会话内容完全渲染。';
      }
    }
    if (document.readyState !== 'complete' && !hasVisibleTurn) {
      return 'ChatGPT 文档仍在加载，等待会话内容完全渲染。';
    }
    return '';
  }
  function conversationLoading() { return Boolean(pageLoadingState()); }
  function activeAssistantGeneration() {
    if (stopButton()) return true;
    const assistant = conversationRoleNodes('assistant').filter(renderedConversationMessage).at(-1);
    if (!assistant) return false;
    const article = assistant.closest(conversationTurnSelector) || assistant;
    return Boolean(article.matches?.('[data-is-streaming="true"],[aria-busy="true"]')
      || article.querySelector('[data-is-streaming="true"],[aria-busy="true"]'));
  }
  function visibleConversationHasMessages() {
    return conversationRoleNodes().some(renderedConversationMessage);
  }
  const conversationLoadFailurePattern = /(?:无法加载(?:此|该)?\s*ChatGPT\s*(?:对话|会话)|(?:(?:unable\s+to|could\s+not|couldn't|cannot|can't)\s+load)(?:\s+this)?\s+(?:chatgpt\s+)?(?:conversation|chat))/i;
  const conversationLoadRetryPattern = /^(?:重试|再次尝试|再试一次|retry|try again)$/i;
  function conversationLoadFailure(getPageRecords = pageUiTextRecords) {
    if (visibleConversationHasMessages()) return '';
    const records = getPageRecords();
    for (const record of records) {
      const parent = record.parent;
      if (!parent || !visible(parent) || !conversationLoadFailurePattern.test(record.direct)) continue;
      if (own(parent) || parent.closest?.(conversationRoleSelector)) continue;
      const mainScoped = Boolean(parent.matches?.('main,[role="main"]') || parent.closest?.('main,[role="main"]'));
      let scope = parent;
      for (let depth = 0; scope && depth < 8; depth += 1, scope = scope.parentElement) {
        if (own(scope)) break;
        const retry = nodes('button,[role="button"]', scope).find(control =>
          enabled(control) && conversationLoadRetryPattern.test(label(control)));
        if (retry) return normalize(record.direct);
        if (scope.matches?.('main,[role="main"],body')) break;
      }
      // Current ChatGPT can render “Try again” as inert text rather than a
      // semantic button. The exact route-level load-failure sentence inside the
      // main surface is already strong evidence when no conversation messages
      // are mounted, so do not wait forever just because the retry affordance
      // is not exposed as a button.
      if (mainScoped) return normalize(record.direct);
    }
    return '';
  }
  function clearConversationLoadFailureState(task) {
    if (!task) return false;
    const changed = Boolean(task.conversationLoadFailureURL
      || task.conversationLoadFailureAttempts
      || task.conversationLoadFailureAt);
    task.conversationLoadFailureURL = '';
    task.conversationLoadFailureAttempts = 0;
    task.conversationLoadFailureAt = 0;
    return changed;
  }
