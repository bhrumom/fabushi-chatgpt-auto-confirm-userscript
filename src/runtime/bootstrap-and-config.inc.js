// ==UserScript==
// @name         ChatGPT 自动确认 · Fabushi
// @namespace    https://fabushi.ombhrum.com/userscripts/chatgpt-auto-confirm
// @version      2.10.44
// @description  独立单标签任务工作台：目标编排、单次任务、附件粘贴预览、授权识别、实时消息、内存感知与可中断调度。
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @updateURL    https://raw.githubusercontent.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/main/chatgpt-auto-confirm.user.js
// @downloadURL  https://raw.githubusercontent.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/main/chatgpt-auto-confirm.user.js
// @grant        none
// @noframes
// @run-at       document-start
// ==/UserScript==

const BOOTSTRAP_MARKER = 'fabushi-auto-confirm-bootstrap-v1';
const BOOTSTRAP_STALE_MS = 15_000;
let bootstrapRetryCount = 0;
let bootstrapAttemptToken = '';
let bootstrapCleanup = async () => {};

function showBootstrapFailure(waitingForRecovery = false) {
  let root = document.getElementById('fabushi-auto-confirm-startup-error');
  if (root) return;
  root = document.createElement('div');
  root.id = 'fabushi-auto-confirm-startup-error';
  root.setAttribute('role', 'alert');
  root.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;padding:12px 14px;border:1px solid #705d32;border-radius:12px;background:#24211a;color:#f2e5c6;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 8px 30px #0008';
  const label = document.createElement('span');
  label.textContent = waitingForRecovery
    ? 'Fabushi 正在等待原任务工作区释放，随后自动恢复。任务记录已保留。 '
    : 'Fabushi 自动确认脚本启动失败。任务未启动；可以重试。 ';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '重试';
  retry.style.cssText = 'margin-left:8px;padding:5px 10px;border:0;border-radius:8px;background:#5747b8;color:#fff;cursor:pointer';
  retry.addEventListener('click', () => {
    root.remove();
    bootstrapRetryCount = 0;
    runBootstrap();
  }, { once:true });
  root.append(label, retry);
  (document.body || document.documentElement).append(root);
}

function runBootstrap() {
  return bootstrapAttempt().catch(async error => {
    if (window.__FABUSHI_AUTO_CONFIRM_INSTANCE__?.active) return;
    await bootstrapCleanup().catch(() => {});
    const marker = document.getElementById(BOOTSTRAP_MARKER);
    if (marker && marker.dataset.token === bootstrapAttemptToken) marker.remove();
    if (error?.code === 'FABUSHI_RECOVERY_LOCK_PENDING') {
      showBootstrapFailure(true);
      return new Promise(resolve => window.setTimeout(() => {
        document.getElementById('fabushi-auto-confirm-startup-error')?.remove();
        resolve(runBootstrap());
      }, 1000));
    }
    if (bootstrapRetryCount < 2) {
      const delay = 300 * (2 ** bootstrapRetryCount++);
      return new Promise(resolve => window.setTimeout(() => resolve(runBootstrap()), delay));
    }
    showBootstrapFailure();
  });
}

async function bootstrapAttempt() {
  'use strict';
  if (window.top !== window.self) return;
  const INSTANCE = '__FABUSHI_AUTO_CONFIRM_INSTANCE__';
  const VERSION = '2.10.44';
  const DOCUMENT_INSTANCE_ID = crypto.randomUUID();
  const previousInstance = window[INSTANCE];
  if (previousInstance?.version === VERSION && previousInstance?.active) return;
  const replacingActiveInstance = Boolean(previousInstance?.active);
  // Two independent userscript injections can start in the same document
  // before either one reaches `window[INSTANCE]` (the first await is during
  // workspace-lock setup). Claim a synchronous DOM marker before awaiting so
  // only one instance can mount a workbench and race for the tab workspace.
  const existingBootstrap = document.getElementById(BOOTSTRAP_MARKER);
  if (existingBootstrap && !replacingActiveInstance) {
    const startedAt = Number(existingBootstrap.dataset.startedAt || 0);
    const stale = !window[INSTANCE]?.active && (!startedAt || Date.now() - startedAt > BOOTSTRAP_STALE_MS);
    if (!stale) return;
    existingBootstrap.remove();
  }
  if (existingBootstrap) existingBootstrap.remove();
  let schedulingReady = false;
  const backgroundClock = createBackgroundClock(window, { onWake:() => {
    if (!schedulingReady || data.autoResume === false || navigating) return;
    if (running) { if (!busy) void tick(); }
    else {
      const resumable = tabTasks().find(task => resumableStates.has(task.state));
      if (resumable) autoStart(resumable.id);
    }
  } });
  const { setTimeout, clearTimeout } = backgroundClock;
  bootstrapCleanup = async () => backgroundClock.dispose();
  const bootstrap = document.createElement('meta');
  bootstrap.id = BOOTSTRAP_MARKER;
  bootstrap.dataset.version = VERSION;
  bootstrap.dataset.token = crypto.randomUUID();
  bootstrap.dataset.startedAt = String(Date.now());
  bootstrapAttemptToken = bootstrap.dataset.token;
  (document.head || document.documentElement).append(bootstrap);
  await previousInstance?.shutdown?.();
  document.querySelectorAll('#fabushi-auto-confirm-root').forEach(node => node.remove());
  document.querySelectorAll('#fabushi-auto-confirm-style').forEach(node => node.remove());
  const KEY = 'fabushi-workbench-v2';
  const ATTACHMENT_DB = 'fabushi-workbench-attachments-v1';
  const ATTACHMENT_STORE = 'files';
  const ATTACHMENT_UPLOAD_WAIT_MS = 45000;
  const ATTACHMENT_RETRY_INTERVAL_MS = 5000;
  const ATTACHMENT_NATIVE_INPUT_STABLE_MS = 1000;
  // An attachment that is still being processed is a resumable upload, not a
  // terminal task error. Keep the retry bounded per attempt, then back off so
  // a renderer that never exposes its preview cannot create a hot loop.
  const ATTACHMENT_AUTO_RETRY_BASE_MS = 5000;
  const ATTACHMENT_AUTO_RETRY_MAX_MS = 60000;
  const NAV = 'fabushi-workbench-navigation-v2';
  const TAB_SESSION_KEY = 'fabushi-workbench-tab-session-v1';
  const TASK_TRANSFER_KEY = 'fabushi-workbench-task-transfer-v1:';
  const LEGACY_OWNER_KEY = 'fabushi-workbench-legacy-owner-v1';
  const ROOT = 'fabushi-auto-confirm-root';
  // Model presets must exist before any bootstrap persistence path. Task
  // transfer/recovery can persist the workbench before the later UI helpers
  // are initialized, so durable snapshots need model normalization here.
  const MODEL_PRESETS = Object.freeze([
    Object.freeze({ key:'gpt-5.6-sol', label:'GPT-5.6 Sol', aliases:Object.freeze(['GPT-5.6 Sol','GPT 5.6 Sol','5.6']) }),
    Object.freeze({ key:'gpt-6', label:'GPT-6', aliases:Object.freeze(['GPT-6','GPT 6']) }),
    Object.freeze({ key:'gpt-5.5', label:'GPT-5.5', aliases:Object.freeze(['GPT-5.5','GPT 5.5']) }),
  ]);
  const DEFAULT_MODEL_PRESET = 'gpt-5.6-sol';
  function normalizeModelPreset(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    const preset = MODEL_PRESETS.find(item => item.key === raw
      || item.label.toLowerCase() === raw
      || item.aliases.some(alias => alias.toLowerCase() === raw));
    return preset?.key || DEFAULT_MODEL_PRESET;
  }
  // Model presets are declared with the bootstrap constants because storage
  // persistence can run before the workbench/task helpers are initialized
  // (for example while claiming a task-transfer ticket). Keep normalization
  // available for every durable snapshot path from the first bootstrap pass.
  // This limit is only for unbound ambiguous sends that still have no durable
  // conversation identity after recovery. Once a real /c/<id> URL is bound,
  // abnormal reply recovery stays in that conversation until a true final reply.
  const NO_FINAL_REPLY_RETRY_LIMIT = 4;
  // Explicit send failures and unbound ambiguous sends can still use bounded
  // fresh-session recovery. A bound conversation never becomes a retry
  // candidate merely because ChatGPT temporarily removes the Stop control.
  const NO_FINAL_REPLY_BACKOFF_BASE_MS = 5 * 60 * 1000;
  const NO_FINAL_REPLY_BACKOFF_MAX_MS = 30 * 60 * 1000;
  // A final answer may become static on a document that was previously
  // observed in loading/generating state. Keep a short grace period, then
  // finish even when the prior scan was not itself a clear observation.
  const FINAL_REPLY_STABILITY_MS = 4000;
  const RECOVERED_STATIC_FINAL_STABILITY_MS = 8000;
  // A bound conversation can stop changing while ChatGPT is waiting for an
  // authorization card, a renderer update, or an image/tool result. Reload
  // the same route after five minutes with no visible progress. An explicit
  // ChatGPT connection-interrupted notice is different: it is an abnormal
  // terminal handoff signal and never enters this same-route stall policy.
  const STALLED_REFRESH_MS = 5 * 60 * 1000;
  // Keep the persisted generic-stall reload interval aligned with the detector.
  // A page that remains unchanged can therefore be retried again, but never
  // more than once per five minutes.
  const STALLED_REFRESH_COOLDOWN_MS = STALLED_REFRESH_MS;
  // Ambiguous Send confirmation gets one bounded 90-second window. If the
  // current round still has no bindable conversation after that window, the
  // recovery policy is an immediate fresh-chat resend rather than repeated
  // reloads of an unowned page.
  // A permanent page error must not create a hot loop of new conversations.
  // The first blocked recovery is immediate; repeated failures remain queued
  // and retry automatically with a short exponential delay, never as a
  // terminal manual-action state.
  const BLOCKED_AUTO_RETRY_BASE_MS = 15 * 1000;
  const BLOCKED_AUTO_RETRY_MAX_MS = 3 * 60 * 1000;
  const MAX_REVIEW_REPAIR_ATTEMPTS = 2;
  const ROUTE_HYDRATION_TIMEOUT_MS = 30000;
  const ROUTE_RECOVERY_LIMIT = 2;
  // A visible ChatGPT route-level “unable to load conversation” error is
  // stronger evidence than an ambiguous blank renderer. Retry that exact
  // conversation every 30 seconds, at most seven times, then preserve the
  // task/carry and continue in a fresh conversation.
  const CONVERSATION_LOAD_FAILURE_RETRY_MS = 30 * 1000;
  const CONVERSATION_LOAD_FAILURE_REFRESH_LIMIT = 7;
  const ROUTE_RECOVERY_RETRY_INTERVAL_MS = 60 * 1000; // legacy persisted-field compatibility; exhaustion no longer auto-retries.
  const CONTINUATION_PROMPT = '继续完成所有';
  const MAX_SAME_SESSION_CONTINUATIONS = 3;
  const CONTINUATION_SEND_COOLDOWN_MS = 60 * 1000;
  const ENDED_NO_FINAL_STABILITY_MS = 8000;
  // Review/acceptance turns can temporarily lose Stop while ChatGPT is still
  // reasoning or hydrating the committed JSON response. Do not duplicate the
  // review after the ordinary eight-second ended-state window; keep the exact
  // conversation for a bounded two-minute settlement grace instead.
  const REVIEW_ENDED_NO_FINAL_STABILITY_MS = 2 * 60 * 1000;
  const RELOAD_STOP_ABSENCE_STABILITY_MS = 8000;
  const RATE_LIMIT_FRESH_RETRY_AFTER = 3;
  // The carry is normally much smaller than this. Keep a generous bound so a
  // long assistant reply can survive a conversation-length handoff without
  // turning one pathological DOM response into unbounded localStorage/prompt
  // growth. Preserve both the beginning and the most recent continuation edge.
  const CONVERSATION_LENGTH_CARRY_MAX = 64_000;
  const SEND_UI_WAIT_MS = 45000;
  // The model/reasoning selector is required before Send, but ChatGPT can
  // occasionally hydrate the composer without mounting that selector. This is
  // a recoverable renderer state, not a terminal wait. Recheck for one minute,
  // then refresh the same page and repeat until the selector appears.
  const REASONING_PICKER_REFRESH_MS = 60 * 1000;
  // One model-picker toggle per settled interaction. Rapid repeats can close the
  // strength surface just after it hydrates; keep the former deliberate gap.
  const MODEL_PICKER_MIN_CLICK_INTERVAL_MS = 650;
  // A single browser tab can only render one ChatGPT route at a time, but
  // independent conversations continue server-side. Rotate inspection of
  // their durable /c/<id> URLs instead of holding the tab on one task.
  const SUPERVISION_INTERVAL_MS = 15000;
  const VISIBLE_SCAN_INTERVAL_MS = 4000;
  const STREAM_TEXT_TAIL_LIMIT = 6000;
  const SLOW_SCAN_DIAGNOSTIC_THRESHOLD_MS = 1200;
  const SLOW_SCAN_DIAGNOSTIC_INTERVAL_MS = 30000;
  const HIDDEN_SCAN_INTERVAL_MS = 15000;
  const AUTO_START_RETRY_MS = 5000;
  const NAV_TICKET_TTL_MS = 10 * 60 * 1000;
  const SEND_CONFIRM_TIMEOUT_MS = 90000;
  const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;
  const MIN_SEND_INTERVAL_MS = 60 * 1000;
  const GLOBAL_APPROVAL_SCAN_MS = 1500;
  const HIDDEN_GLOBAL_APPROVAL_SCAN_MS = 8000;
  // Connector approval is asynchronous: after selecting the conversation-
  // scoped grant ChatGPT may disable or briefly remount the card while Stop is
  // already absent. Keep a short task-scoped settlement latch so one transient
  // DOM gap can never be mistaken for a finished generation slice.
  const APPROVAL_SETTLEMENT_MS = 12 * 1000;
  // A connector authorization surface can mount before its split controls or
  // conversation-scoped menu option are fully hydrated. In automatic approval
  // mode, do not wait on that renderer state forever: reload the same bound
  // conversation after one quiet minute, then at most once per minute until the
  // card becomes usable. This is deliberately separate from generic stalled
  // recovery because unresolved authorization must never escalate to fresh chat.
  const APPROVAL_UNAVAILABLE_REFRESH_MS = 60 * 1000;
  // Never abandon a bound conversation from one instantaneous "no approval"
  // sample. ChatGPT can mount approval UI between renderer slices, and the
  // current approval card may sit outside the role-derived message scopes.
  // Require a second stable no-approval observation after a wide structural
  // re-scan before Stop-disappearance recovery is allowed.
  const STOP_NO_APPROVAL_CONFIRM_MS = 8 * 1000;
  const CHAT_WORK_STAY_RETRY_MS = 3000;
  const CHAT_WORK_STAY_SETTLEMENT_MS = 45 * 1000;
  const POPUP_DISMISS_SCAN_MS = 5000;
  const HIDDEN_POPUP_DISMISS_SCAN_MS = 15000;
  // A full ChatGPT navigation creates a new document before the previous
  // document's Web Lock callback has necessarily unwound. Keep the persisted
  // tab identity while that handoff settles; only after the bounded window do
  // we treat the page as a genuine duplicate tab and allocate a new owner.
  const WORKSPACE_RECLAIM_TIMEOUT_MS = 5000;
  const WORKSPACE_RECLAIM_FAST_TIMEOUT_MS = 1000;
  const WORKSPACE_RECLAIM_POLL_MS = 50;
  const RUNNER_RECLAIM_TIMEOUT_MS = 5000;
  const RUNNER_RECLAIM_POLL_MS = 100;
  // A renderer crash stops this script before it can run pagehide. Persist a
  // small, content-free lease heartbeat so a newly loaded ChatGPT document
  // (or an optional page-external watcher) can distinguish a dead workspace
  // from a deliberately paused one. The TTL is intentionally longer than the
  // usual background-tab timer clamp to avoid stealing a healthy hidden tab.
  const WORKSPACE_HEARTBEAT_KEY = 'fabushi-workspace-heartbeat-v1:';
  const WORKSPACE_AUTO_RECOVERY_KEY = 'fabushi-workspace-auto-recovery-v1:';
  const WORKSPACE_HEARTBEAT_INTERVAL_MS = 15000;
  const WORKSPACE_HEARTBEAT_STALE_MS = 120000;
  const WORKSPACE_RECOVERY_SCAN_MS = 15000;
  // Closing a task tab is an explicit user action. Never resurrect that
  // workspace automatically in another/current tab or through the host bridge.
  // Explicit same-document reload handoffs and manual Restore remain supported.
  const AUTOMATIC_WORKSPACE_RECOVERY_ENABLED = false;
  const HOST_RECOVERY_CAPABILITY = 'tab-recovery';
  const HOST_RECOVERY_REQUEST_TYPE = 'recovery-capability.request';
  const HOST_RECOVERY_RELEASE_TYPE = 'recovery-capability.release';
  const HOST_RECOVERY_GRANTED_TYPE = 'recovery-capability.granted';
  const HOST_RECOVERY_DENIED_TYPE = 'recovery-capability.denied';
  const HOST_RECOVERY_RENEW_MS = 30000;
  const HOST_RECOVERY_RESPONSE_TTL_MS = 10000;
  // A userscript cannot read the renderer's RSS or force V8 to collect the
  // whole ChatGPT page. Heap sampling is diagnostic-only: automatic monitoring
  // may compact script-owned stale state, but it never reloads/navigates/releases
  // the active task because of a memory threshold. Host discard remains manual.
  const HOST_MEMORY_CAPABILITY = 'tab-memory-discard';
  const HOST_MEMORY_REQUEST_TYPE = 'tab-memory.request';
  const HOST_MEMORY_RESPONSE_TYPE = 'tab-memory.response';
  const HOST_MEMORY_PLUGIN_ID = 'chatgpt-auto-confirm';
  const MEMORY_MONITOR_INTERVAL_MS = 30000;
  const MEMORY_LOCAL_CLEANUP_COOLDOWN_MS = 60000;
  const MEMORY_HOST_REQUEST_COOLDOWN_MS = 5 * 60 * 1000;
  const MEMORY_HOST_RESPONSE_TTL_MS = 10000;
  // Full ChatGPT document navigations are expensive. The host guard adds a
  // second, cross-document budget; these local limits remain effective when
  // the script is used without Fabushi.
  const HOST_NAVIGATION_CAPABILITY = 'tab-navigation-guard';
  const HOST_NAVIGATION_REQUEST_TYPE = 'navigation-guard.request';
  const HOST_NAVIGATION_CANCEL_TYPE = 'navigation-guard.cancel';
  const HOST_NAVIGATION_GRANTED_TYPE = 'navigation-guard.granted';
  const HOST_NAVIGATION_DENIED_TYPE = 'navigation-guard.denied';
  const HOST_NAVIGATION_RESPONSE_TTL_MS = 5000;
  // tick() suppresses scheduling while a document navigation is in flight.
  // If Chrome accepts a reload/replace request but this document never unloads,
  // this watchdog releases that barrier so one failed navigation cannot silence
  // the automation indefinitely.
  const NAVIGATION_COMMIT_WATCHDOG_MS = 8000;
  const LOCAL_NAVIGATION_COOLDOWN_MS = 30000;
  const LOCAL_NAVIGATION_BURST_WINDOW_MS = 5 * 60 * 1000;
  const LOCAL_NAVIGATION_BURST_LIMIT = 6;
  const LOCAL_NAVIGATION_BREAK_MS = 60000;
  // These values only label diagnostics and decide when to run non-disruptive
  // local housekeeping. They are not execution limits and never trigger reload.
  const MEMORY_DIAGNOSTIC_ELEVATED_BYTES = 1536 * 1024 * 1024;
  const MEMORY_DIAGNOSTIC_HIGH_BYTES = 1792 * 1024 * 1024;
  const MEMORY_DIAGNOSTIC_RATIO_MIN_BYTES = 256 * 1024 * 1024;
  const MEMORY_DIAGNOSTIC_ELEVATED_RATIO = 0.5;
  const MEMORY_DIAGNOSTIC_HIGH_RATIO = 0.7;
  // Keep a rolling two-hour activity window in memory/UI. The canonical
  // localStorage workbench still stays latest-only; recent human-readable
  // activity is persisted separately so page refresh/recovery does not erase
  // what the automation just did.
  const TASK_MESSAGE_RETENTION_MS = 2 * 60 * 60 * 1000;
  const MAX_TASK_MESSAGES = 360;
  const MAX_TASK_MESSAGE_TEXT = 12000;
  const MAX_TASK_MESSAGE_CHARS = 600000;
  const MAX_RENDERED_TASK_MESSAGES = 80;
  const MAX_RENDERED_TASK_MESSAGE_CHARS = 180000;
  const RECENT_ACTIVITY_SESSION_KEY = 'fabushi-workbench-recent-activity-v1';
  const RECENT_ACTIVITY_DB = 'fabushi-workbench-recent-activity-v1';
  const RECENT_ACTIVITY_STORE = 'events';
  const RECENT_ACTIVITY_MAX_RECORDS = 360;
  const RECENT_ACTIVITY_MAX_CHARS = 600000;
  let recentActivityDBPromise = null;
  // localStorage is a shared, synchronous browser-origin quota. Bound the
  // aggregate diagnostic history well below that quota so many long-running
  // tasks cannot independently grow the canonical workbench until setItem()
  // throws. Emergency limits are used only after a real quota rejection.
  const STORAGE_NORMAL_TASK_MESSAGES = MAX_TASK_MESSAGES;
  const STORAGE_NORMAL_MESSAGE_TEXT = MAX_TASK_MESSAGE_TEXT;
  const STORAGE_NORMAL_TASK_MESSAGE_CHARS = MAX_TASK_MESSAGE_CHARS;
  const STORAGE_NORMAL_GLOBAL_MESSAGE_CHARS = 800000;
  const STORAGE_EMERGENCY_TASK_MESSAGES = 12;
  const STORAGE_EMERGENCY_MESSAGE_TEXT = 4000;
  const STORAGE_EMERGENCY_TASK_MESSAGE_CHARS = 24000;
  const STORAGE_EMERGENCY_GLOBAL_MESSAGE_CHARS = 200000;
  // Rendering is still bounded independently from the two-hour retained log
  // so a verbose task cannot monopolize the ChatGPT renderer.
  const AUTO_RECOVERABLE_STATE_NAMES = new Set(['queued', 'sending', 'uploading', 'waiting', 'loading', 'generating', 'approval', 'reviewing']);
  const volatileStorageShadow = new Map();
  const fabushiStorageSizeCache = new Map();
  const WORKBENCH_OVERFLOW_KEY = 'fabushi-workbench-overflow-v1:';
  const WORKBENCH_LOCAL_STORAGE_TARGET_CHARS = 500_000;
  const FABUSHI_LOCAL_STORAGE_MAX_CHARS = 600_000;
  const DURABLE_RECOVERY_TEXT_MAX_CHARS = 48_000;
  const DURABLE_PREPARED_PROMPT_MAX_CHARS = 128_000;
  const STORAGE_CLEANUP_COOLDOWN_MS = 60 * 1000;
  const STORAGE_CLEANUP_SCAN_LIMIT = 96;
  let storageCleanupLastAt = 0;
  let activeWorkspaceStorageId = '';
