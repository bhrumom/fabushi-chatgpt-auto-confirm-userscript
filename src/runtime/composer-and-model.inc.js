  function composer() { return nodes('#prompt-textarea,textarea,[contenteditable=true]').find(enabled); }
  const CHAT_MODE_LABEL_RE = /^(?:聊天(?:模式)?|chat(?: mode)?)$/iu;
  const WORK_MODE_LABEL_RE = /^(?:工作(?:模式)?|work(?: mode)?)$/iu;
  const CHATGPT_WORK_EVIDENCE_RE = /^(?:使用\s*ChatGPT\s*Work|Use\s+ChatGPT\s+Work)$/iu;
  function localizedChatWorkModeKind(node) {
    if (!node) return '';
    const candidates = [
      text(node),
      normalize(node.getAttribute?.('aria-label') || ''),
      normalize(node.getAttribute?.('title') || ''),
    ].filter(Boolean);
    if (candidates.some(value => CHAT_MODE_LABEL_RE.test(value))) return 'chat';
    if (candidates.some(value => WORK_MODE_LABEL_RE.test(value))) return 'work';
    return '';
  }
  function chatWorkModeSelection(node) {
    if (!node) return null;
    const booleanAttributes = ['aria-selected','aria-pressed','aria-checked'];
    for (const name of booleanAttributes) {
      const raw = String(node.getAttribute?.(name) || '').trim().toLowerCase();
      if (raw === 'true') return true;
      if (raw === 'false') return false;
    }
    const current = String(node.getAttribute?.('aria-current') || '').trim().toLowerCase();
    if (current && current !== 'false') return true;
    if (current === 'false') return false;
    for (const name of ['data-selected','data-active','data-checked']) {
      const raw = String(node.getAttribute?.(name) || '').trim().toLowerCase();
      if (raw === 'true' || raw === '1' || raw === 'yes') return true;
      if (raw === 'false' || raw === '0' || raw === 'no') return false;
    }
    const state = String(node.getAttribute?.('data-state') || '').trim().toLowerCase();
    if (['active','selected','checked','on'].includes(state)) return true;
    if (['inactive','unselected','unchecked','off'].includes(state)) return false;
    if (node.getAttribute?.('role') === 'tab') {
      const tabIndex = Number(node.getAttribute?.('tabindex'));
      if (Number.isInteger(tabIndex)) {
        if (tabIndex === 0) return true;
        if (tabIndex === -1) return false;
      }
    }
    return null;
  }
  function modePairDistance(left, right) {
    if (!left || !right) return Number.POSITIVE_INFINITY;
    const leftAncestors = [];
    for (let node = left; node && node !== document.body && leftAncestors.length < 6; node = node.parentElement) leftAncestors.push(node);
    const rightAncestors = new Map();
    let depth = 0;
    for (let node = right; node && node !== document.body && depth < 6; node = node.parentElement, depth++) rightAncestors.set(node, depth);
    let best = Number.POSITIVE_INFINITY;
    leftAncestors.forEach((node, leftDepth) => {
      if (rightAncestors.has(node)) best = Math.min(best, leftDepth + rightAncestors.get(node));
    });
    return best;
  }
  function chatWorkModeControls() {
    const controls = nodes('button,[role="tab"],[role="radio"]').filter(visible);
    const chats = controls.filter(node => localizedChatWorkModeKind(node) === 'chat');
    const works = controls.filter(node => localizedChatWorkModeKind(node) === 'work');
    let best = null;
    for (const chat of chats) {
      for (const work of works) {
        const distance = modePairDistance(chat, work);
        if (!Number.isFinite(distance) || distance > 6) continue;
        if (!best || distance < best.distance) best = { chat, work, distance };
      }
    }
    return best;
  }
  function workModeEvidence() {
    return nodes('textarea,[contenteditable=true],[placeholder],[aria-label],button,div,span,p')
      .some(node => visible(node) && [
        normalize(node.getAttribute?.('placeholder') || ''),
        normalize(node.getAttribute?.('aria-label') || ''),
        text(node),
      ].some(value => value && CHATGPT_WORK_EVIDENCE_RE.test(value)));
  }
  function chatWorkModeState() {
    const pair = chatWorkModeControls();
    if (!pair) return { state:workModeEvidence() ? 'work-evidence' : 'absent', pair:null };
    const chatSelected = chatWorkModeSelection(pair.chat);
    const workSelected = chatWorkModeSelection(pair.work);
    if (chatSelected === true && workSelected !== true) return { state:'chat', pair, chatSelected, workSelected };
    if (workSelected === true && chatSelected !== true) return { state:'work', pair, chatSelected, workSelected };
    return { state:'ambiguous', pair, chatSelected, workSelected };
  }
  async function ensureChatMode(task, signal) {
    let observed = chatWorkModeState();
    if (observed.state === 'absent') return true;
    if (observed.state === 'work-evidence') {
      waitForSendUI(task, '检测到 ChatGPT Work 页面，但聊天/工作模式选择器尚未就绪');
      return false;
    }
    if (observed.state === 'chat') return true;
    if (observed.state === 'ambiguous') {
      waitForSendUI(task, '已识别 ChatGPT 聊天/工作模式选择器，但当前模式无法可靠确认');
      return false;
    }
    if (!enabled(observed.pair?.chat)) {
      waitForSendUI(task, '当前处于 ChatGPT Work，但“聊天/Chat”模式按钮暂不可用');
      return false;
    }
    activateControl(observed.pair.chat);
    for (let attempt = 0; attempt < 8; attempt++) {
      await delay(100, signal); check(signal);
      observed = chatWorkModeState();
      if (observed.state === 'chat') {
        log(task, '检测到 ChatGPT Work，已在发送前切换到聊天 / Chat 模式并完成确认。');
        return true;
      }
      if (observed.state === 'ambiguous' || observed.state === 'absent' || observed.state === 'work-evidence') break;
    }
    waitForSendUI(task, '已尝试从 ChatGPT Work 切换到聊天 / Chat，但未能确认聊天模式已选中');
    return false;
  }
  function reasoningPickerTrigger() {
    return nodes('button[data-codex-intelligence-trigger="true"],button[data-composer-navigation-target="reasoning"]')
      .find(node => enabled(node) && (node.getAttribute('aria-haspopup') === 'menu' || node.hasAttribute('data-selected-reasoning-effort')));
  }
  function modelPickerTrigger() {
    const explicit = nodes([
      'button[data-testid="model-switcher-dropdown-button"]',
      'button[data-composer-navigation-target="model"]',
      'button[data-model-switcher]',
      'button[data-testid*="model-switcher" i]',
    ].join(',')).find(node => enabled(node));
    return explicit || reasoningPickerTrigger();
  }
  function modelControlStrings(node) {
    if (!node) return [];
    const raw = String(node.innerText || node.textContent || '');
    const values = [
      ...raw.split(/\n+/),
      node.getAttribute?.('aria-label') || '',
      node.getAttribute?.('title') || '',
    ].map(value => normalize(value)).filter(Boolean);
    return [...new Set(values)];
  }
  function modelValueMatches(value, target) {
    const normalized = normalize(value);
    if (!normalized) return false;
    const preset = modelPresetDefinition(target);
    return preset.aliases.some(alias => {
      const expected = normalize(alias);
      if (normalized === expected) return true;
      if (!normalized.startsWith(expected + ' ')) return false;
      const suffix = normalized.slice(expected.length).trim();
      return /^(?:即时|中|高|极高|Pro|Instant|Medium|High|Extra High)(?:\b|$)/i.test(suffix);
    });
  }
  function modelTriggerMatches(trigger, target) {
    return modelControlStrings(trigger).some(value => modelValueMatches(value, target));
  }
  function closedComposerModelHint(trigger) {
    if (!trigger || !visible(trigger) || trigger.getAttribute('aria-expanded') === 'true') return null;
    const text = normalize(trigger.innerText || trigger.textContent || '');
    if (/\b5\.6\b/i.test(text)) return 'gpt-5.6-sol';
    if (/\b5\.5\b/i.test(text)) return 'gpt-5.5';
    // On current ChatGPT a ready trigger contains reasoning strength only
    // for GPT-6. Empty or loading controls never imply GPT-6.
    if (/^(?:思考强度|即时|中|高|极高|Pro|Instant|Medium|High|Extra High)(?:\s.*)?$/i.test(text)) return 'gpt-6';
    return null;
  }
  function modelMenuOption(target) {
    const preset = modelPresetDefinition(target);
    const interactive = nodes('button,[role="menuitem"],[role="option"]')
      .filter(node => visible(node) && !own(node));
    const scoped = interactive.filter(node => Boolean(node.closest?.(
      '[role="menu"],[role="listbox"],[data-radix-menu-content],[data-radix-popper-content-wrapper],[data-state="open"]'
    )));
    const candidates = scoped.length ? scoped : interactive.filter(node => node.getAttribute('role') === 'menuitem' || node.getAttribute('role') === 'option');
    return candidates.find(node => modelControlStrings(node).some(value =>
      preset.aliases.some(alias => normalize(value).toLowerCase() === normalize(alias).toLowerCase())
    )) || null;
  }
  function modelSubmenuEntry() {
    return nodes('[role="menuitem"],button')
      .filter(node => visible(node) && !own(node))
      .find(node => {
        const aria = normalize(node.getAttribute?.('aria-label') || '');
        const title = normalize(node.getAttribute?.('title') || '');
        const semantic = normalize(`${aria} ${title}`);
        return /^(?:选择模型|select model)$/i.test(aria)
          || /(?:^|\s)(?:选择模型|select model)(?:\s|$)/i.test(semantic)
          || /(?:选择模型|select model)/i.test(label(node));
      }) || null;
  }
  function modelRadioOptions() {
    return nodes('[role="menuitemradio"]')
      .filter(node => visible(node) && !own(node) && Boolean(node.closest?.(
        '[role="menu"],[role="listbox"],[data-radix-menu-content],[data-radix-popper-content-wrapper],[data-state="open"]'
      )));
  }
  function modelRadioOption(target) {
    const preset = modelPresetDefinition(target);
    return modelRadioOptions().find(node => modelControlStrings(node).some(value => {
      const actual = normalize(value).toLowerCase();
      return preset.aliases.some(alias => {
        const expected = normalize(alias).toLowerCase();
        return actual === expected || actual.startsWith(expected + ' ');
      });
    })) || null;
  }
  function modelRadioSelected(node) {
    return Boolean(node) && (node.getAttribute('aria-checked') === 'true'
      || node.getAttribute('data-state') === 'checked');
  }
  function modelSubmenuHintMatches(entry, target) {
    if (!entry) return false;
    const short = {
      'gpt-5.6-sol':['5.6','GPT-5.6 Sol'],
      'gpt-6':['6','GPT-6'],
      'gpt-5.5':['5.5','GPT-5.5'],
    }[normalizeModelPreset(target)] || [];
    const lines = String(entry.innerText || entry.textContent || '')
      .split(/\n+/).map(value => normalize(value)).filter(Boolean);
    return short.some(expected => lines.some(value => value.toLowerCase() === expected.toLowerCase()));
  }
  let lastModelPickerTriggerClickAt = 0;
  async function pacedModelPickerClick(trigger, signal) {
    if (!trigger?.isConnected || !enabled(trigger)) return false;
    const remaining = MODEL_PICKER_MIN_CLICK_INTERVAL_MS - (Date.now() - lastModelPickerTriggerClickAt);
    if (remaining > 0) await delay(remaining, signal);
    check(signal);
    if (!trigger.isConnected || !enabled(trigger)) return false;
    lastModelPickerTriggerClickAt = Date.now();
    trigger.click();
    // Let ChatGPT commit the opened/closed surface before considering another
    // interaction. A subsequent retry is paced independently as well.
    await delay(220, signal);
    check(signal);
    return true;
  }
  async function closeModelPickerMenu(signal) {
    const trigger = modelPickerTrigger();
    if (!trigger) return;
    trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
    await delay(220, signal);
    check(signal);
    if (modelRadioOptions().length || trigger.getAttribute('aria-expanded') === 'true') {
      await pacedModelPickerClick(trigger, signal);
    }
  }
  function safeModelPickerDismissTarget(trigger) {
    // The real ChatGPT model submenu can ignore Escape and clicks on its
    // trigger until a pointer interaction lands outside its portal.
    // Never dismiss through Send, navigation, transcript or Fabushi controls.
    const candidates = nodes('main h1,main h2,[role="main"] h1,[role="main"] h2');
    return candidates.find(node => node.isConnected && visible(node) && !own(node)
      && node !== trigger && !node.contains(trigger)
      && !node.closest('button,a,[role="button"],[role="menu"],[role="dialog"],form,nav,aside')
      && !node.closest('[contenteditable="true"]')) || null;
  }
  async function dismissModelPickerOutside(trigger, signal) {
    const target = safeModelPickerDismissTarget(trigger);
    if (!target) return false;
    for (const type of ['pointerdown','mousedown','pointerup','mouseup','click']) {
      const EventClass = type.startsWith('pointer') && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
      target.dispatchEvent(new EventClass(type,{bubbles:true,cancelable:true,button:0}));
    }
    await delay(100,signal); check(signal);
    return !modelRadioOptions().length && trigger.getAttribute('aria-expanded') !== 'true';
  }
  async function reopenModelPicker(trigger, signal) {
    if (!trigger || !enabled(trigger) || !trigger.isConnected) return false;
    // Escape/hover alone is insufficient on the authenticated nested menu.
    trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
    trigger.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:document.body}));
    trigger.dispatchEvent(new MouseEvent('mouseleave',{bubbles:false,relatedTarget:document.body}));
    trigger.blur?.();
    await delay(90,signal); check(signal);
    if (modelRadioOptions().length || trigger.getAttribute('aria-expanded') === 'true') {
      if (!await dismissModelPickerOutside(trigger,signal)) {
        // Legacy first-level menus may still close through the trigger;
        // never trust that toggle while radio options remain visible.
        if (modelRadioOptions().length) return false;
        if (trigger.getAttribute('aria-expanded') === 'true') await pacedModelPickerClick(trigger, signal);
        await delay(90,signal); check(signal);
      }
    }
    if (modelRadioOptions().length || !enabled(trigger) || !trigger.isConnected) return false;
    if (trigger.getAttribute('aria-expanded') !== 'true') await pacedModelPickerClick(trigger, signal);
    await delay(120,signal); check(signal);
    return trigger.isConnected && trigger.getAttribute('aria-expanded') === 'true';
  }
  async function openModelRadioList(trigger, signal) {
    let radios = modelRadioOptions();
    if (radios.length) return radios;
    if (!trigger || trigger.getAttribute('aria-expanded') !== 'true') {
      if (!await pacedModelPickerClick(trigger, signal)) return [];
      await delay(120, signal); check(signal);
    }
    let entry = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      radios = modelRadioOptions();
      if (radios.length) return radios;
      entry = modelSubmenuEntry();
      if (entry) break;
      await delay(100, signal); check(signal);
    }
    if (!entry || !enabled(entry)) {
      // The menu may be showing radios or have lost its first-level item
      // during hydration. One bounded dismissal/reopen can restore it.
      if (!await reopenModelPicker(trigger,signal)) return [];
      entry = modelSubmenuEntry();
      if (!entry || !enabled(entry)) return [];
    }
    activateControl(entry);
    for (let attempt = 0; attempt < 20; attempt++) {
      await delay(100, signal); check(signal);
      radios = modelRadioOptions();
      if (radios.length) return radios;
    }
    if (await reopenModelPicker(trigger,signal)) {
      const retryEntry = modelSubmenuEntry();
      if (retryEntry && enabled(retryEntry)) {
        activateControl(retryEntry);
        for (let attempt=0;attempt<20;attempt++) {
          await delay(100,signal);check(signal);
          radios=modelRadioOptions();
          if (radios.length) return radios;
        }
      }
    }
    return [];
  }
  async function confirmModelRadioSelection(target, signal) {
    const trigger = modelPickerTrigger();
    if (!trigger) return false;
    const radios = await openModelRadioList(trigger, signal);
    if (!radios.length) return false;
    const option = modelRadioOption(target);
    return Boolean(option && enabled(option) && modelRadioSelected(option));
  }
  async function ensureTaskModelPreset(task, signal) {
    const target = taskModelPreset(task);
    let trigger = modelPickerTrigger();
    if (!trigger) {
      waitForReasoningPicker(task, '未找到 ChatGPT 模型选择器');
      return false;
    }

    // Older renderers exposed the selected model directly on the closed
    // trigger. Keep that safe fast path, but the current ChatGPT renderer uses
    // a two-level menu and is verified below through aria-checked radio state.
    if (modelTriggerMatches(trigger, target)) {
      await closeModelPickerMenu(signal);
      task.modelPresetConfirmedAt = Date.now();
      task.modelPresetConfirmedKey = target;
      return true;
    }

    const radios = await openModelRadioList(trigger, signal);
    if (radios.length) {
      let option = modelRadioOption(target);
      if (!option) {
        await closeModelPickerMenu(signal);
        waitForReasoningPicker(task, `ChatGPT 模型列表未提供所选模型：${modelPresetLabel(target)}`);
        return false;
      }
      if (!enabled(option)) {
        await closeModelPickerMenu(signal);
        waitForSendUI(task, `ChatGPT 当前账号暂不可用所选模型：${modelPresetLabel(target)}`);
        return false;
      }
      if (modelRadioSelected(option)) {
        await closeModelPickerMenu(signal);
        task.modelPresetConfirmedAt = Date.now();
        task.modelPresetConfirmedKey = target;
        return true;
      }

      activateControl(option);
      await delay(120, signal); check(signal);

      // Live ChatGPT returns from the radio list to the first popup after a
      // model click. Re-enter the visible "选择模型" row (whose text becomes
      // e.g. "5.6\n中") and require the target radio's aria-checked=true.
      if (await confirmModelRadioSelection(target, signal)) {
        await closeModelPickerMenu(signal);
        task.modelPresetConfirmedAt = Date.now();
        task.modelPresetConfirmedKey = target;
        log(task, `发送前已切换并确认 ChatGPT 模型：${modelPresetLabel(target)}。`);
        return true;
      }
      await closeModelPickerMenu(signal);
      waitForSendUI(task, `ChatGPT 模型切换后无法确认目标模型：${modelPresetLabel(target)}`);
      return false;
    }

    // Compatibility fallback for older one-level model menus.
    trigger = modelPickerTrigger();
    if (!trigger) {
      waitForReasoningPicker(task, 'ChatGPT 模型选择器在展开过程中消失');
      return false;
    }
    if (trigger.getAttribute('aria-expanded') !== 'true') {
      await pacedModelPickerClick(trigger, signal);
      await delay(120, signal); check(signal);
    }
    const entry = modelSubmenuEntry();
    if (entry && modelSubmenuHintMatches(entry, target)) {
      // The current renderer exposes a useful visible hint such as 5.6 on the
      // first-level row, but this hint is never enough to Send without the
      // authoritative radio-list confirmation above.
      await closeModelPickerMenu(signal);
      waitForReasoningPicker(task, `已看到 ${modelPresetLabel(target)} 的模型提示，但无法打开模型列表完成发送前确认`);
      return false;
    }
    const directOption = modelMenuOption(target);
    if (!directOption) {
      await closeModelPickerMenu(signal);
      waitForReasoningPicker(task, `ChatGPT 模型菜单未提供所选模型：${modelPresetLabel(target)}`);
      return false;
    }
    if (!enabled(directOption)) {
      await closeModelPickerMenu(signal);
      waitForSendUI(task, `ChatGPT 当前账号暂不可用所选模型：${modelPresetLabel(target)}`);
      return false;
    }
    activateControl(directOption);
    for (let attempt = 0; attempt < 8; attempt++) {
      await delay(120, signal); check(signal);
      trigger = modelPickerTrigger();
      if (trigger && modelTriggerMatches(trigger, target)) {
        await closeModelPickerMenu(signal);
        task.modelPresetConfirmedAt = Date.now();
        task.modelPresetConfirmedKey = target;
        log(task, `发送前已确认 ChatGPT 模型：${modelPresetLabel(target)}。`);
        return true;
      }
    }
    await closeModelPickerMenu(signal);
    waitForSendUI(task, `ChatGPT 模型切换后无法确认目标模型：${modelPresetLabel(target)}`);
    return false;
  }
  function clearReasoningPickerRecovery(task) {
    if (!task) return false;
    const changed = Boolean(task.reasoningPickerMissingSince
      || task.reasoningPickerLastRefreshAt
      || task.reasoningPickerRefreshCount);
    task.reasoningPickerMissingSince = 0;
    task.reasoningPickerLastRefreshAt = 0;
    task.reasoningPickerRefreshCount = 0;
    return changed;
  }
  function waitForReasoningPicker(task, reason = '未找到 ChatGPT 模型/思考强度选择器') {
    const now = Date.now();
    if (!task.reasoningPickerMissingSince) task.reasoningPickerMissingSince = now;
    const lastBoundary = Math.max(
      Number(task.reasoningPickerMissingSince || 0),
      Number(task.reasoningPickerLastRefreshAt || 0),
    );
    const due = now - lastBoundary >= REASONING_PICKER_REFRESH_MS;
    if (due && !navigating && !navigationRequestPending) {
      check();
      const href = location.href;
      const path = location.pathname;
      const count = Number(task.reasoningPickerRefreshCount || 0) + 1;
      task.reasoningPickerRefreshCount = count;
      task.reasoningPickerLastRefreshAt = now;
      task.sendUiWaitSince = 0;
      task.updatedAt = now;
      writeSessionStorageRecord(NAV, JSON.stringify({
        path,
        href,
        at:now,
        task:task.id,
        attempts:count,
        assigned:true,
        direct:true,
        purpose:'recovery',
        phase:String(task.phase || 'work'),
        round:Number(task.round || 0),
        goalRevision:Number(task.goalRevision || 0),
        recovery:true,
        reasoningPickerRecovery:true,
        resume:true,
      }));
      log(task, `${reason}；已等待至少 ${Math.ceil(REASONING_PICKER_REFRESH_MS / 1000)} 秒仍未出现，正在刷新当前 ChatGPT 页面重新检查（第 ${count} 次）。不会重复发送任务。`);
      save();
      return beginGuardedNavigation(href, task, {
        replace:true,
        force:true,
        recovery:true,
        ticketPath:path,
        ticketHref:href,
        reason:'reasoning-picker-recovery',
      });
    }
    const elapsed = Math.max(0, now - lastBoundary);
    const remaining = Math.max(0, REASONING_PICKER_REFRESH_MS - elapsed);
    const message = `${reason}；保留本轮发送意图继续检查，若仍未出现将在约 ${Math.max(1, Math.ceil(remaining / 1000))} 秒后刷新当前页面；不会重复发送。`;
    if (task.state === 'sending') log(task, message); else state(task, 'sending', message);
    task.updatedAt = now;
    save();
    return false;
  }
  function reasoningSliderState() {
    const control = nodes('[data-reasoning-slider="true"]').find(visible);
    const thumb = control?.querySelector?.('[role="slider"]');
    if (!control || !thumb) return null;
    const current = Number(thumb.getAttribute('aria-valuenow'));
    const min = Number(thumb.getAttribute('aria-valuemin'));
    const max = Number(thumb.getAttribute('aria-valuemax'));
    if (!Number.isInteger(current) || !Number.isInteger(min) || !Number.isInteger(max)) return null;
    return { control, thumb, current, min, max };
  }
  async function waitForReasoningSlider(signal) {
    const deadline = Date.now() + 2000;
    let strengthActivated = false;
    while (true) {
      const slider = reasoningSliderState();
      if (slider) return slider;
      // Keep one opening intact while React hydrates its contents. The
      // Strength item may itself be a toggle, so activate it at most once.
      if (!strengthActivated && !modelRadioOptions().length) {
        const strength = nodes('[role="menuitem"]').find(node => enabled(node)
          && /^(?:强度|Strength)$/i.test(normalize(node.getAttribute('aria-label') || label(node))));
        if (strength) { activateControl(strength); strengthActivated = true; }
      }
      if (Date.now() >= deadline) return null;
      await delay(Math.min(100, deadline - Date.now()), signal); check(signal);
    }
  }
  async function ensureTaskReasoningPreset(task, signal) {
    const target = taskReasoningPreset(task);
    let trigger = reasoningPickerTrigger();
    if (!trigger) {
      waitForReasoningPicker(task, '未找到 ChatGPT 模型/思考强度选择器');
      return false;
    }
    if (clearReasoningPickerRecovery(task)) {
      task.updatedAt = Date.now();
      save();
    }
    // Closed-trigger text is a cheap no-mutation fast path. It is not used for
    // Pro vs Medium identity because both can expose effort=medium.
    const closedText = normalize(trigger.innerText || trigger.textContent);
    const effort = trigger.getAttribute('data-selected-reasoning-effort') || '';
    const unambiguousMatch = target === 0 ? effort === 'none'
      : target === 2 ? effort === 'high'
      : target === 3 ? effort === 'max'
      : false;
    if (unambiguousMatch && trigger.getAttribute('aria-expanded') !== 'true') {
      task.reasoningPresetConfirmedAt = Date.now();
      task.reasoningPresetConfirmedIndex = target;
      return true;
    }

    if (trigger.getAttribute('aria-expanded') !== 'true') {
      await pacedModelPickerClick(trigger, signal);
      await delay(120, signal); check(signal);
    }
    let slider = await waitForReasoningSlider(signal);
    if (!slider) {
      trigger = reasoningPickerTrigger();
      if (await reopenModelPicker(trigger, signal)) slider = await waitForReasoningSlider(signal);
    }
    if (!slider) {
      await closeModelPickerMenu(signal);
      waitForReasoningPicker(task, 'ChatGPT 模型菜单已打开，但强度滑块暂时消失，重新打开后仍未恢复');
      return false;
    }
    if (target < slider.min || target > slider.max) {
      trigger = reasoningPickerTrigger();
      if (trigger?.getAttribute('aria-expanded') === 'true') await pacedModelPickerClick(trigger, signal);
      waitForSendUI(task, `ChatGPT 当前模型菜单不支持所选档位：${reasoningPresetLabel(target)}`);
      return false;
    }

    const direction = target > slider.current ? 'ArrowRight' : 'ArrowLeft';
    for (let step = 0; step < 8 && slider.current !== target; step++) {
      slider.control.focus?.();
      slider.control.dispatchEvent(new KeyboardEvent('keydown', {
        key:direction,
        code:direction,
        bubbles:true,
        cancelable:true,
      }));
      await delay(120, signal); check(signal);
      let next = reasoningSliderState();
      if (!next) {
        next = await waitForReasoningSlider(signal);
        if (!next) {
          trigger = reasoningPickerTrigger();
          if (await reopenModelPicker(trigger, signal)) next = await waitForReasoningSlider(signal);
        }
        if (!next) {
          waitForReasoningPicker(task, '调整 ChatGPT 思考强度时滑块消失，重新打开后仍未恢复');
          return false;
        }
      }
      if (next.current === slider.current) {
        trigger = reasoningPickerTrigger();
        if (trigger?.getAttribute('aria-expanded') === 'true') await pacedModelPickerClick(trigger, signal);
        waitForReasoningPicker(task, `ChatGPT 思考强度未能切换到：${reasoningPresetLabel(target)}`);
        return false;
      }
      slider = next;
    }

    if (slider.current !== target) {
      trigger = reasoningPickerTrigger();
      if (trigger?.getAttribute('aria-expanded') === 'true') await pacedModelPickerClick(trigger, signal);
      waitForReasoningPicker(task, `ChatGPT 思考强度校验失败；目标 ${reasoningPresetLabel(target)}，当前第 ${slider.current + 1} 档`);
      return false;
    }
    task.reasoningPresetConfirmedAt = Date.now();
    task.reasoningPresetConfirmedIndex = target;
    trigger = reasoningPickerTrigger();
    if (trigger?.getAttribute('aria-expanded') === 'true') {
      await pacedModelPickerClick(trigger, signal);
      await delay(80, signal); check(signal);
    }
    return true;
  }
  function attachmentInputFor(input = composer(), preferredMetas = []) {
    const form = input?.closest?.('form');
    const composerHost = input?.closest?.('[data-testid*="composer"],[data-testid*="Composer"]') || form;
    // ChatGPT has rendered the native picker both inside and outside the
    // composer form over time. Prefer the form-local control, but fall back
    // to the page-level picker when the app portals it elsewhere. `nodes`
    // excludes the Fabushi workbench's own picker.
    const candidates = [...new Set([
      ...(form ? nodes('input[type="file"]', form) : []),
      ...nodes('input[type="file"]'),
    ])];
    return candidates
      .filter(node => !node.disabled)
      .sort((left, right) => {
        const score = node => {
          let value = Number(node.multiple) * 4 + (node.accept ? 1 : 0);
          if (form && node.closest?.('form') === form) value += 100;
          if (composerHost && (composerHost === node || composerHost.contains?.(node))) value += 50;
          if (node.files?.length) value += 2;
          if (preferredMetas.length) {
            const files = Array.from(node.files || []);
            value += preferredMetas.filter(meta => files.some(file => attachmentFileMatches(meta, file))).length * 200;
          }
          return value;
        };
        const leftScore = score(left);
        const rightScore = score(right);
        return rightScore - leftScore;
      })[0] || null;
  }
  function composerScope(input) {
    return input?.closest?.('form,[data-testid*="composer"],[data-testid*="Composer"]') || input?.parentElement || null;
  }
  function attachmentScopeChain(node, maxDepth = 4) {
    const result = [];
    let current = node;
    for (let depth = 0; current && depth <= maxDepth; depth++, current = current.parentElement) {
      if (own(current)) break;
      if (depth > 0 && current.matches?.(`main,body,html,nav,aside,header,footer,[role="navigation"],[role="banner"],[role="contentinfo"],${conversationRoleSelector}`)) break;
      result.push(current);
    }
    return result;
  }
  function attachmentScopes(input) {
    const primary = composerScope(input);
    if (!primary) return [];
    const picker = attachmentInputFor(input);
    const result = [];
    const seen = new Set();
    const add = node => {
      if (!node || seen.has(node) || own(node)) return;
      seen.add(node);
      result.push(node);
    };
    // Include the form and only its nearby composer ancestors. This catches a
    // preview rendered beside the form without treating an arbitrary filename
    // elsewhere in <main> as proof that this task's file was uploaded.
    attachmentScopeChain(primary).forEach(add);
    // A page-level picker may live in a small portal sibling of the form. Its
    // own nearby chain lets confirmation follow that portal without widening
    // the search to the whole document.
    if (picker && !primary.contains?.(picker)) attachmentScopeChain(picker).forEach(add);
    return result;
  }
  function attachmentSurfaceNodes(input, selector = '*') {
    const result = [];
    const seen = new Set();
    const add = node => {
      if (!node || seen.has(node) || own(node)) return;
      seen.add(node);
      result.push(node);
    };
    for (const scope of attachmentScopes(input)) {
      if (scope.matches?.(selector)) add(scope);
      nodes(selector, scope).forEach(add);
    }
    return result;
  }
  function attachmentSurfaceExcluded(node) {
    return Boolean(node?.matches?.('textarea,[contenteditable="true"],input[type="file"]')
      || node?.closest?.(`${conversationRoleSelector},nav,aside,header,footer,[role="navigation"],[role="banner"],[role="contentinfo"]`));
  }
  function attachmentFileMatches(meta, file) {
    if (!meta || !file) return false;
    const name = String(meta.name || '').trim().toLocaleLowerCase();
    if (!name || String(file.name || '').trim().toLocaleLowerCase() !== name) return false;
    if (Number.isFinite(Number(meta.size)) && Number(file.size) !== Number(meta.size)) return false;
    const expectedType = String(meta.type || '').trim().toLocaleLowerCase();
    const actualType = String(file.type || '').trim().toLocaleLowerCase();
    return !expectedType || !actualType || expectedType === actualType;
  }
  function attachmentFileListReady(metas, input) {
    const fileInput = attachmentInputFor(input, metas);
    const files = Array.from(fileInput?.files || []);
    if (files.length !== metas.length) return false;
    const unmatched = files.slice();
    return metas.every(meta => {
      const index = unmatched.findIndex(file => attachmentFileMatches(meta, file));
      if (index < 0) return false;
      unmatched.splice(index, 1);
      return true;
    });
  }
  function assignFilesToInput(fileInput, files) {
    const source = Array.from(files || []);
    if (!fileInput || fileInput.disabled || !source.length || typeof DataTransfer !== 'function') return false;
    try {
      const transfer = new DataTransfer();
      if (!transfer.items?.add) return false;
      source.forEach(file => transfer.items.add(file));
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event('input', { bubbles:true }));
      fileInput.dispatchEvent(new Event('change', { bubbles:true }));
      return Number(fileInput.files?.length || 0) === source.length;
    } catch { return false; }
  }
  function pasteFilesToComposer(input, files) {
    const source = Array.from(files || []);
    if (!input || !source.length || typeof DataTransfer !== 'function') return false;
    try {
      const transfer = new DataTransfer();
      if (!transfer.items?.add) return false;
      source.forEach(file => transfer.items.add(file));
      let event;
      if (typeof ClipboardEvent === 'function') {
        try { event = new ClipboardEvent('paste', { bubbles:true, cancelable:true, clipboardData:transfer }); } catch {}
      }
      if (!event) event = new Event('paste', { bubbles:true, cancelable:true });
      try { Object.defineProperty(event, 'clipboardData', { configurable:true, value:transfer }); } catch {}
      input.dispatchEvent(event);
      return true;
    } catch { return false; }
  }
  function attachmentSurfaceValues(input) {
    const values = [];
    for (const node of attachmentSurfaceNodes(input)) {
      if (attachmentSurfaceExcluded(node)) continue;
      const nodeText = text(node);
      if (nodeText) values.push(nodeText);
      for (const attribute of ['aria-label','title','alt','data-file-name','data-filename','data-name','data-testid']) {
        const value = normalize(node.getAttribute?.(attribute));
        if (value) values.push(value);
      }
    }
    return values;
  }
  function attachmentUploadError(input) {
    const pattern = /上传(?:失败|错误|中断)|failed to upload|upload (?:failed|error)|file (?:upload )?(?:failed|error)|unsupported (?:file|format)|(?:file|format)(?: type)? (?:is )?(?:not )?supported|file (?:is )?too large|文件(?:类型)?(?:不支持|过大|太大|上传失败)/i;
    const seen = new Set();
    for (const scope of attachmentScopes(input)) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      let currentNode;
      while ((currentNode = walker.nextNode())) {
        if (seen.has(currentNode)) continue;
        seen.add(currentNode);
        const parent = currentNode.parentElement;
        if (!parent || attachmentSurfaceExcluded(parent) || !visible(parent)) continue;
        const value = normalize(currentNode.nodeValue);
        if (pattern.test(value)) return value.slice(0, 180);
      }
    }
    return '';
  }
  function attachmentReady(taskOrMetas, input = composer()) {
    const metas = Array.isArray(taskOrMetas) ? taskOrMetas : taskAttachments(taskOrMetas);
    if (!metas.length) return true;
    if (!attachmentScopes(input).length) return false;
    const pendingSelectors = '[aria-busy="true"],[data-state="loading"],[data-state="uploading"],[data-testid*="uploading"],[data-testid*="Uploading"],[data-testid*="progress"],[data-testid*="Progress"]';
    const pending = attachmentSurfaceNodes(input, pendingSelectors).filter(visible);
    if (pending.length) return false;
    // Once ChatGPT has accepted the native picker, its FileList is a stronger
    // acknowledgment than a generic image/file node. It also covers portal
    // UIs that render the preview outside the composer form.
    const nativeInputStable = Array.isArray(taskOrMetas)
      || (taskOrMetas?.attachmentUploadPending
        && Date.now() - Number(taskOrMetas.attachmentLastAttemptAt || 0) >= ATTACHMENT_NATIVE_INPUT_STABLE_MS);
    if (nativeInputStable && attachmentFileListReady(metas, input)) return true;
    const values = attachmentSurfaceValues(input).map(value => value.toLocaleLowerCase());
    const named = metas.filter(meta => {
      const name = String(meta?.name || '').trim().toLocaleLowerCase();
      return name && values.some(value => value.includes(name));
    });
    if (named.length === metas.length) return true;
    const labelledPreviewSelectors = '[data-file-name],[data-filename]';
    const labelledPreviews = attachmentSurfaceNodes(input, labelledPreviewSelectors).filter(visible);
    if (labelledPreviews.length) {
      const matchedLabelledPreviews = labelledPreviews.filter(node => {
        const values = [node.getAttribute('data-file-name'), node.getAttribute('data-filename'), text(node)]
          .map(value => normalize(value).toLocaleLowerCase()).filter(Boolean);
        return metas.some(meta => {
          const name = String(meta?.name || '').trim().toLocaleLowerCase();
          return name && values.some(value => value.includes(name));
        });
      });
      return matchedLabelledPreviews.length >= metas.length;
    }
    const previewSelectors = 'img,video,audio,object,embed,[data-testid*="attachment"],[data-testid*="Attachment"],[data-testid*="file"],[data-testid*="File"]';
    const previews = attachmentSurfaceNodes(input, previewSelectors).filter(node => visible(node)
      && !attachmentSurfaceExcluded(node)
      && !node.matches?.('button,label,input,textarea,[contenteditable="true"]')
      && !node.closest?.('button,label,[role="button"]'));
    return previews.length >= metas.length;
  }
  function attachmentRetryDelayMs(attempt) {
    const count = Math.max(1, Number(attempt || 1));
    return Math.min(ATTACHMENT_AUTO_RETRY_BASE_MS * (2 ** Math.min(count - 1, 4)), ATTACHMENT_AUTO_RETRY_MAX_MS);
  }
  function attachmentFailureRequiresUserAction(reason) {
    const value = String(reason || '');
    return /(?:浏览器|本地附件|附件记录|文件).*(?:不支持|不存在|缺少|重新选择|无法保存|数量不一致)|indexeddb|storage quota|quota exceeded|unsupported (?:file|format)|(?:file|format)(?: type)? (?:is )?(?:not )?supported|file (?:is )?too large|(?:文件|附件).*(?:不支持|过大|太大)/i.test(value);
  }
  function attachmentDispatchContextFor(task, input) {
    if (!task) return null;
    const token = String(task.token || '');
    const route = `${location.pathname}${location.search}`;
    const previous = attachmentDispatchContexts.get(task.id);
    const previousInput = previous?.inputRef?.deref?.() || null;
    if (previous && previous.token === token && previousInput === input && previous.route === route) return previous;
    // A document reload, SPA route change, or composer re-render invalidates
    // the old page-local upload attempt. Preserve retry/backoff and the
    // IndexedDB reference, but force the new composer to receive a fresh
    // FileList/paste event before this dispatch can send.
    task.attachmentUploadPending = false;
    task.attachmentUploadStartedAt = 0;
    task.attachmentLastAttemptAt = 0;
    // WeakRef prevents a SPA composer subtree from being retained solely by
    // this retry map after ChatGPT replaces the input node.
    const context = {
      token,
      inputRef:typeof WeakRef === 'function' ? new WeakRef(input) : null,
      route,
      confirmed:false,
    };
    attachmentDispatchContexts.set(task.id, context);
    return context;
  }
  function resetAttachmentUploadState(task, options = {}) {
    if (!task) return;
    task.attachmentUploadPending = false;
    task.attachmentUploadFailed = false;
    delete task.attachmentUploadLastError;
    task.attachmentUploadStartedAt = 0;
    task.attachmentLastAttemptAt = 0;
    task.attachmentUploadRetryAt = 0;
    task.attachmentUploadRetryCount = 0;
    if (!options.keepContext) attachmentDispatchContexts.delete(task.id);
  }
  function failAttachmentUpload(task, reason) {
    const message = String(reason || '').slice(0, 240);
    task.attachmentUploadPending = false;
    task.attachmentUploadFailed = true;
    task.attachmentUploadLastError = message;
    task.attachmentUploadStartedAt = 0;
    task.attachmentLastAttemptAt = 0;
    if (attachmentFailureRequiresUserAction(message)) {
      task.attachmentUploadRetryAt = 0;
      state(task, 'blocked', `附件上传未确认，未发送纯文字目标。${message ? ` ${message}` : ''} 将自动新开会话并重试附件；若浏览器已清理文件内容，任务保持自动重试而不会降级为纯文字发送。`);
    } else {
      const attempt = Number(task.attachmentUploadRetryCount || 0) + 1;
      const retryMs = attachmentRetryDelayMs(attempt);
      task.attachmentUploadRetryCount = attempt;
      task.attachmentUploadRetryAt = Date.now() + retryMs;
      const retryMessage = `附件上传暂未确认${message ? `：${message}` : ''}；将在 ${Math.ceil(retryMs / 1000)} 秒后自动重试，确认前不会发送任务。`;
      if (task.state === 'uploading') log(task, retryMessage);
      else state(task, 'uploading', retryMessage);
    }
    save();
    return false;
  }
  function holdForChatGPTLoading(task, reason = pageLoadingState()) {
    if (!reason) return true;
    // A page reload/route hydration can discard a synthetic file selection.
    // Clear only the transient upload attempt; the IndexedDB-backed task
    // attachment remains available for a fresh injection once the page is
    // ready. This prevents the old 45-second timer from firing during load.
    if (task && taskAttachments(task).length) {
      task.attachmentUploadPending = false;
      task.attachmentUploadStartedAt = 0;
      task.attachmentLastAttemptAt = 0;
    }
    if (task) {
      task.sendUiWaitSince = 0;
      state(task, 'loading', reason);
      save();
    }
    return false;
  }
  async function ensureTaskAttachments(task, input, signal) {
    const attachments = taskAttachments(task);
    if (!attachments.length) return true;
    const context = attachmentDispatchContextFor(task, input);
    if (pageLoadingState()) {
      holdForChatGPTLoading(task);
      return false;
    }
    if (context?.confirmed) return true;
    // This only accepts an attachment surface that is present in the current
    // composer. It is safe for a task to have been manually/previously
    // attached in this same rendered composer, but it cannot carry a stale
    // acknowledgement across a new context.
    if (attachmentReady(attachments, input)) {
      if (context) context.confirmed = true;
      if (task.attachmentUploadPending || task.attachmentUploadFailed || task.state === 'loading') {
        resetAttachmentUploadState(task, { keepContext: true });
        if (task.state === 'uploading' || task.state === 'loading') state(task, 'sending', '附件已在当前会话中确认，继续发送任务。');
        save();
      }
      return true;
    }
    const now = Date.now();
    const retryAt = Number(task.attachmentUploadRetryAt || 0);
    if (task.attachmentUploadFailed && retryAt > now) {
      state(task, 'uploading', `附件尚未确认，约 ${Math.ceil((retryAt - now) / 1000)} 秒后自动重试；确认前不会发送任务。`);
      return false;
    }
    if (task.attachmentUploadFailed && retryAt > 0 && retryAt <= now) {
      task.attachmentUploadFailed = false;
      task.attachmentUploadRetryAt = 0;
      task.attachmentUploadPending = false;
      task.attachmentUploadStartedAt = 0;
      task.attachmentLastAttemptAt = 0;
      log(task, '附件自动重试时间到，继续尝试当前任务；确认附件出现前不会发送。');
    }
    // A zero retry time denotes a permanent/manual-action failure. The UI's
    // explicit retry action clears it; never silently turn it into a send.
    if (task.attachmentUploadFailed) return false;
    const startedAt = Number(task.attachmentUploadStartedAt || 0);
    if (task.attachmentUploadPending && startedAt && now - startedAt >= ATTACHMENT_UPLOAD_WAIT_MS) {
      return failAttachmentUpload(task, '等待 ChatGPT 显示附件已超过 45 秒。');
    }
    if (task.attachmentUploadPending && now - Number(task.attachmentLastAttemptAt || 0) < ATTACHMENT_RETRY_INTERVAL_MS) {
      state(task, 'uploading', '正在等待 ChatGPT 完成附件上传，不会提前发送。');
      return false;
    }
    check(signal);
    let files;
    try { files = await loadTaskAttachmentFiles(task); } catch (error) { return failAttachmentUpload(task, error.message); }
    check(signal);
    const uploadStartedAt = startedAt || Date.now();
    task.attachmentUploadPending = true;
    task.attachmentUploadStartedAt = uploadStartedAt;
    task.attachmentLastAttemptAt = Date.now();
    task.attachmentUploadFailed = false;
    state(task, 'uploading', `正在向 ChatGPT 上传 ${attachments.length} 个附件；确认完成后才会发送任务。`);
    save();
    const fileInput = attachmentInputFor(input);
    const assigned = assignFilesToInput(fileInput, files);
    const pasted = assigned ? false : pasteFilesToComposer(input, files);
    if (!assigned && !pasted) return failAttachmentUpload(task, '当前 ChatGPT 页面没有可用的附件输入控件。');
    const deadline = uploadStartedAt + ATTACHMENT_UPLOAD_WAIT_MS;
    while (Date.now() < deadline) {
      check(signal);
      if (pageLoadingState()) {
        holdForChatGPTLoading(task);
        return false;
      }
      const currentInput = composer() || input;
      if (currentInput !== input) {
        // ChatGPT can replace the composer while the upload is settling. Do
        // not confirm the new node from the old node; the next scheduler
        // pass will rehydrate and inject the same persisted files there.
        attachmentDispatchContextFor(task, currentInput);
        state(task, 'uploading', 'ChatGPT composer 已重建，正在重新注入本轮附件；确认前不会发送任务。');
        save();
        return false;
      }
      const uploadError = attachmentUploadError(currentInput);
      if (uploadError) return failAttachmentUpload(task, `ChatGPT 返回：${uploadError}`);
      if (attachmentReady(task, currentInput)) {
        if (context) context.confirmed = true;
        resetAttachmentUploadState(task, { keepContext: true });
        state(task, 'sending', '附件上传已确认，继续发送任务。');
        save();
        return true;
      }
      await delay(250, signal);
    }
    return failAttachmentUpload(task, '等待 ChatGPT 显示附件已超过 45 秒。');
  }
  function retryAttachmentUpload(task) {
    if (!taskBelongsToTab(task) || !taskAttachments(task).length) return Promise.resolve(false);
    resetAttachmentUploadState(task);
    task.state = 'queued';
    task.updatedAt = Date.now();
    selected = task.id;
    current = task.id;
    lastSwitch = Date.now();
    log(task, '已重置附件上传状态，重新尝试上传；确认附件出现前不会发送任务。');
    save();
    if (running) { schedule(100); return Promise.resolve(true); }
    return start(false).then(() => true);
  }
  function stopButton() { return nodes('button[data-testid="stop-button"],button[aria-label*="Stop"],button[aria-label*="停止"]').find(visible); }
  function blocker() {
    if (document.querySelector('iframe[src*="challenges.cloudflare.com"],#challenge-running')) return '页面需要完成安全验证';
    return '';
  }
  const historyAccessThrottlePattern = /(?:请求过于频繁|你的请求过于频繁|too many requests|request(?:s)? too frequent)[\s\S]{0,240}(?:暂时|临时|temporar(?:ily|y))?[\s\S]{0,120}(?:限制|无法|不能|restrict(?:ed|ion)?|limit(?:ed|ation)?)[\s\S]{0,120}(?:访问|查看|读取|access|view|load)[\s\S]{0,120}(?:对话记录|聊天记录|历史(?:记录|会话)?|conversation history|chat history|previous conversations?)/i;
  const historyAccessAckLabel = /^(?:明白|明白了|知道了|我知道了|好的|好|确定|确认|收到|ok|okay|got it|understood|i understand)$/iu;
  function historyAccessThrottleContainer(node = null) {
    let current = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
      if (own(current)) return null;
      const value = normalize(textTail(current, 1200));
      if (historyAccessThrottlePattern.test(value)) return current;
      if (current.matches?.('main,body,html')) break;
    }
    return null;
  }
  function historyAccessThrottlePopup(getPageRecords = pageUiTextRecords) {
    const headline = /请求过于频繁|你的请求过于频繁|too many requests|request(?:s)? too frequent/i;
    for (const record of getPageRecords()) {
      const parent = record.parent;
      if (!parent || !headline.test(record.direct)) continue;
      let scope = parent;
      for (let depth = 0; scope && depth < 12; depth += 1, scope = scope.parentElement) {
        if (own(scope) || scope.matches?.('body,html')) break;
        const value = normalize(text(scope));
        if (!historyAccessThrottlePattern.test(value)) continue;
        const actions = nodes('button,[role="button"]', scope).filter(enabled);
        const acknowledge = actions.find(node => [text(node), node.getAttribute('aria-label'), node.getAttribute('title')]
          .some(labelValue => historyAccessAckLabel.test(normalize(labelValue))));
        if (acknowledge) return { container:scope, button:acknowledge };
      }
    }
    return null;
  }
  function rateLimitNotice(getPageRecords = pageUiTextRecords) {
    const startedAt = performance.now();
    const pattern = /请求过于频繁|你的请求过于频繁|请稍等几分钟后再重试|访问频率受限|too many requests|rate limit/i;
    // Inspect actual page notices, never the task transcript or this panel.
    // A separate ChatGPT popup can say requests are frequent while only
    // restricting access to older conversation/history records. That popup
    // does not throttle the current/new chat path, so it is explicitly ignored
    // here and acknowledged by dismissUnexpectedModals().
    try {
      for (const record of getPageRecords()) {
        const parent = record.parent;
        // Check the cheap direct text first. The former order walked up every
        // ordinary page label and materialized each ancestor's full text,
        // including the entire transcript inside <main>, on every tick.
        if (!parent || !pattern.test(record.direct) || !visible(parent)) continue;
        scanDiagnostics.rateLimitAncestorChecks += 1;
        if (historyAccessThrottleContainer(parent)) continue;
        return '检测到 ChatGPT 请求过于频繁；插件进入休息等待，不发送新请求、不刷新页面。';
      }
      return '';
    } finally {
      scanDiagnostics.rateLimitCalls += 1;
      scanDiagnostics.rateLimitMs += performance.now() - startedAt;
    }
  }
  function currentResponseAssistantArticles(turn = null) {
    const article = turn?.article;
    if (!article || own(article)) return [];
    const scope = article.closest?.('main,[role="main"]') || article.parentElement || document.body;
    if (!scope) return [article];
    const follows = (from, to) => Boolean(from && to && (from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING));
    const users = conversationRoleNodes('user', scope);
    const boundary = users.filter(user => follows(user, article)).at(-1) || null;
    const roots = [];
    const seen = new Set();
    for (const assistant of conversationRoleNodes('assistant', scope)) {
      if (boundary && !follows(boundary, assistant)) continue;
      const messageUnit = conversationMessageUnit(assistant, 'assistant') || assistant;
      const transientPrimary = !contentSearchUnitRole(messageUnit)
        && messageUnit?.matches?.('[data-markdown-text-style="assistant-message"][data-markdown-text-tone="primary"]')
        && messageUnit.closest?.(contentSearchTurnSelector)
          ? messageUnit
          : null;
      const root = contentSearchUnitRole(messageUnit) === 'assistant'
        ? messageUnit
        : transientPrimary
          || assistant.closest?.('article,[data-testid^="conversation-turn-"],[data-turn-key],[data-content-search-turn-key]')
          || assistant;
      if (own(root) || seen.has(root)) continue;
      seen.add(root);
      roots.push(root);
    }
    // A single response can contain several assistant segments, but a broken
    // renderer must not turn this bounded current-response read into another
    // whole-history traversal.
    return roots.slice(-32);
  }
  function responseTextNodes(turn = null) {
    const startedAt = performance.now();
    const records = [];
    for (const article of currentResponseAssistantArticles(turn)) {
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
      let currentNode;
      while ((currentNode = walker.nextNode())) {
        const parent = currentNode.parentElement;
        if (!parent || own(parent) || parent.closest?.('blockquote,pre,code')
          || conversationRole(parent.closest?.(conversationRoleSelector)) === 'user') continue;
        records.push({ node:currentNode, parent, direct:normalize(currentNode.nodeValue) });
      }
    }
    scanDiagnostics.responseCalls += 1;
    scanDiagnostics.responseMs += performance.now() - startedAt;
    scanDiagnostics.responseTextNodes += records.length;
    return records;
  }
  function streamCacheExpiredRetry(turn, getPageRecords = pageUiTextRecords) {
    const article = turn?.article;
    if (!article) return null;
    const follows = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    const user = conversationRoleNodes('user').at(-1);
    for (const record of [...responseTextNodes(turn), ...getPageRecords()]) {
      const parent = record.parent;
      if (!parent || !/^stream cache expired[.!]?$/i.test(record.direct) || !visible(parent)
        || own(parent) || parent.closest('blockquote,pre,code')
        || conversationRole(parent.closest?.(conversationRoleSelector)) === 'user') continue;
      if (!article.contains(parent) && !follows(article, parent)) continue;
      if (user && !follows(user, parent)) continue;
      // Stop at the local card/turn: an unrelated Retry elsewhere on the page
      // must not turn quoted or historical text into an actionable failure.
      for (let scope = parent, depth = 0; scope && depth < 4; scope = scope.parentElement, depth += 1) {
        if (scope.matches('main,[role="main"],body') || own(scope)) break;
        const retry = nodes('button,[role="button"]', scope).find(control =>
          visible(control) && enabled(control) && /^(?:重试|再次尝试|再试一次|retry|try again)$/i.test(label(control)));
        if (retry) return retry;
        if (scope === article) break;
      }
    }
    return null;
  }
  function sendTimeoutNotice(turn = null, getPageRecords = pageUiTextRecords) {
    const pattern = /消息(?:发送)?(?:超时|错误|失败)\s*[，,。.!]?\s*请重试|message (?:send|sending) timed out|message (?:error|failed)[\s,:-]*(?:please )?(?:retry|try again)|failed to send|(?:a\s+)?network (?:connection )?(?:error|failure)(?: occurred)?|connection (?:error|failed|failure)|(?:check|verify) (?:your )?(?:internet|network|connection)|网络(?:连接)?(?:错误|失败)|连接(?:错误|失败)|(?:请)?检查(?:一下)?(?:你的|您的)?(?:互联网|网络|连接)/i;
    const retryPattern = /^(?:重试|再次尝试|再试一次|retry|try again|again)(?:\b|$)/i;
    const retryControls = 'button,a,[role="button"]';
    const hasRetryControl = node => {
      let scope = node?.parentElement || null;
      for (let depth = 0; scope && depth < 8; depth += 1, scope = scope.parentElement) {
        const controls = [];
        if (scope.matches?.(retryControls)) controls.push(scope);
        controls.push(...nodes(retryControls, scope));
        if (controls.some(control => visible(control) && retryPattern.test(label(control)))) return true;
      }
      return false;
    };
    const responseTurn = turn || (() => {
      const assistant = conversationRoleNodes('assistant').at(-1);
      const assistantUnit = conversationMessageUnit(assistant, 'assistant') || assistant;
      const article = contentSearchUnitRole(assistantUnit) === 'assistant'
        ? assistantUnit
        : assistant?.closest?.('article,[data-testid^="conversation-turn-"],[data-turn-key],[data-content-search-turn-key]') || assistant;
      return article ? { article } : null;
    })();
    // A visible assistant error is actionable only when it belongs to the
    // current response lane and has a nearby retry control. The previous
    // body-wide walker visited every historical token on every inspection;
    // keep this read bounded to the current response instead.
    for (const record of responseTextNodes(responseTurn)) {
      const parent = record.parent;
      if (!parent || !pattern.test(record.direct) || !visible(parent)) continue;
      if (hasRetryControl(parent)) return true;
    }
    // A visible page-level error is actionable. Page chrome is scanned
    // separately and deliberately skips the transcript subtree.
    for (const record of getPageRecords()) {
      const parent = record.parent;
      if (!parent || !pattern.test(record.direct) || !visible(parent)) continue;
      const message = parent.closest(conversationRoleSelector);
      if (!message) return true;
    }
    return false;
  }
  const streamRecoveryPollingTimeoutPattern = /^ChatGPT stream recovery polling timed out[.!]?$/i;
  const retryActionPattern = /^(?:重试|再次尝试|再试一次|retry|try again|again)(?:\b|$)/i;
  function hasVisibleRetryAction(node) {
    const retryControls = 'button,a,[role="button"]';
    let scope = node?.parentElement || null;
    for (let depth = 0; scope && depth < 8; depth += 1, scope = scope.parentElement) {
      const controls = [];
      if (scope.matches?.(retryControls)) controls.push(scope);
      controls.push(...nodes(retryControls, scope));
      if (controls.some(control => visible(control) && retryActionPattern.test(label(control)))) return true;
    }
    return false;
  }
  function streamRecoveryPollingTimeoutNotice(turn = null) {
    const scopedArticle = turn?.owned ? turn.article : null;
    if (!scopedArticle) return false;
    const walker = document.createTreeWalker(scopedArticle, NodeFilter.SHOW_TEXT);
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      const parent = currentNode.parentElement;
      if (!parent || own(parent) || parent.closest('blockquote,pre,code')
        || conversationRole(parent.closest?.(conversationRoleSelector)) === 'user') continue;
      const direct = normalize(currentNode.nodeValue);
      if (direct && direct.length <= 160 && streamRecoveryPollingTimeoutPattern.test(direct)
        && visible(parent) && hasVisibleRetryAction(parent)) return true;
    }
    return false;
  }
  const conversationLengthLimitPattern = /(?:你已达到(?:此|本)对话的(?:长度上限|最大长度)[，,。.!；;\s]*(?:你)?可以(?:开始|开启|新建)(?:一个)?新(?:的)?(?:聊天|对话)(?:以|来)?继续(?:对话|聊天)?|(?:you(?:'|’)?ve|you have|this conversation has) reached (?:the )?(?:maximum|max) (?:length|conversation length)(?: for| of)? (?:this|the)?\s*conversation.*?(?:keep (?:talking|chatting)|continue).*?(?:start(?:ing)?|open(?:ing)?|begin(?:ning)?) (?:a )?new chat)/i;
  function conversationLengthLimitNotice(turn = null, getPageRecords = pageUiTextRecords) {
    const matches = value => conversationLengthLimitPattern.test(normalize(value));
    const scopedArticle = turn?.owned ? turn.article : null;
    if (scopedArticle) {
      const textByParent = new WeakMap();
      for (const record of responseTextNodes(turn)) {
        const parent = record.parent;
        const direct = record.direct;
        if (!parent) continue;
        // The product notice is a short standalone UI sentence/paragraph.
        // Refuse long prose containers so an assistant discussing or quoting
        // the sentence as ordinary task content does not recursively trigger.
        const directMatch = direct && direct.length <= 600 && matches(direct);
        let block = '';
        if (!directMatch && parent?.childElementCount) {
          if (!textByParent.has(parent)) textByParent.set(parent, boundedTextContent(parent, 600));
          block = textByParent.get(parent) || '';
        }
        if ((directMatch || (block && matches(block))) && visible(parent)) {
          return (block || direct).slice(0, 2000);
        }
      }
    }
    // Some ChatGPT builds render the notice as page chrome rather than inside
    // the assistant turn. Exclude every transcript turn and the Fabushi panel
    // so user quotations and our own recovery log can never self-trigger.
    const textByParent = new WeakMap();
    for (const record of getPageRecords()) {
      const parent = record.parent;
      if (!parent) continue;
      const direct = record.direct;
      const directMatch = direct && direct.length <= 600 && matches(direct);
      let block = '';
      if (!directMatch && parent.childElementCount) {
        if (!textByParent.has(parent)) textByParent.set(parent, boundedTextContent(parent, 600));
        block = textByParent.get(parent) || '';
      }
      if ((directMatch || (block && matches(block))) && visible(parent)) {
        return (block || direct).slice(0, 2000);
      }
    }
    return '';
  }
  function boundedConversationLengthCarry(value) {
    const reply = String(value || '').trim();
    if (reply.length <= CONVERSATION_LENGTH_CARRY_MAX) return reply;
    const half = Math.floor((CONVERSATION_LENGTH_CARRY_MAX - 120) / 2);
    return `${reply.slice(0, half)}\n\n[...上一会话回复中间内容因长度过大省略...]\n\n${reply.slice(-half)}`;
  }
  function cleanConversationLengthReply(value) {
    // The recognized product notice can appear in the same assistant turn as
    // the work. It explains why the handoff is needed, but is not work context.
    const source = String(value || '')
      .replace(conversationLengthLimitPattern, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
      .trim();
    return boundedConversationLengthCarry(source);
  }
  const connectionInterruptedPattern = /^(?:连接已中断[，,。.!；;：:\s]*正在等待完整(?:回复|答复)[。.!]?|connection (?:was |has been )?interrupted[.!]?\s*(?:we(?:'re| are) )?waiting for (?:the )?(?:full|complete) (?:response|answer)[.!]?)$/i;
  function connectionInterruptedNotice(turn = null, getPageRecords = pageUiTextRecords) {
    const matches = value => connectionInterruptedPattern.test(normalize(value));
    // Current ChatGPT builds can render this product error inside the live
    // assistant turn instead of page chrome. Accept only a standalone matching
    // text node from the currently owned assistant article. This keeps user
    // quotations, code/blockquote examples and longer assistant discussion
    // from consuming the recovery budget.
    const scopedArticle = turn?.owned ? turn.article : null;
    if (scopedArticle) {
      for (const record of responseTextNodes(turn)) {
        const parent = record.parent;
        const direct = record.direct;
        if (direct && direct.length <= 240 && matches(direct) && visible(parent)) return true;
      }
    }
    // Older renderer variants expose the same status as page chrome. Exclude
    // every transcript turn and the Fabushi workbench so quoted task text and
    // our own logs cannot self-trigger.
    for (const record of getPageRecords()) {
      const parent = record.parent;
      const direct = record.direct;
      if (parent && direct && direct.length <= 240 && matches(direct) && visible(parent)) return true;
    }
    return false;
  }
  function clearAbnormalFreshCarry(task) {
    if (!task) return;
    task.abnormalFreshCarry = '';
    task.abnormalFreshCarrySourceURL = '';
    task.abnormalFreshCarryReason = '';
    task.abnormalFreshCarryPhase = '';
    task.abnormalFreshCarryRound = 0;
    task.abnormalFreshCarryAt = 0;
    task.abnormalFreshCarrySourceKind = '';
  }
  function abnormalFreshCarryForCurrentPhase(task) {
    const carry = String(task?.abnormalFreshCarry || '').trim();
    if (!carry) return '';
    if (String(task.abnormalFreshCarryPhase || '') !== String(task.phase || '')) return '';
    if (Number(task.abnormalFreshCarryRound || 0) !== Number(task.round || 0)) return '';
    return carry;
  }
  function clearHandoffReplySnapshot(task) {
    if (!task) return;
    task.handoffReplySnapshot = '';
    task.handoffReplySnapshotSourceURL = '';
    task.handoffReplySnapshotPhase = '';
    task.handoffReplySnapshotRound = 0;
    task.handoffReplySnapshotGoalRevision = 0;
    task.handoffReplySnapshotAt = 0;
  }
  function handoffReplySnapshotForCurrentPhase(task) {
    const snapshot = String(task?.handoffReplySnapshot || '').trim();
    if (!snapshot) return '';
    if (String(task.handoffReplySnapshotPhase || '') !== String(task.phase || '')) return '';
    if (Number(task.handoffReplySnapshotRound || 0) !== Number(task.round || 0)) return '';
    if (Number(task.handoffReplySnapshotGoalRevision || 0) !== Number(task.goalRevision || 0)) return '';
    // A durable snapshot is evidence from exactly one bound conversation.
    // Never let an older abnormal chat's snapshot cross into a replacement
    // conversation merely because phase/round/goalRevision are unchanged.
    const currentURL = canonicalConversationURL(task?.url);
    const sourceURL = canonicalConversationURL(task?.handoffReplySnapshotSourceURL);
    if (!currentURL || !sourceURL || sourceURL !== currentURL) return '';
    return snapshot;
  }
  function retireConsumedAbnormalHandoff(task) {
    if (!task) return false;
    const changed = Boolean(
      String(task.abnormalFreshCarry || '').trim()
      || String(task.handoffReplySnapshot || '').trim()
    );
    clearAbnormalFreshCarry(task);
    clearHandoffReplySnapshot(task);
    return changed;
  }
  function freshHandoffCarryForCurrentPhase(task) {
    const captured = abnormalFreshCarryForCurrentPhase(task);
    if (captured) return captured;
    // The durable pagehide snapshot is only a fallback for an explicitly queued
    // abnormal/fresh handoff. It must never leak into ordinary next-round or
    // conversation-length prompts.
    if (!task?.connectionInterruptedFreshDispatch) return '';
    return handoffReplySnapshotForCurrentPhase(task);
  }
  function cleanAbnormalFreshReply(value) {
    const source = String(value || '')
      .replace(/连接已中断[，,。.!；;：:\s]*正在等待完整(?:回复|答复)[。.!]?/gi, ' ')
      .replace(/connection (?:was |has been )?interrupted[.!]?\s*(?:we(?:'re| are) )?waiting for (?:the )?(?:full|complete) (?:response|answer)[.!]?/gi, ' ')
      .replace(/ChatGPT stream recovery polling timed out[.!]?/gi, ' ')
      .replace(/Stream cache expired[.!]?/gi, ' ')
      .replace(/A network (?:connection )?(?:error|failure)(?: occurred)?[.!]?\s*(?:Please )?(?:check|verify) (?:your )?(?:internet|network|connection)[\s\S]{0,160}?(?:retry|try again)[.!]?/gi, ' ')
      .replace(/(?:网络(?:连接)?(?:错误|失败)|连接(?:错误|失败))[，,。.!；;\s]*(?:请)?(?:检查(?:一下)?(?:你的|您的)?(?:互联网|网络|连接)[，,。.!；;\s]*)?(?:重试|再次尝试)?/gi, ' ')
      .replace(/消息(?:发送)?(?:超时|错误|失败)[，,。.!；;\s]*请重试/gi, ' ')
      .trim();
    return boundedConversationLengthCarry(source);
  }
  function outermostSemanticRoots(candidates) {
    const candidateSet = new Set(candidates);
    return candidates.filter(candidate => {
      for (let parent = candidate.parentElement; parent; parent = parent.parentElement) {
        if (candidateSet.has(parent)) return false;
      }
      return true;
    });
  }
  function assistantSegmentContent(node, { tailLimit = 0 } = {}) {
    if (!node || own(node) || node.closest?.('[hidden],[inert]')) return '';
    const semanticSelector = '.markdown,[data-message-content],[data-selected-text-overlay-target]';
    const semantic = [];
    // ChatGPT can render the assistant-role host as a layout-neutral wrapper
    // (for example display:contents) while its semantic message child is
    // visibly painted. Do not require the host itself to own a client rect.
    if (node.matches?.(semanticSelector)) semantic.push(node);
    semantic.push(...nodes(semanticSelector, node));
    // Prefer the outermost semantic message-content roots. ChatGPT can nest a
    // selection overlay or data-message-content inside .markdown; reading both
    // would duplicate the same visible assistant prose.
    const roots = outermostSemanticRoots(semantic).filter(visible);
    let sources = roots;
    if (!sources.length) {
      if (tailLimit && visible(node)) {
        sources = [node];
      } else if (visible(node)) {
        sources = [node];
      } else {
        // Older/current renderer variants do not always expose a semantic
        // wrapper. In that case accept only actually rendered descendants and
        // exclude interactive/page chrome so a zero-rect assistant host cannot
        // turn hidden controls into handoff context.
        const rendered = nodes('*', node).filter(candidate =>
          visible(candidate)
          && !candidate.matches?.('button,[role="button"],form,nav,aside,header,textarea,input,select,option,[contenteditable="true"]')
          && !candidate.closest?.('button,[role="button"],form,nav,aside,header,textarea,input,select,option,[contenteditable="true"]'),
        );
        sources = outermostSemanticRoots(rendered);
      }
    }
    let remaining = tailLimit;
    const parts = sources.map(item => {
      const value = tailLimit ? textTail(item, remaining) : String(item.textContent || '');
      if (tailLimit) remaining = Math.max(0, remaining - value.length);
      return value.trim();
    }).filter(Boolean);
    const deduped = [];
    for (const part of parts) {
      if (deduped.at(-1) === part || deduped.includes(part)) continue;
      deduped.push(part);
    }
    return deduped.join('\n\n').trim();
  }
