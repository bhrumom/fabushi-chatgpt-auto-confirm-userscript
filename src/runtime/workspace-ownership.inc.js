  function normalizeAttachmentMeta(value) {
    if (!value || typeof value !== 'object') return null;
    const name = String(value.name || '').trim().slice(0, 240);
    if (!name) return null;
    const size = Number(value.size);
    const lastModified = Number(value.lastModified);
    return {
      id: String(value.id || '').trim() || `attachment-${crypto.randomUUID()}`,
      name,
      type: String(value.type || '').trim().slice(0, 160),
      size: Number.isFinite(size) && size >= 0 ? size : 0,
      lastModified: Number.isFinite(lastModified) && lastModified >= 0 ? lastModified : 0,
    };
  }
  const WORKSPACE_LOCK = 'fabushi-workspace-v1:';
  const RECOVERY_KEY = 'fabushi-workspace-recovery-v1:';
  function readWorkspaceHeartbeat(ownerTabId) {
    if (!ownerTabId) return null;
    const heartbeat = read(WORKSPACE_HEARTBEAT_KEY + ownerTabId, null);
    if (!heartbeat || typeof heartbeat !== 'object') return null;
    const at = Number(heartbeat.at || heartbeat.lastSeenAt || 0);
    return Number.isFinite(at) && at > 0 ? { ...heartbeat, at } : null;
  }
  function findAutomaticRecoveryOwner(now = Date.now()) {
    const stored = read(KEY, { tasks:[] });
    if (!Array.isArray(stored?.tasks)) return '';
    const owners = [...new Set(stored.tasks.map(task => task?.ownerTabId).filter(Boolean))];
    const candidates = owners.map(ownerTabId => {
      const heartbeat = readWorkspaceHeartbeat(ownerTabId);
      const control = stored.tabControls?.[ownerTabId];
      const tasks = stored.tasks.filter(task => task?.ownerTabId === ownerTabId && taskCanBeRecoveredByHost(task));
      return { ownerTabId, heartbeat, control, tasks };
    }).filter(candidate => candidate.tasks.length
      && candidate.heartbeat
      && candidate.heartbeat.autoResume !== false
      && candidate.control?.autoResume !== false
      && now - candidate.heartbeat.at >= WORKSPACE_HEARTBEAT_STALE_MS
      && String(candidate.heartbeat.recoveryURL || '').startsWith('https://'));
    // A fresh ChatGPT tab must never guess between two stale workspaces. A
    // single candidate is safe to adopt; ambiguity remains visible for manual
    // recovery instead of risking cross-tab task ownership.
    return candidates.length === 1 ? candidates[0].ownerTabId : '';
  }
  function findExactRouteRecoveryOwner(sessionOwner) {
    const liveURL = currentConversationURL();
    if (!liveURL) return '';
    const stored = read(KEY, { tasks:[] });
    if (!Array.isArray(stored.tasks)) return '';
    if (sessionOwner && stored.tasks.some(task => task.ownerTabId === sessionOwner)) return '';
    const boundTasks = stored.tasks.filter(task => canonicalConversationURL(task.url) === liveURL
      && !['done', 'cancelled'].includes(task.state));
    if (boundTasks.length !== 1) return '';
    const candidates = boundTasks.filter(task => {
      if (!task.ownerTabId || !taskCanBeRecoveredByHost(task)) return false;
      const heartbeat = readWorkspaceHeartbeat(task.ownerTabId);
      const control = stored.tabControls?.[task.ownerTabId];
      if (!heartbeat) return control?.autoResume === true;
      return heartbeat.autoResume !== false && control?.autoResume !== false
        && Date.now() - heartbeat.at >= WORKSPACE_HEARTBEAT_STALE_MS;
    });
    return candidates.length === 1 ? candidates[0].ownerTabId : '';
  }
  let workspaceRelease = null;
  let workspaceReleased = Promise.resolve();
  const recoveryToken = new URLSearchParams(location.hash.slice(1)).get('fabushi-resume');
  const taskTransferToken = new URLSearchParams(location.hash.slice(1)).get('fabushi-assign-task');
  const sessionTabId = readSessionStorageString(TAB_SESSION_KEY);
  let handoffTicket = null;
  try { handoffTicket = JSON.parse(readSessionStorageString(NAV)); } catch {}
  const handoffTicketFresh = Boolean(handoffTicket?.resume
    && Number.isFinite(Number(handoffTicket.at))
    && Date.now() - Number(handoffTicket.at) < NAV_TICKET_TTL_MS);
  let recoveredWorkspace = '';
  let pendingTaskTransfer = null;
  const startupRouteHasTicket = Boolean(taskTransferToken || recoveryToken);
  if (taskTransferToken) {
    const candidate = read(TASK_TRANSFER_KEY + taskTransferToken, null);
    if (candidate && candidate.version === 1 && Date.now() - Number(candidate.at || 0) < 60000
      && candidate.targetOwnerTabId && candidate.taskId) {
      pendingTaskTransfer = candidate;
      recoveredWorkspace = candidate.targetOwnerTabId;
    } else {
      removeLocalStorageRecord(TASK_TRANSFER_KEY + taskTransferToken);
    }
  }
  if (recoveryToken) {
    const recovery = read(RECOVERY_KEY + recoveryToken, null);
    if (recovery && Date.now() - recovery.at < NAV_TICKET_TTL_MS) {
      recoveredWorkspace = recovery.ownerTabId;
    }
  }
  const automaticRecoveryOwner = recoveredWorkspace ? '' : findExactRouteRecoveryOwner(sessionTabId);
  if (automaticRecoveryOwner) recoveredWorkspace = automaticRecoveryOwner;
  let tabId = recoveredWorkspace || sessionTabId || crypto.randomUUID();
  activeWorkspaceStorageId = tabId;
  // A lifetime lock distinguishes duplicate tabs even when the browser copies
  // sessionStorage. It remains held while paused, so recovery cannot steal a
  // personal or paused tab. Browser closure releases it without heartbeat races.
  async function claimWorkspace(owner) {
    if (!navigator.locks) return true; // The runner still refuses unsafe sends.
    let resolveClaim, rejectClaim;
    const claim = new Promise((resolve, reject) => { resolveClaim = resolve; rejectClaim = reject; });
    workspaceReleased = navigator.locks.request(WORKSPACE_LOCK + owner, { ifAvailable:true }, async lock => {
        if (!lock) { resolveClaim(false); return; }
        const held = new Promise(done => { workspaceRelease = done; });
        resolveClaim(true);
        await held;
      }).catch(error => { rejectClaim(error); });
    return claim;
  }
  async function releaseWorkspace() {
    const released = workspaceReleased;
    workspaceRelease?.();
    workspaceRelease = null;
    await released.catch(() => {});
  }
  bootstrapCleanup = async () => { backgroundClock.dispose(); await releaseWorkspace(); };
  async function reclaimReplacedWorkspace(owner) {
    // Web Locks release runs on its own task queue after the old callback's
    // promise settles. Only a proven same-window replacement may wait for that
    // handoff; a genuinely duplicated tab must still fail immediately and get
    // an independent workspace identity.
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await claimWorkspace(owner)) return true;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return false;
  }
  async function reclaimWorkspaceAfterDocumentHandoff(owner, timeoutMs) {
    const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);
    while (Date.now() <= deadline) {
      if (await claimWorkspace(owner)) return true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(WORKSPACE_RECLAIM_POLL_MS, remaining)));
    }
    return false;
  }
  let workspaceClaimed = await claimWorkspace(tabId);
  if (!workspaceClaimed && replacingActiveInstance) workspaceClaimed = await reclaimReplacedWorkspace(tabId);
  // On a full navigation the old `window[INSTANCE]` is gone, so the new
  // document cannot use the hot-replacement signal above. A fresh navigation
  // ticket (or the same document's persisted session id on a normal reload)
  // proves that this is a handoff candidate, not an arbitrary new tab. Wait
  // briefly for the old lock to release before splitting the task workspace.
  if (!workspaceClaimed && !recoveredWorkspace && sessionTabId === tabId) {
    const timeout = handoffTicketFresh ? WORKSPACE_RECLAIM_TIMEOUT_MS : WORKSPACE_RECLAIM_FAST_TIMEOUT_MS;
    workspaceClaimed = await reclaimWorkspaceAfterDocumentHandoff(tabId, timeout);
  }
  if (!workspaceClaimed && recoveredWorkspace) {
    // A recovery-ticket document is an explicit same-workspace handoff. Wait
    // for the crashed/replaced document's Web Lock to unwind before falling
    // back to an independent tab identity.
    workspaceClaimed = await reclaimWorkspaceAfterDocumentHandoff(tabId, WORKSPACE_RECLAIM_TIMEOUT_MS);
  }
  if (!workspaceClaimed && recoveredWorkspace) {
    const error = new Error('Original recovery workspace is still locked');
    error.code = 'FABUSHI_RECOVERY_LOCK_PENDING';
    throw error;
  }
  if (!workspaceClaimed) {
    tabId = crypto.randomUUID();
    await claimWorkspace(tabId);
    removeSessionStorageRecord(NAV);
  }
  // Keep recovery/transfer evidence intact until a lock request succeeds.
  // If lock acquisition rejects, the outer bootstrap retry must see the same
  // task-bound ticket and conversation route rather than silently starting a
  // fresh, unrelated workspace.
  if (startupRouteHasTicket) {
    if (taskTransferToken) removeLocalStorageRecord(TASK_TRANSFER_KEY + taskTransferToken);
    if (recoveryToken) {
      removeLocalStorageRecord(RECOVERY_KEY + recoveryToken);
      if (recoveredWorkspace) {
        removeLocalStorageRecord(RECOVERY_KEY + 'pending:' + recoveredWorkspace);
        const autoKey = WORKSPACE_AUTO_RECOVERY_KEY + recoveredWorkspace;
        const autoTicket = read(autoKey, null);
        if (autoTicket?.token === recoveryToken) removeLocalStorageRecord(autoKey);
      }
    }
    history.replaceState(history.state, '', location.pathname + location.search);
    window.opener = null;
  }
  writeSessionStorageRecord(TAB_SESSION_KEY, tabId);
  activeWorkspaceStorageId = tabId;
  const overflowState = readWorkbenchOverflow(tabId);
  if (overflowState) volatileStorageShadow.set(KEY, JSON.stringify(overflowState));
  const data = overflowState || read(KEY, { tasks: [], selected: '', autoApprove: true });
  if (!Array.isArray(data.tasks)) data.tasks = [];
  if (!Array.isArray(data.deletedTaskIds)) data.deletedTaskIds = [];
  for (const task of data.tasks) {
    if (!Array.isArray(task.messages)) task.messages = [];
    if (!Number.isFinite(Number(task.messageVersion))) task.messageVersion = task.messages.length;
    if (!Number.isFinite(Number(task.goalRevision))) task.goalRevision = 0;
    task.attachments = Array.isArray(task.attachments)
      ? task.attachments.map(normalizeAttachmentMeta).filter(Boolean)
      : [];
    compactTaskMessages(task);
  }
  // localStorage intentionally excludes diagnostic history. Restore the
  // separate rolling two-hour activity log before mounting the workbench so
  // reloads/recovery never present an empty task timeline.
  await restoreRecentActivityMessages();
  if (pendingTaskTransfer && tabId === pendingTaskTransfer.targetOwnerTabId) {
    const transferred = data.tasks.find(task => task.id === pendingTaskTransfer.taskId);
    if (transferred && transferred.ownerTabId === pendingTaskTransfer.sourceOwnerTabId) {
      transferred.ownerTabId = tabId;
      transferred.updatedAt = Date.now();
      transferred.messages ||= [];
      transferred.messages.push({at:Date.now(),role:'status',text:'已在新标签页接收此任务；原会话链接、发送标识、阶段、轮次和附件保持不变。'});
      compactTaskMessages(transferred);
      data.selectedByTab ||= {};
      data.selectedByTab[tabId] = transferred.id;
      persistWorkbenchState(data);
    }
    removeLocalStorageRecord(TASK_TRANSFER_KEY + taskTransferToken);
  }
  if (typeof data.globalAutoApprove !== 'boolean') data.globalAutoApprove = false;
  let legacyOwner = readStorageString(LEGACY_OWNER_KEY);
  if (!legacyOwner || legacyOwner === 'legacy-workspace-v2') {
    // The first document that opens an old v2 queue becomes its owner. Once
    // the task records carry an owner id, the workspace lock below prevents a
    // duplicated tab from taking those tasks over.
    writeLocalStorageRecord(LEGACY_OWNER_KEY, tabId);
    legacyOwner = readStorageString(LEGACY_OWNER_KEY);
  }
  let ownershipMigrated = false;
  if (legacyOwner === tabId) {
    for (const task of data.tasks) {
      if (task.ownerTabId && task.ownerTabId !== 'legacy-workspace-v2') continue;
      task.ownerTabId = tabId;
      ownershipMigrated = true;
    }
  }
  data.tabControls ||= {};
  data.selectedByTab ||= {};
  const legacyControl = {
    autoResume: typeof data.autoResume === 'boolean' ? data.autoResume : true,
    lastDispatchAt: Number.isFinite(Number(data.lastDispatchAt)) ? Number(data.lastDispatchAt) : 0,
    controlRevision: Number.isFinite(Number(data.controlRevision)) ? Number(data.controlRevision) : 0,
    pausedAt: Number.isFinite(Number(data.pausedAt)) ? Number(data.pausedAt) : 0,
  };
  if (!data.tabControls[tabId]) data.tabControls[tabId] = legacyOwner === tabId ? legacyControl : { autoResume:true, lastDispatchAt:0, controlRevision:0, pausedAt:0 };
  data.tabControls[tabId].globalAutoApprove ??= legacyOwner === tabId && data.globalAutoApprove;
  data.tabControls[tabId].autoApprove ??= data.autoApprove !== false;
  for (const field of ['autoResume','lastDispatchAt','controlRevision','pausedAt','globalAutoApprove','autoApprove']) {
    delete data[field];
    Object.defineProperty(data, field, {
      configurable:true,
      get:() => data.tabControls[tabId]?.[field],
      set:value => { data.tabControls[tabId] ||= {}; data.tabControls[tabId][field] = value; },
    });
  }
  if (ownershipMigrated) persistWorkbenchState(data);
  // v2.10.18 keeps localStorage latest-only. Legacy queues/runtimes were already
  // migrated into the canonical workbench by earlier releases, so retaining
  // paused copies only wastes origin quota and can eventually make storage full.
  for (const key of ['fabushi-auto-confirm-queue-v3', 'fabushi-auto-confirm-queue-v2', 'fabushi-auto-confirm-runtime-v2']) {
    removeLocalStorageRecord(key);
  }
  removeSessionStorageRecord('fabushi-auto-confirm-worker-enabled-v1');

  let running = false, controller = null, timer = null, navigationTimer = null, lockRelease = null, busy = false, autoStartTimer = null, autoStartTaskId = '';
  let globalApprovalTimer = null, globalApprovalBusy = false;
  let popupDismissTimer = null;
  let globalApprovalController = data.globalAutoApprove ? new AbortController() : null;
  let selected = data.selectedByTab[tabId] || (legacyOwner === tabId ? data.selected : ''), current = '', lastSwitch = 0, navigating = false, sameRouteWaitUntil = 0, sameRouteWaitSince = 0;
  let recoveredTaskId = '';
  let paint = () => {}, mode = 'once';
  const measurements = {
    scans:0, totalScanMs:0, sends:0, switches:0,
    paints:0, totalPaintMs:0, lastPaintMs:0, sidebarRebuilds:0,
  };
  let lastSlowScanDiagnosticAt = 0;
  let lastFingerprintStats = { messageNodes:0, inspectedTextChars:0 };
  let scanDiagnostics = {
    pageUiCalls:0, pageUiMs:0, pageUiVisited:0, pageUiTextNodes:0,
    responseCalls:0, responseMs:0, responseTextNodes:0,
    cardsCalls:0, cardsMs:0, cardsButtons:0, cardsCandidates:0,
    rateLimitCalls:0, rateLimitMs:0, rateLimitAncestorChecks:0,
  };
  function resetScanDiagnostics() {
    scanDiagnostics = {
      pageUiCalls:0, pageUiMs:0, pageUiVisited:0, pageUiTextNodes:0,
      responseCalls:0, responseMs:0, responseTextNodes:0,
      cardsCalls:0, cardsMs:0, cardsButtons:0, cardsCandidates:0,
      rateLimitCalls:0, rateLimitMs:0, rateLimitAncestorChecks:0,
    };
  }
  const observations = new Map();
  // Attachment previews and native FileLists belong to one rendered ChatGPT
  // composer only. Keep that acknowledgement in memory and bind it to the
  // dispatch token plus the current route/input node; persisted task metadata
  // must never be treated as proof that a replacement document already has
  // the files attached.
  const attachmentDispatchContexts = new Map();
  const approvalAttempts = new WeakMap();
  const terminal = new Set(['done', 'blocked', 'cancelled']);
  const resumableStates = new Set(['queued', 'sending', 'uploading', 'waiting', 'loading', 'generating', 'approval', 'reviewing']);
  const pausableStates = new Set([...resumableStates, 'blocked']);
  const statusNames = { queued:'等待派发', sending:'正在发送', uploading:'正在上传附件', waiting:'等待响应', loading:'正在加载', generating:'正在生成', approval:'等待授权', reviewing:'正在验收', done:'已完成', blocked:'需要处理', paused:'已暂停', cancelled:'已取消' };
  const REASONING_PRESETS = Object.freeze([
    Object.freeze({ index:0, key:'instant', label:'即时', effort:'none' }),
    Object.freeze({ index:1, key:'medium', label:'中', effort:'medium' }),
    Object.freeze({ index:2, key:'high', label:'高', effort:'high' }),
    Object.freeze({ index:3, key:'extra-high', label:'极高', effort:'max' }),
    Object.freeze({ index:4, key:'pro', label:'Pro', effort:'medium' }),
  ]);
  const DEFAULT_REASONING_PRESET = 3;
  function modelPresetDefinition(value) {
    const key = normalizeModelPreset(value);
    return MODEL_PRESETS.find(item => item.key === key) || MODEL_PRESETS[0];
  }
  function modelPresetLabel(value) {
    return modelPresetDefinition(value).label;
  }
