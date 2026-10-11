  function prepareRecordedConversationOpen(taskId, expectedURL) {
    const task = data.tasks.find(item => item.id === taskId);
    const target = canonicalConversationURL(expectedURL);
    // The href rendered for this exact task is authoritative. If another tab
    // changed the task between render and click, refuse the click instead of
    // resolving a different selected/current task and opening its old route.
    if (!taskBelongsToTab(task) || !target || canonicalConversationURL(task.url) !== target) return '';
    selected = task.id;
    current = task.id;
    lastSwitch = Date.now();
    // Viewing a task is not a pause command. Persist a generation-bound
    // handoff ticket so the replacement document can reclaim the same runner
    // and continue supervising this task without changing any task state.
    writeSessionStorageRecord(NAV, JSON.stringify({
      path:new URL(target).pathname,
      href:target,
      at:Date.now(),
      task:task.id,
      attempts:1,
      assigned:true,
      direct:true,
      purpose:'inspect',
      phase:String(task.phase || 'work'),
      round:Number(task.round || 0),
      goalRevision:Number(task.goalRevision || 0),
      resume:true,
    }));
    task.updatedAt = Date.now();
    log(task, '正在查看已记录会话；任务保持运行，页面交接后会自动继续监督。');
    if (running) schedule(100);
    return target;
  }
  function recoverableWorkspaces(snapshot = null) {
    // paint() already owns the current merged data snapshot. Accept it here
    // so one workbench render does not JSON.parse the entire durable queue
    // once per task row while building every "move to" menu.
    const stored = snapshot && typeof snapshot === 'object' ? snapshot : read(KEY, {tasks:[]});
    return [...new Set((stored.tasks || [])
      .filter(task => task.ownerTabId && task.ownerTabId !== tabId)
      .map(task => task.ownerTabId))]
      .map(ownerTabId => ({
        ownerTabId,
        tasks:(stored.tasks || []).filter(task => task.ownerTabId === ownerTabId),
        live:(Date.now() - Number(readWorkspaceHeartbeat(ownerTabId)?.at || 0)) < WORKSPACE_HEARTBEAT_STALE_MS,
      }));
  }
  async function assignTaskToWorkspace(taskId, ownerTabId) {
    const task = data.tasks.find(item => item.id === taskId);
    if (!task || !ownerTabId || task.ownerTabId === ownerTabId) return false;
    if (ownerTabId !== tabId && Date.now() - Number(readWorkspaceHeartbeat(ownerTabId)?.at || 0) >= WORKSPACE_HEARTBEAT_STALE_MS) throw new Error('目标标签页不在线；请先恢复该工作区，或选择一个正在运行的标签页。');
    return navigator.locks.request('fabushi-task-transfer-v1:' + taskId, async () => {
      const stored = read(KEY, {tasks:[]});
      const live = stored.tasks?.find(item => item.id === taskId);
      if (!live || live.ownerTabId !== task.ownerTabId) throw new Error('任务归属刚刚发生变化，请刷新后重试。');
      if (!stored.tasks.some(item => item.ownerTabId === ownerTabId)) throw new Error('目标标签页工作区已不存在，请重新选择。');
      if (stored.tasks.filter(item => item.ownerTabId === ownerTabId).length >= 50) throw new Error('目标标签页最多保存 50 个任务，请先归档已完成任务。');
      live.ownerTabId = ownerTabId;
      live.updatedAt = Date.now();
      live.messages ||= [];
      live.messages.push({at:Date.now(),role:'status',text:'任务已分配到另一标签页；当前会话链接、阶段、轮次和附件保持不变。'});
      stored.selectedByTab ||= {};
      stored.selectedByTab[ownerTabId] = taskId;
      if (!persistWorkbenchState(stored)) {
        throw new Error('本地存储空间不足，任务归属未改变；请先释放 chatgpt.com 站点存储空间后重试。');
      }
      task.ownerTabId = ownerTabId;
      task.updatedAt = live.updatedAt;
      task.messages ||= [];
      task.messages.push(live.messages.at(-1));
      mergeStoredTasks(stored);
      selected = taskBelongsToTab(task) ? taskId : (tabTasks()[0]?.id || '');
      save();
      return true;
    });
  }
  function openTaskInNewWorkspace(taskId) {
    const task = data.tasks.find(item => item.id === taskId);
    if (!task) throw new Error('找不到要移动的任务。');
    const token = crypto.randomUUID();
    const targetOwnerTabId = crypto.randomUUID();
    const ticket = {version:1,token,taskId,sourceOwnerTabId:task.ownerTabId,targetOwnerTabId,at:Date.now()};
    if (!writeLocalStorageRecord(TASK_TRANSFER_KEY + token, JSON.stringify(ticket), { critical:true })) throw new Error('本地存储空间不足，无法安全创建跨标签页任务交接票据；当前任务仍保留在本标签页并继续运行。');
    const opened = window.open(location.origin + '/#fabushi-assign-task=' + encodeURIComponent(token), '_blank');
    if (!opened) {
      removeLocalStorageRecord(TASK_TRANSFER_KEY + token);
      throw new Error('浏览器未打开新标签页，请允许本次弹出窗口后重试。');
    }
    opened.opener = null;
    return true;
  }
  async function restoreWorkspace(ownerTabId, takeOverCurrentTab = false, { automatic = false } = {}) {
    if (!ownerTabId || ownerTabId === tabId) throw new Error('这是当前标签页的工作区。');
    if (!navigator.locks?.query) throw new Error('浏览器无法确认原标签页是否已关闭，暂不能恢复。');
    return navigator.locks.request('fabushi-workspace-restore:' + ownerTabId, async () => {
      const locks = await navigator.locks.query();
      if (locks.held.some(lock => lock.name === WORKSPACE_LOCK + ownerTabId)) {
        throw new Error('这个工作区仍在原标签页中，请在原标签页继续。');
      }
      const stored = read(KEY, {tasks:[]});
      const tasks = stored.tasks.filter(task => task.ownerTabId === ownerTabId);
      if (!tasks.length) throw new Error('没有可恢复的工作区。');
      const restorable = task => task.state !== 'done' && task.state !== 'cancelled';
      const task = tasks.find(task => task.id === stored.selectedByTab?.[ownerTabId] && restorable(task))
        || tasks.find(restorable) || tasks[0];
      if (takeOverCurrentTab && !tabTasks().length) {
        const previousTabId = tabId;
        workspaceRelease?.();
        workspaceRelease = null;
        if (!await claimWorkspace(ownerTabId)) {
          await claimWorkspace(previousTabId);
          throw new Error('这个工作区刚刚被另一个标签页恢复，请在那个标签页继续。');
        }
        tabId = ownerTabId;
        activeWorkspaceStorageId = tabId;
        writeSessionStorageRecord(TAB_SESSION_KEY, tabId);
        removeSessionStorageRecord(NAV);
        mergeStoredTasks(stored);
        const restoredTask = data.tasks.find(item => item.id === task.id && taskBelongsToTab(item)) || task;
        selected = restoredTask.id;
        data.autoResume = true;
        current = restoredTask.state === 'paused' ? '' : restoredTask.id;
        if (restoredTask.state === 'blocked') prepareTaskForRecovery(restoredTask, { automatic:true });
        armWorkspaceRecoveryIdentity(restoredTask, { allowStaticFinal: !automatic });
        lastSwitch = Date.now();
        save();
        paint();
        if (data.autoResume !== false && current) autoStart(current);
        return { restored:true, target:'current', ownerTabId, taskId:restoredTask.id };
      }
      const pendingKey = RECOVERY_KEY + 'pending:' + ownerTabId;
      const pending = read(pendingKey, null);
      if (pending && Date.now() - pending.at < 30000) throw new Error('专用标签页正在打开，请稍候。');
      const token = crypto.randomUUID();
      const record = {ownerTabId,at:Date.now()};
      const recoveryPersisted = writeLocalStorageRecord(RECOVERY_KEY + token, JSON.stringify(record), { critical:true });
      const pendingPersisted = recoveryPersisted && writeLocalStorageRecord(pendingKey, JSON.stringify(record), { critical:true });
      if (!recoveryPersisted || !pendingPersisted) {
        if (recoveryPersisted) removeLocalStorageRecord(RECOVERY_KEY + token);
        if (pendingPersisted) removeLocalStorageRecord(pendingKey);
        throw new Error('本地存储空间不足，无法安全创建恢复票据；当前工作区保持原状，不会打开无法恢复的新标签页。');
      }
      const url = (canonicalConversationURL(task.url) || location.origin + '/') + '#fabushi-resume=' + token;
      const opened = window.open(url, '_blank');
      if (!opened) {
        removeLocalStorageRecord(RECOVERY_KEY + token);
        removeLocalStorageRecord(pendingKey);
        throw new Error('浏览器未打开恢复标签页，请允许本次弹出窗口后重试。');
      }
      opened.opener = null;
      return { restored:true, target:'new', ownerTabId, taskId:task.id };
    });
  }
  async function recoverStaleWorkspaceAutomatically() {
    if (!AUTOMATIC_WORKSPACE_RECOVERY_ENABLED) return false;
    if (automaticRecoveryBusy || data.autoResume === false || tabTasks().length) return false;
    const ownerTabId = findAutomaticRecoveryOwner();
    if (!ownerTabId || ownerTabId === tabId) return false;
    automaticRecoveryBusy = true;
    try {
      const result = await restoreWorkspace(ownerTabId, true, { automatic:true });
      if (result?.restored && result.taskId) {
        const task = data.tasks.find(item => item.id === result.taskId);
        if (task) log(task, '检测到原标签页心跳超时；已自动接管工作区，沿用原会话、发送标识和附件继续执行。');
      }
      return Boolean(result?.restored);
    } catch {
      // A healthy owner may have refreshed between the stale heartbeat scan
      // and the lock check. Keep the recovery control quiet and let the next
      // bounded scan re-evaluate the durable evidence.
      return false;
    } finally {
      automaticRecoveryBusy = false;
    }
  }
  function scheduleAutomaticWorkspaceRecovery(delayMs = WORKSPACE_RECOVERY_SCAN_MS) {
    clearTimeout(automaticRecoveryTimer);
    if (!AUTOMATIC_WORKSPACE_RECOVERY_ENABLED) { automaticRecoveryTimer = null; return; }
    automaticRecoveryTimer = setTimeout(() => {
      automaticRecoveryTimer = null;
      void recoverStaleWorkspaceAutomatically().finally(() => scheduleAutomaticWorkspaceRecovery());
    }, Math.max(1000, Number(delayMs) || WORKSPACE_RECOVERY_SCAN_MS));
  }
  function element(tag, content, className) {
    const node = document.createElement(tag); if (content) node.textContent = content; if (className) node.className = className; return node;
  }
  function taskRecoveryStatusText(task, now = Date.now()) {
    const signature = String(task?.stopNoApprovalConfirmSignature || '');
    if (signature.includes('"connection-interrupted"') && Number(task?.stopNoApprovalConfirmSince || 0)) {
      const remainingMs = Math.max(0, Number(task.stopNoApprovalConfirmSince || 0) + STOP_NO_APPROVAL_CONFIRM_MS - now);
      return remainingMs
        ? `异常中断接力：授权安全复核约 ${Math.ceil(remainingMs / 1000)} 秒后完成，随后新开会话`
        : '异常中断接力：授权安全复核完成，正在准备新开会话';
    }
    if (task?.pendingContinuationReason) return '异常中断接力：旧等待状态已升级，正在准备新开会话';
    return '';
  }
  function mount() {
    const root = element('div'); root.id = ROOT; root.dataset.version = VERSION;
    const style = element('style'); style.id = 'fabushi-auto-confirm-style';
    style.textContent = `
      #${ROOT}{position:fixed;right:18px;bottom:18px;z-index:2147483646;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#ececec;color-scheme:dark}
      #${ROOT} *{box-sizing:border-box} #${ROOT} button,#${ROOT} select,#${ROOT} a.action{font:inherit;cursor:pointer;color:inherit;background:#303030;border:1px solid #484848;border-radius:10px;padding:8px 12px} #${ROOT} a.action{display:inline-block;text-decoration:none} #${ROOT} button:hover,#${ROOT} a.action:hover{background:#414141} #${ROOT} button:disabled{opacity:.45;cursor:default}
      #${ROOT} .launch{float:right;border-radius:24px;background:#6048dc;border:0}
      #${ROOT} .desk{display:none;width:min(880px,calc(100vw - 36px));height:min(700px,calc(100vh - 110px));margin-bottom:10px;border:1px solid #4a4a4a;border-radius:20px;background:#212121;box-shadow:0 16px 60px #0008;overflow:hidden}
      #${ROOT} .desk.open{display:flex} #${ROOT} aside{width:250px;flex-shrink:0;background:#171717;padding:16px 10px;overflow:auto} #${ROOT} aside h3{margin:0 8px 16px} #${ROOT} aside button{width:100%;text-align:left;background:transparent;border-color:transparent;overflow:hidden;text-overflow:ellipsis} #${ROOT} aside button.selected{background:#303030} #${ROOT} small{display:block;color:#aaa;font-size:12px}
      #${ROOT} .task-group{margin:12px 0 16px;padding-top:10px;border-top:1px solid #2f2f2f} #${ROOT} .task-group-title{display:flex;align-items:center;gap:6px;padding:0 8px 6px;color:#aaa;font-size:11px;font-weight:600;letter-spacing:.02em} #${ROOT} .task-group-title span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} #${ROOT} .task-count{margin-left:auto;color:#777} #${ROOT} .restore-workspace{margin:0 4px 6px;width:calc(100% - 8px);border-color:#5d5034;background:#302b1f;color:#e9d9a7;text-align:center} #${ROOT} .task-row{display:block;width:100%;padding:8px 10px;margin:0 0 4px;border-radius:10px;color:#ececec} #${ROOT} .task-row.readonly{background:#1d1d1d} #${ROOT} .task-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} #${ROOT} .task-meta{display:flex;align-items:center;gap:6px;margin-top:3px;color:#888;font-size:11px} #${ROOT} .state-badge{display:inline-flex;align-items:center;gap:4px;color:#bbb} #${ROOT} .state-badge:before{content:'';width:7px;height:7px;border-radius:50%;background:#777} #${ROOT} .state-badge[data-state='sending']:before,#${ROOT} .state-badge[data-state='uploading']:before,#${ROOT} .state-badge[data-state='generating']:before,#${ROOT} .state-badge[data-state='reviewing']:before{background:#4ba3ff} #${ROOT} .state-badge[data-state='queued']:before,#${ROOT} .state-badge[data-state='waiting']:before,#${ROOT} .state-badge[data-state='approval']:before{background:#e3aa3b} #${ROOT} .state-badge[data-state='done']:before{background:#45b96b} #${ROOT} .state-badge[data-state='blocked']:before{background:#e35d5d} #${ROOT} .state-badge[data-state='paused']:before,#${ROOT} .state-badge[data-state='cancelled']:before{background:#777} #${ROOT} .run-indicator{color:#65adff;font-weight:700}
      #${ROOT} .chat{display:flex;flex-direction:column;flex:1;min-width:0} #${ROOT} header{padding:14px 16px;border-bottom:1px solid #383838;display:flex;gap:8px;align-items:center} #${ROOT} header strong{flex:1} #${ROOT} .settings{display:none;padding:12px 16px;border-bottom:1px solid #383838;background:#262626} #${ROOT} .settings.open{display:block} #${ROOT} .settings label{display:flex;gap:9px;align-items:flex-start} #${ROOT} .settings small{margin-left:25px} #${ROOT} .feed{flex:1;overflow:auto;padding:20px;overscroll-behavior:contain} #${ROOT} .goal{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 18px;padding:10px 12px;background:#2b2b2b;border:1px solid #484848;border-radius:12px;color:#f0f0f0} #${ROOT} .attachment-summary{white-space:pre-wrap;overflow-wrap:anywhere;margin:-8px 0 18px;padding:8px 12px;background:#252525;border:1px solid #444;border-radius:10px;color:#bbb;font-size:12px} #${ROOT} .bubble{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 16px;max-width:100%} #${ROOT} .bubble.user{background:#343434;border-radius:18px;padding:12px 16px;margin-left:30px} #${ROOT} .bubble.status{color:#aaa;font-size:12px;border-left:2px solid #7965d8;padding-left:10px} #${ROOT} .bubble time{display:block;color:#999;font-size:10px} #${ROOT} .session-link{color:#aaa;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0 0 8px}
      #${ROOT} .compose{margin:0 16px 16px;padding:12px;background:#303030;border:1px solid #484848;border-radius:20px} #${ROOT} textarea{width:100%;min-height:72px;max-height:160px;resize:vertical;border:0;outline:0;background:transparent;color:#eee;font:inherit} #${ROOT} .attachment-box{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 10px;padding-top:8px;border-top:1px solid #424242} #${ROOT} .attachment-picker{display:inline-flex;align-items:center;gap:6px;border:1px dashed #666;border-radius:9px;padding:6px 9px;color:#d5d5d5;font-size:12px;cursor:pointer} #${ROOT} .attachment-picker:hover{background:#414141} #${ROOT} .attachment-picker input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none} #${ROOT} .attachment-list{display:flex;gap:5px;flex-wrap:wrap;flex:1;min-width:120px} #${ROOT} .attachment-chip{display:inline-flex;align-items:center;max-width:100%;padding:4px 7px;border-radius:7px;background:#3b3b3b;color:#ddd;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} #${ROOT} .attachment-note{width:100%;color:#999;font-size:11px} #${ROOT} .tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap} #${ROOT} .tools label{font-size:12px;color:#bbb} #${ROOT} .send{margin-left:auto;background:#eee;color:#111;border-radius:50%;font-size:19px;padding:3px 12px} #${ROOT} .notice{padding:0 16px 8px;color:#aaa;font-size:12px} @media(max-width:600px){#${ROOT} aside{width:130px} #${ROOT} .feed{padding:12px}}
    `;
    style.textContent += `
      #${ROOT} .attachment-preview{display:flex;align-items:center;gap:7px;max-width:100%;padding:4px 6px;border:1px solid #4c4c4c;border-radius:9px;background:#292929}
      #${ROOT} .attachment-preview img{display:block;width:100px;height:72px;object-fit:contain;border-radius:6px;background:#111}
      #${ROOT} .attachment-preview video{display:block;width:140px;height:80px;object-fit:contain;border-radius:6px;background:#111}
      #${ROOT} .attachment-preview .attachment-chip{min-width:0}
      #${ROOT} .task-row{display:flex;align-items:stretch;gap:5px;padding:5px;margin:0 0 4px;background:#202020}
      #${ROOT} .task-row.selected{background:#2a2a2a}
      #${ROOT} aside .task-select{flex:1;min-width:0;width:auto;padding:3px 5px;border-color:transparent;background:transparent;text-align:left}
      #${ROOT} aside .task-select:hover{background:#303030}
      #${ROOT} .task-row.readonly .task-select{cursor:default}
      #${ROOT} .task-row-actions{display:flex;align-items:center;gap:3px;flex-shrink:0}
      #${ROOT} .task-move{max-width:92px;padding:4px 3px;font-size:10px;background:#292929;color:#ddd}
      #${ROOT} .task-group.drop-ready{outline:1px dashed #8974e8;outline-offset:2px;background:#24213a}
      #${ROOT} .task-drop-new{display:block;width:calc(100% - 8px);margin:6px 4px;padding:9px;border:1px dashed #7663ce;background:#28243e;color:#ddd;text-align:center}
      #${ROOT} .drop-hint{padding:4px 8px;color:#888;font-size:10px;line-height:1.4}
      #${ROOT} aside .task-row-actions button.task-action{width:auto;padding:4px 6px;font-size:11px;white-space:nowrap}
      #${ROOT} aside .task-row-actions button.task-action.danger{color:#ffaaaa}
      #${ROOT} aside .task-row-actions button.task-action:disabled{color:#999}
      #${ROOT} .pause-all{margin-top:10px} #${ROOT} .memory-cleanup{margin-top:8px} #${ROOT} .memory-status{margin-top:6px;line-height:1.4}
    `;
    const desk = element('section', '', 'desk'); desk.setAttribute('aria-label','Fabushi 任务工作台');
    const sidebar = element('aside'), list = element('div'); sidebar.append(element('h3','Fabushi'), list);
    const chat = element('div','','chat'), head = element('header'), heading = element('strong','任务工作台');
    const editGoalButton = element('button','编辑目标');
    const settingsButton = element('button','设置'), pauseButton = element('button','暂停当前任务'), close = element('button','×'); close.setAttribute('aria-label','收起任务工作台');
    head.append(heading,editGoalButton,settingsButton,pauseButton,close);
    const settings = element('div','','settings');
    const globalApproval = element('input'); globalApproval.type='checkbox'; globalApproval.checked=data.globalAutoApprove;
    const globalApprovalLabel = element('label');
    globalApprovalLabel.append(globalApproval,document.createTextNode('在当前标签页的会话中自动处理授权卡'));
    const globalPauseButton = element('button','暂停全部任务','pause-all'); globalPauseButton.type='button';
    const memoryCleanupButton = element('button','清理当前标签页内存','memory-cleanup'); memoryCleanupButton.type='button';
    const memoryStatusNode = element('small',[memoryStatusText(), storageStatusText(), `宿主唤醒 ${backgroundClock.status().lastWakeAt ? new Date(backgroundClock.status().lastWakeAt).toLocaleTimeString() : '等待'}，时钟响应 ${backgroundClock.status().hostReplies}`].filter(Boolean).join(' · '),'memory-status');
    chat.append(head);
    settings.append(globalApprovalLabel,globalPauseButton,memoryCleanupButton,memoryStatusNode,element('small','此数值只估算网页 JavaScript 堆，不等于 Chrome 标签页完整内存。宿主只能卸载非活动且无未保存内容/进行中任务的标签页；重新打开时会重新加载。活动标签页无法通过 tabs.discard 清理到初始占用。'),element('small','仅展开“允许”旁的菜单并选择“允许本次会话”；不会选择永久授权。'));
    const feed = element('div','','feed'); feed.setAttribute('role','log'); feed.setAttribute('aria-live','polite');
    const notice = element('div','单标签页 · 已暂停','notice');
    const compose = element('form','','compose'), input = element('textarea'); input.placeholder = '输入任务目标，可直接粘贴图片或视频…'; input.setAttribute('aria-label','任务目标');
    const attachmentBox = element('div','','attachment-box');
    const attachmentPicker = element('label','','attachment-picker');
    const fileInput = element('input'); fileInput.type='file'; fileInput.multiple=true; fileInput.setAttribute('aria-label','添加任务附件');
    attachmentPicker.append(fileInput,element('span','＋ 添加图片 / 视频 / 文件'));
    const clearFiles = element('button','清空附件'); clearFiles.type='button'; clearFiles.disabled=true;
    const attachmentList = element('div','','attachment-list');
    const attachmentNoteText = '附件只保存在当前浏览器；开始任务时上传到 ChatGPT，确认完成前不会发送目标文字。';
    const attachmentNote = element('small',attachmentNoteText,'attachment-note');
    attachmentBox.append(attachmentPicker,clearFiles,attachmentList,attachmentNote);
    let selectedFiles = [], previewURLs = [];
    const formatAttachmentSize = value => {
      const size = Number(value || 0);
      if (!size) return '0 B';
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
      return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
    };
    const revokePreviewURLs = () => {
      previewURLs.forEach(url => { try { window.URL.revokeObjectURL(url); } catch {} });
      previewURLs = [];
    };
    readTransientUIState = () => ({
      hasDraft:Boolean(String(input.value || '').trim()),
      hasFiles:selectedFiles.length > 0,
    });
    releaseTransientUIResources = ({ force = false } = {}) => {
      if (!force && (selectedFiles.length || String(input.value || '').trim())) return false;
      revokePreviewURLs();
      selectedFiles = [];
      try { fileInput.value = ''; } catch {}
      attachmentList.replaceChildren();
      clearFiles.disabled = true;
      if (!force) attachmentNote.textContent = attachmentNoteText;
      return true;
    };
    const renderSelectedFiles = () => {
      revokePreviewURLs();
      attachmentList.replaceChildren();
      selectedFiles.forEach(file => {
        const preview = element('div','','attachment-preview');
        const kind = attachmentKind(file);
        const objectURL = kind && window.URL && typeof window.URL.createObjectURL === 'function'
          ? window.URL.createObjectURL(file)
          : '';
        if (objectURL) {
          previewURLs.push(objectURL);
          if (kind === 'image') {
            const image = element('img');
            image.src = objectURL;
            image.alt = file.name;
            image.title = file.name;
            image.loading = 'lazy';
            preview.append(image);
          } else {
            const video = element('video');
            video.src = objectURL;
            video.controls = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.setAttribute('aria-label', file.name);
            preview.append(video);
          }
        }
        preview.append(element('span',`${file.name} · ${formatAttachmentSize(file.size)}`,'attachment-chip'));
        attachmentList.append(preview);
      });
      clearFiles.disabled = selectedFiles.length === 0;
    };
    fileInput.onchange = () => {
      selectedFiles = uniqueAttachmentFiles(Array.from(fileInput.files || []));
      renderSelectedFiles();
    };
    const setSelectedFiles = (files, { append = false } = {}) => {
      selectedFiles = uniqueAttachmentFiles(append ? [...selectedFiles, ...Array.from(files || [])] : files);
      if (selectedFiles.length) assignFilesToInput(fileInput, selectedFiles);
      else fileInput.value = '';
      renderSelectedFiles();
      return selectedFiles;
    };
    const clearSelectedFiles = () => {
      selectedFiles = [];
      fileInput.value = '';
      attachmentNote.textContent = attachmentNoteText;
      renderSelectedFiles();
    };
    clearFiles.onclick = clearSelectedFiles;
    listen(compose, 'paste', event => {
      const files = clipboardFilesFromEvent(event);
      if (!files.length) return;
      const pastedText = String(event.clipboardData?.getData?.('text/plain') || '').trim();
      if (!pastedText) event.preventDefault();
      setSelectedFiles(files, { append:true });
      attachmentNote.textContent = `已粘贴 ${files.length} 个附件；提交任务时会一并上传到 ChatGPT。`;
      notice.textContent = `已接收粘贴附件：${files.map(file => file.name).join('、')}。提交任务后会随任务一起派发。`;
    });
    const controls = element('div','','tools'), select = element('select'); select.setAttribute('aria-label','任务模式');
    for (const [value,name] of [['once','单次任务'],['goal','持续目标']]) { const option=element('option',name); option.value=value; select.append(option); }
    const modelSelect = element('select'); modelSelect.setAttribute('aria-label','ChatGPT 模型');
    for (const preset of MODEL_PRESETS) {
      const option = element('option',preset.label);
      option.value = preset.key;
      modelSelect.append(option);
    }
    modelSelect.value = normalizeModelPreset(data.defaultModelPreset);
    modelSelect.onchange = () => {
      const preset = normalizeModelPreset(modelSelect.value);
      const task = data.tasks.find(item => item.id === selected && taskBelongsToTab(item) && item.state !== 'done');
      if (task) {
        if (taskModelPreset(task) !== preset) {
          task.modelPreset = preset;
          task.modelPresetConfirmedAt = 0;
          task.modelPresetConfirmedKey = '';
          // The active ChatGPT turn retains its current model. A queued or
          // future Work/Review dispatch must verify the new task preference.
          log(task, `已将此任务的模型调整为 ${modelPresetLabel(preset)}；当前已发送的会话不变，下次发送前会重新确认模型。`);
        } else save();
      } else {
        // The new-task view remains an independent default; browsing another
        // existing task cannot silently overwrite this persisted choice.
        data.defaultModelPreset = preset;
        save();
      }
    };
    const reasoningSelect = element('select'); reasoningSelect.setAttribute('aria-label','ChatGPT 思考强度');
    for (const preset of REASONING_PRESETS) {
      const option = element('option', preset.index === 4 ? 'Pro（第 5 档）' : preset.label);
      option.value = String(preset.index);
      reasoningSelect.append(option);
    }
    reasoningSelect.value = String(normalizeReasoningPreset(data.defaultReasoningPreset));
    reasoningSelect.onchange = () => {
      data.defaultReasoningPreset = normalizeReasoningPreset(reasoningSelect.value);
      save();
    };
    const auto = element('input'); auto.type='checkbox'; auto.checked=data.autoApprove !== false;
    const autoLabel=element('label'); autoLabel.append(auto,document.createTextNode('本次会话自动授权'));
    const submit = element('button','↑','send'); submit.type='submit'; submit.setAttribute('aria-label','发送任务');
    const modelScopeHint = element('small','','model-scope-hint');
    controls.append(select,modelSelect,reasoningSelect,autoLabel,submit); compose.append(input,attachmentBox,controls,modelScopeHint); chat.append(settings,feed,notice,compose); desk.append(sidebar,chat);
    const launch=element('button','⚡ Fabushi 脚本','launch'); root.append(desk,launch); document.documentElement.append(style); (document.body || document.documentElement).append(root);
    let signature='', sidebarSignature='';
    paint = () => {
      const paintStartedAt = performance.now();
      const task=data.tasks.find(item=>item.id===selected && taskBelongsToTab(item));
      const editableModelTask = task?.state !== 'done' ? task : null;
      const shownModelPreset = editableModelTask ? taskModelPreset(editableModelTask) : normalizeModelPreset(data.defaultModelPreset);
      if (modelSelect.value !== shownModelPreset) modelSelect.value = shownModelPreset;
      modelSelect.dataset.taskId = editableModelTask?.id || '';
      modelSelect.title = editableModelTask
        ? '当前选中任务模型：修改后从下一次尚未发送的会话起生效，已发送轮次不变'
        : '新任务默认模型：不会更改任何已创建的任务';
      const modelHint = editableModelTask
        ? '当前任务模型 · 修改后下一次发送生效；已发送的当前会话不变'
        : task ? '已完成任务不可修改模型 · 此处设置新任务默认模型' : '新任务默认模型 · 不影响已经创建的任务';
      if (modelScopeHint.textContent !== modelHint) modelScopeHint.textContent = modelHint;
      heading.textContent=task ? (task.mode==='goal'?'持续目标':'单次任务')+' · '+statusNames[task.state] : '任务工作台';
      editGoalButton.disabled=!task || task.state==='done';
      memoryStatusNode.textContent=[memoryStatusText(), storageStatusText(), `宿主唤醒 ${backgroundClock.status().lastWakeAt ? new Date(backgroundClock.status().lastWakeAt).toLocaleTimeString() : '等待'}，时钟响应 ${backgroundClock.status().hostReplies}`].filter(Boolean).join(' · ');
      memoryCleanupButton.disabled=memoryMonitorBusy || hostMemoryPending.size > 0;
      const runnableCount=tabTasks().filter(item=>!terminal.has(item.state)&&item.state!=='paused').length;
      const recoveryStatus = taskRecoveryStatusText(task);
      notice.textContent=[`当前标签页工作区 · ${running?`监督中，${runnableCount>1?`多个本页任务每 ${Math.round(SUPERVISION_INTERVAL_MS / 1000)} 秒轮换`:'按当前任务推进'}；任务可单独暂停/继续`:'已暂停，自动操作已停止'}`, recoveryStatus, `扫描 ${measurements.scans} 次，平均 ${(measurements.totalScanMs / Math.max(1, measurements.scans)).toFixed(1)} ms · 界面最近 ${measurements.lastPaintMs.toFixed(1)} ms、侧栏重建 ${measurements.sidebarRebuilds} 次`, memoryStatusText(), storageStatusText(), `宿主唤醒 ${backgroundClock.status().lastWakeAt ? new Date(backgroundClock.status().lastWakeAt).toLocaleTimeString() : '等待'}，时钟响应 ${backgroundClock.status().hostReplies}`].filter(Boolean).join(' · ');
      pauseButton.textContent=task?.state==='paused'?'继续当前任务':(task?.state==='cancelled'||task?.state==='blocked')?'恢复任务':task&&!terminal.has(task.state)?(running?'暂停当前任务':'继续当前任务'):running?'暂停全部':'继续全部';
      globalPauseButton.textContent=running?'暂停全部任务':'继续全部任务';
      globalPauseButton.disabled=tabTasks().length===0;
      const currentTasks=tabTasks();
      const workspaceSnapshots=recoverableWorkspaces(data);
      const rowSignature=item=>[
        item.id,item.ownerTabId,item.state,Number(item.round||0),Number(item.goalRevision||0),
        String(item.goal||'').slice(0,80),taskAttachments(item).length,
        Math.max(0,Math.ceil((Number(item.noFinalReplyRecoveryUntil||0)-Date.now())/60000)),
      ];
      const nextSidebarSignature=JSON.stringify([
        selected,current,running,
        currentTasks.map(rowSignature),
        workspaceSnapshots.map(workspace=>[workspace.ownerTabId,workspace.live,workspace.tasks.map(rowSignature)]),
      ]);
      const sidebarRebuilt=sidebarSignature!==nextSidebarSignature;
      const recordPaint=renderedMessageCount=>{
        const elapsed=performance.now()-paintStartedAt;
        measurements.paints++;measurements.totalPaintMs+=elapsed;measurements.lastPaintMs=elapsed;
        if(elapsed>=500)console.warn('[Fabushi] 慢界面刷新诊断（不含任务内容）',{elapsedMs:Math.round(elapsed),sidebarRebuilt,currentTasks:currentTasks.length,recoverableWorkspaces:workspaceSnapshots.length,recoverableTasks:workspaceSnapshots.reduce((sum,workspace)=>sum+workspace.tasks.length,0),renderedMessages:Number(renderedMessageCount||0)});
      };
      if(sidebarRebuilt){
      sidebarSignature=nextSidebarSignature;
      measurements.sidebarRebuilds++;
      list.replaceChildren();
      const fresh=element('button','＋ 新任务'); fresh.onclick=()=>{selected='';clearSelectedFiles();save();input.focus();}; list.append(fresh);
      list.append(element('small','拖到下方工作区即可分配；浏览器原生标签栏不接收网页拖放。','drop-hint'));
      const newTabDrop=element('button','＋ 拖到这里，在新标签页处理','task-drop-new');
      newTabDrop.type='button';newTabDrop.dataset.newTabDrop='true';
      newTabDrop.onclick=()=>{if(selected)try{openTaskInNewWorkspace(selected);}catch(error){showError(error);}else notice.textContent='请先选择任务，或把任务拖到这里。';};
      newTabDrop.addEventListener('dragover',event=>{event.preventDefault();newTabDrop.classList.add('drop-ready');});
      newTabDrop.addEventListener('dragleave',()=>newTabDrop.classList.remove('drop-ready'));
      newTabDrop.addEventListener('drop',event=>{event.preventDefault();newTabDrop.classList.remove('drop-ready');const taskId=event.dataTransfer?.getData('application/x-fabushi-task')||event.dataTransfer?.getData('text/plain');if(taskId)try{openTaskInNewWorkspace(taskId);}catch(error){showError(error);}});
      list.append(newTabDrop);
      const wireWorkspaceDrop=(group,owner,enabled=true)=>{
        group.dataset.dropOwnerTabId=owner;
        if(!enabled){group.title='工作区不在线；请使用恢复按钮在新标签页恢复。';return;}
        group.addEventListener('dragover',event=>{event.preventDefault();group.classList.add('drop-ready');});
        group.addEventListener('dragleave',event=>{if(!group.contains(event.relatedTarget))group.classList.remove('drop-ready');});
        group.addEventListener('drop',event=>{event.preventDefault();group.classList.remove('drop-ready');const taskId=event.dataTransfer?.getData('application/x-fabushi-task')||event.dataTransfer?.getData('text/plain');if(taskId)assignTaskToWorkspace(taskId,owner).catch(showError);});
      };
      const appendTaskRow=(group,item,interactive=true)=>{
        const row=element('div','',`task-row${item.id===selected&&interactive?' selected':''}${interactive?'':' readonly'}`);
        row.dataset.taskId=item.id; row.dataset.taskState=item.state;
        row.draggable=true;row.title='拖动到其他工作区以分配此任务';
        row.addEventListener('dragstart',event=>{event.dataTransfer?.setData('application/x-fabushi-task',item.id);event.dataTransfer?.setData('text/plain',item.id);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';});
        const selectControl=element(interactive?'button':'div','','task-select');
        if(interactive){selectControl.type='button';selectControl.setAttribute('aria-label',`查看任务详情：${item.goal.slice(0,80)}`);selectControl.onclick=()=>{selected=item.id;save();};}
        selectControl.append(element('span',item.goal.slice(0,34),'task-name'));
        const meta=element('span','','task-meta');
        if(item.id===current&&running)meta.append(element('span','●','run-indicator'));
        const badge=element('span',statusNames[item.state]||item.state,'state-badge');badge.dataset.state=item.state;
        meta.append(badge,document.createTextNode(`第 ${item.round} 轮`));
        if (taskAttachments(item).length) meta.append(document.createTextNode(` · 📎 ${taskAttachments(item).length}`));
        const recoveryRemaining = Number(item.noFinalReplyRecoveryUntil || 0) - Date.now();
        if (recoveryRemaining > 0) meta.append(document.createTextNode(' · 异常恢复约 '+Math.ceil(recoveryRemaining / 60000)+' 分钟'));
        const interruptionStatus = taskRecoveryStatusText(item);
        if (interruptionStatus) meta.append(document.createTextNode(' · '+interruptionStatus.replace('连接中断恢复：','')));
        selectControl.append(meta); row.append(selectControl);
        {
          const actions=element('div','','task-row-actions');
          const move=element('select','','task-move');move.setAttribute('aria-label',`分配任务：${item.goal.slice(0,60)}`);const placeholder=element('option','分配到…');placeholder.value='';move.append(placeholder);
          for(const workspace of [{ownerTabId:tabId,label:'当前标签页',live:true},...workspaceSnapshots.map((workspace,index)=>({ownerTabId:workspace.ownerTabId,label:`标签页 ${index+1}`,live:workspace.live}))])if(workspace.live&&workspace.ownerTabId!==item.ownerTabId){const option=element('option',workspace.label);option.value=workspace.ownerTabId;move.append(option);}
          const newChoice=element('option','新标签页');newChoice.value='__new__';move.append(newChoice);
          move.onchange=event=>{event.stopPropagation();const target=move.value;move.value='';if(target==='__new__')try{openTaskInNewWorkspace(item.id);}catch(error){showError(error);}else if(target)assignTaskToWorkspace(item.id,target).catch(showError);};actions.append(move);
          if(interactive){
          const details=element('button','详情','task-action'); details.type='button'; details.title='查看任务详情'; details.onclick=event=>{event.stopPropagation();selected=item.id;save();}; actions.append(details);
          if(item.state==='paused'){
            const resume=element('button','继续','task-action'); resume.type='button'; resume.title='只继续此任务'; resume.onclick=event=>{event.stopPropagation();resumeTask(item).catch(showError);}; actions.append(resume);
          } else if(item.state==='blocked'||item.state==='cancelled'){
            const resume=element('button','恢复','task-action'); resume.type='button'; resume.title='只恢复此任务'; resume.onclick=event=>{event.stopPropagation();resumeTask(item).catch(showError);}; actions.append(resume);
          } else if(!terminal.has(item.state)){
            const pauseControl=element('button','暂停','task-action'); pauseControl.type='button'; pauseControl.title='只暂停此任务，其他任务继续'; pauseControl.onclick=event=>{event.stopPropagation();pauseTask(item);}; actions.append(pauseControl);
          }
          const removable=terminal.has(item.state)||item.state==='paused';
          const remove=element('button','删除','task-action danger'); remove.type='button'; remove.disabled=!removable; remove.title=removable?'删除此任务及其本地附件':'请先暂停或取消此任务，再删除';
          if(removable)remove.onclick=event=>{event.stopPropagation();deleteTask(item);};
          actions.append(remove);
          }
          row.append(actions);
        }
        group.append(row);
      };
      {
        const group=element('section','','task-group');group.setAttribute('role','group');group.setAttribute('aria-label','当前标签页任务');
        wireWorkspaceDrop(group,tabId);
        const title=element('div','','task-group-title');title.append(element('span','当前标签页'),element('span',`${currentTasks.length}`,'task-count'));group.append(title);
        if(currentTasks.length)for(const item of currentTasks)appendTaskRow(group,item,true);
        else group.append(element('small','把任务拖到这里，交由当前标签页处理。','drop-hint'));
        list.append(group);
      }
      workspaceSnapshots.forEach((workspace,index)=>{
        const group=element('section','','task-group');group.dataset.ownerTabId=workspace.ownerTabId;group.setAttribute('role','group');group.setAttribute('aria-label',`可恢复标签页 ${index+1}`);
        wireWorkspaceDrop(group,workspace.ownerTabId,workspace.live);
        const label=workspace.live?`其他标签页 ${index+1}`:`可恢复标签页 ${index+1}`;
        group.setAttribute('aria-label',label);
        const title=element('div','','task-group-title');title.title=workspace.ownerTabId;title.append(element('span',label),element('span',`${workspace.tasks.length}`,'task-count'));group.append(title);
        if(!workspace.live){
          const useCurrent=currentTasks.length===0;
          const restore=element('button',useCurrent?'恢复到当前标签页':'在新标签页恢复','restore-workspace');
          restore.onclick=()=>restoreWorkspace(workspace.ownerTabId,useCurrent).then(result=>{notice.textContent=result.target==='current'?'旧任务记录已恢复到当前标签页。':'已打开专用标签页，旧任务记录将在那里恢复。';}).catch(showError);
          group.append(restore);
        }
        for(const item of workspace.tasks)appendTaskRow(group,item,false);list.append(group);
      });
      }
      const nextSignature=JSON.stringify([selected,task?.modelPreset,task?.reasoningPreset,task?.goalRevision,task?.messageVersion,task?.url,task?.state,task?.preview,taskAttachmentSummary(task),task?.attachmentUploadPending,task?.attachmentUploadFailed,task?.attachmentUploadRetryAt,task?.attachmentUploadRetryCount]);
      if(signature===nextSignature){
        recordPaint(0);
        return;
      }
      signature=nextSignature;
      const nearBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<80;
      feed.replaceChildren();
      if(!task)feed.append(element('p','在下方输入任务。单次任务等待一次最终回复；持续目标在每轮结束后新开规划/验收会话，由规划结果安排下一轮。会话恢复按已记录的唯一链接进行，不需要手动点击继续。'));
      if(task)feed.append(element('div',`当前目标：${task.goal}`,'goal'));
      if(task)feed.append(element('div',`ChatGPT：${modelPresetLabel(task.modelPreset)} · ${reasoningPresetLabel(task.reasoningPreset)}`,'reasoning-preset'));
      if(task?.attachments?.length)feed.append(element('div',`任务附件：${taskAttachmentSummary(task)}`,'attachment-summary'));
      const allMessages=(task?.messages||[]).filter(message => Date.now() - Number(message?.at || 0) <= TASK_MESSAGE_RETENTION_MS);
      const renderedMessages=[];
      let renderedChars=0;
      for(let index=allMessages.length-1;index>=0 && renderedMessages.length<MAX_RENDERED_TASK_MESSAGES;index-=1){
        const message=allMessages[index];
        const length=String(message?.text||'').length;
        if(renderedMessages.length && renderedChars+length>MAX_RENDERED_TASK_MESSAGE_CHARS)break;
        renderedMessages.unshift(message);renderedChars+=length;
      }
      if(task)feed.append(element('small',`最近 2 小时记录：已保留 ${allMessages.length} 条；页面刷新/会话切换后继续恢复。`,'render-limit'));
      if(allMessages.length>renderedMessages.length)feed.append(element('small',`为保持页面流畅，本次显示最近 ${renderedMessages.length}/${allMessages.length} 条；其余仍保存在最近 2 小时记录中。`,'render-limit'));
      for(const message of renderedMessages){const bubble=element('div',message.text,`bubble ${message.role}`);const time=element('time',new Date(message.at).toLocaleTimeString());bubble.append(time);feed.append(bubble);}
      if(task?.preview && !terminal.has(task.state))feed.append(element('div',`实时回复\n${task.preview}`,'bubble assistant'));
      const sessionURL = canonicalConversationURL(task?.url);
      if(sessionURL){
        const phaseName = task.phase === 'review' ? '验收' : '工作';
        const link=element('div',`会话链接（第 ${task.round} 轮 · ${phaseName}）：${sessionURL}`,'session-link');
        link.title=sessionURL;
        feed.append(link);
        // This must be a native anchor with the exact URL visible above. A
        // scripted location.assign could be swallowed while ChatGPT replaced
        // its SPA document, leaving the previous conversation on screen.
        const view=element('a','打开已记录会话链接','action');
        view.href=sessionURL;
        view.target='_self';
        view.title=sessionURL;
        view.dataset.taskId=task.id;
        view.dataset.conversationUrl=sessionURL;
        view.onclick=event=>{
          const target=prepareRecordedConversationOpen(view.dataset.taskId,view.dataset.conversationUrl);
          if(!target){event.preventDefault();showError(new Error('任务会话链接已变化，请重新选择任务后再打开。'));return;}
          // Keep the native link destination synchronized with the exact value
          // that passed the task/URL identity check. Do not call location.assign.
          view.href=target;
        };
        feed.append(view);
      }
      if(task?.attachmentUploadFailed){
        const retry=element('button',task.attachmentUploadRetryAt?'立即重试附件上传':'重试附件上传');
        retry.onclick=()=>retryAttachmentUpload(task).catch(showError);
        feed.append(retry);
      }
      if(task?.state==='blocked'){
        const recoverButton=element('button',task.url?'检查已有回复（不重发）':'恢复发送中的任务（不重发）');
        recoverButton.onclick=()=>resumeTask(task).catch(showError);
        feed.append(recoverButton);
      }
      if(task?.state==='paused'){const resume=element('button','继续此任务');resume.onclick=()=>resumeTask(task).catch(showError);feed.append(resume);}
      if(task && !terminal.has(task.state) && task.state !== 'paused'){const cancel=element('button','取消此任务');cancel.onclick=()=>cancelTask(task);feed.append(cancel);}
      if(task){const removable=terminal.has(task.state)||task.state==='paused';const remove=element('button','删除此任务');remove.disabled=!removable;remove.title=removable?'删除此任务及其本地附件':'请先暂停或取消此任务，再删除';if(removable)remove.onclick=()=>deleteTask(task);feed.append(remove);}
      if(nearBottom)feed.scrollTop=feed.scrollHeight;
      recordPaint(renderedMessages.length);
    };
    function showError(error){notice.textContent=error.message;}
    launch.onclick=()=>{desk.classList.toggle('open');paint();};close.onclick=()=>desk.classList.remove('open');
    editGoalButton.onclick=()=>{const task=data.tasks.find(item=>item.id===selected&&taskBelongsToTab(item));if(!task)return;const value=window.prompt('编辑任务目标',task.goal||'');if(value!==null)editGoal(task,value);};
    settingsButton.onclick=()=>settings.classList.toggle('open');
    pauseButton.onclick=()=>{const task=data.tasks.find(item=>item.id===selected&&taskBelongsToTab(item));if(task?.state==='paused'||task?.state==='cancelled'||task?.state==='blocked')resumeTask(task).catch(showError);else if(task&&!terminal.has(task.state)){if(running)pauseTask(task);else{current=task.id;lastSwitch=Date.now();start(false).catch(showError);}}else if(running)pause(true);else start(true).catch(showError);};
    globalPauseButton.onclick=()=>{if(running)pause(true);else start(true).catch(showError);};
    memoryCleanupButton.onclick=()=>requestHostMemoryCleanup({reason:'manual',userInitiated:true}).catch(showError);
    globalApproval.onchange=()=>setGlobalAutoApprove(globalApproval.checked);
    auto.onchange=()=>{data.autoApprove=auto.checked;save();}; select.onchange=()=>{mode=select.value;};
    let submitting=false;
    compose.onsubmit=async event=>{
      event.preventDefault();
      if (submitting) return;
      submitting=true; submit.disabled=true;
      let task;
      try {
        const files=selectedFiles.slice();
        const attachments=files.map(normalizeAttachmentMeta).filter(Boolean);
        if (attachments.length !== files.length) throw new Error('有附件缺少文件名，无法安全保存。');
        if (files.length) await openAttachmentDB();
        data.defaultModelPreset = normalizeModelPreset(modelSelect.value);
        data.defaultReasoningPreset = normalizeReasoningPreset(reasoningSelect.value);
        task=enqueue(input.value,select.value,attachments,data.defaultReasoningPreset,data.defaultModelPreset);
        if (files.length) {
          try { await storeTaskAttachmentFiles(task,files,attachments); }
          catch (error) {
            task.attachmentUploadFailed=true;
            state(task,'blocked',`附件本地保存失败，未发送任务。${error.message}`);
            throw error;
          }
        }
        input.value=''; clearSelectedFiles();
        await start(false);
      } catch(error) { showError(error); }
      finally { submitting=false; submit.disabled=false; }
    };
    paint();
  }
  window[INSTANCE]={active:true,version:VERSION,async shutdown(){stopMemoryMonitor();cancelHostMemoryRequests();cancelHostNavigationRequests();stopWorkspaceHeartbeat('shutdown');suspendRunnerForPagehide();globalApprovalController?.abort();clearTimeout(globalApprovalTimer);globalApprovalTimer=null;clearTimeout(popupDismissTimer);popupDismissTimer=null;clearTimeout(automaticRecoveryTimer);automaticRecoveryTimer=null;releaseTransientUIResources({force:true});readTransientUIState=()=>({hasDraft:false,hasFiles:false});releaseTransientUIResources=()=>false;lifecycleController?.abort();this.active=false;document.querySelectorAll(`#${ROOT}`).forEach(node=>node.remove());document.querySelectorAll('#fabushi-auto-confirm-style').forEach(node=>node.remove());if(document.getElementById(BOOTSTRAP_MARKER)===bootstrap)bootstrap.remove();backgroundClock.dispose();await releaseWorkspace();}};
  window.FabushiUserscript=Object.freeze({pluginId:'chatgpt-auto-confirm',getServer:()=> 'browser-local',call:async(tool,args={})=>{
    if(['status','diagnose','queue_status','chat_status'].includes(tool))return{version:VERSION,running,tasks:tabTasks(),measurements,tabWorkspace:true,tabId,memory:{...memorySnapshot,pressure:memoryPressure,lastAction:memoryLastAction}};
    if(tool==='memory_status')return{...memorySnapshot,pressure:memoryPressure,lastAction:memoryLastAction,hostCapability:HOST_MEMORY_CAPABILITY};
    if(tool==='cleanup_memory')return requestHostMemoryCleanup({reason:'manual-tool',userInitiated:true});
    if(['pause_queue','stop'].includes(tool)){pause();return{running:false};}
    if(['start_queue','resume_queue'].includes(tool))return start();
    if(tool==='enqueue_tasks'){for(const task of args.tasks||[])enqueue(task.prompt||task.goal||'',task.mode||'once',task.attachments||[],task.reasoningPreset,task.modelPreset);return tabTasks();}
    if(tool==='get_reply'){
      const task = data.tasks.find(item => item.id === current && taskBelongsToTab(item))
        || data.tasks.find(item => item.id === selected && taskBelongsToTab(item));
      return task ? latestTurn(task).text : '';
    }
    throw new Error('请通过新版任务输入框使用此功能。');
  }});
  schedulingReady = true;
  mount();
  void inspectMemoryPressure();
  scheduleMemoryMonitor(2000);
  writeWorkspaceHeartbeat();
  scheduleWorkspaceHeartbeat(50);
  scheduleGlobalApprovalScan(50);
  schedulePopupDismissScan(50);
  const transientRouteRecoveryTaskId = quarantineTransientConversationBindings();
  recoveredTaskId = transientRouteRecoveryTaskId || recoverLegacyNavigationFailures();
  migratePersistedPause();
  const exhaustedLegacyTaskId = recoverLegacyExhaustedNoFinalReplies();
  if (exhaustedLegacyTaskId) recoveredTaskId = exhaustedLegacyTaskId;
  const attachmentTimeoutTaskId = recoverLegacyAttachmentUploadTimeouts();
  if (attachmentTimeoutTaskId) recoveredTaskId = attachmentTimeoutTaskId;
  const blockedRecoveryTaskId = recoverPersistedBlockedTasks();
  if (blockedRecoveryTaskId) recoveredTaskId = blockedRecoveryTaskId;
  if ((recoveredWorkspace || automaticRecoveryOwner) && data.autoResume !== false) {
    const recoveredWorkspaceTask = tabTasks().find(item => item.id === selected && resumableStates.has(item.state))
      || tabTasks().find(item => resumableStates.has(item.state));
    if (recoveredWorkspaceTask) armWorkspaceRecoveryIdentity(recoveredWorkspaceTask);
  }
  let ticket;try{ticket=JSON.parse(readSessionStorageString(NAV));}catch{}
  const ticketFresh = ticket && ticket.resume && Date.now()-ticket.at < NAV_TICKET_TTL_MS;
  const ticketUsable = ticketFresh && validNavigationTicket(ticket);
  if(ticketUsable && data.autoResume !== false){
    // An exact, phase/round-bound navigation ticket is stronger than a
    // generic legacy-recovery hint. This keeps a completed Work document on
    // the fresh queued review dispatch after a multi-task switch.
    current=ticket.task; lastSwitch=Date.now(); autoStart(ticket.task);
  } else if(recoveredTaskId && data.autoResume !== false){
    current=recoveredTaskId; lastSwitch=Date.now(); autoStart(recoveredTaskId);
  } else {
    removeSessionStorageRecord(NAV);
    if (data.autoResume !== false) {
      const resumable = tabTasks().find(item => taskMatchesCurrentConversation(item) && resumableStates.has(item.state))
        || tabTasks().find(item => item.id === selected && !terminal.has(item.state) && resumableStates.has(item.state))
        || tabTasks().find(item => !terminal.has(item.state) && resumableStates.has(item.state));
      if (resumable) {
        armWorkspaceRecoveryIdentity(resumable);
        current = resumable.id;
        lastSwitch = Date.now();
        autoStart(resumable.id);
      }
    }
  }
  // Queue intent is persisted separately from a document lifetime. Manual
  // pause disables autoResume; an ordinary reload continues resumable tasks.
  listen(window, 'storage', event => {
    if (event.key !== KEY) return;
    syncRemoteControl();
  });
  listen(window, 'pagehide',()=>{stopMemoryMonitor();writeWorkspaceHeartbeat('pagehide');if(!navigating)suspendRunnerForPagehide();releaseWorkspace();});
  listen(window, 'pageshow',event=>{
    if(event.persisted){
      // A BFCache restore is already a live document. Avoid turning every
      // tab switch into another full reload; let the bounded scheduler recheck
      // the current route instead.
      navigating=false;
      sameRouteWaitUntil=Date.now()+1000;
      sameRouteWaitSince=Date.now();
      schedule(1000);
    } else scheduleMemoryMonitor(1000);
  });
}

runBootstrap();
