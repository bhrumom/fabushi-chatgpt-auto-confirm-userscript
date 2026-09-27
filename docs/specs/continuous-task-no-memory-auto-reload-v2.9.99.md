# Continuous task processing without automatic memory reload — v2.9.99

Status: completed  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-28  
Related incident: the userscript interrupted an active task after the page JS-heap estimate reached 1.75 GiB and logged that it was releasing the old page supervisor and reloading the same ChatGPT conversation.

## 1. Context / problem

Earlier releases introduced an automatic same-tab memory-pressure recovery path. After sustained V8 JS-heap estimates at or above 1.75 GiB, the script persisted task state, released its runner/workspace ownership, and reloaded the current ChatGPT conversation. This was intended to reduce renderer memory pressure, but it interrupts long-running tasks and can repeatedly disturb an otherwise healthy ChatGPT session.

The current requirement is different: **memory estimates must never interrupt task execution automatically**. The script should keep supervising and processing the task continuously, even when `performance.memory.usedJSHeapSize` is above the previous 1.75 GiB threshold.

## 2. Goal

Remove the automatic memory threshold as an execution/reload limit. Memory telemetry may remain visible for diagnostics, and the script may continue bounded in-process cleanup of its own stale logs/objects, but no memory reading may automatically reload, navigate, release the runner/workspace, discard a tab, or otherwise interrupt the current task.

## 3. Superseded behavior

This specification supersedes the automatic memory-reload requirements from:
- `docs/specs/memory-pressure-takeover-and-continuation-cap.md` R1-R4 and R8-R9, plus its 2026-09-27 correction requiring automatic 1.75 GiB same-tab handoff.
- the v2.9.95 README/spec note that two samples at 1.75 GiB trigger automatic same-tab recovery.

The continuation-cap behavior and all non-memory task recovery rules remain unchanged.

## 4. Requirements

- R1: Remove 1.75 GiB (1792 MiB) as an automatic execution/reload threshold. No JS-heap byte value or ratio may automatically reload or navigate the ChatGPT page.
- R2: `inspectMemoryPressure()` may update diagnostics and run bounded local cleanup, but it must never call automatic host cleanup, same-tab reload, tab discard, workspace release, runner suspension, or recovery navigation because of memory pressure.
- R3: Repeated high-memory samples, including 1.8 GiB and values above 2 GiB when the browser still exposes a live page, must leave the active task URL, token, phase, round, state/runner ownership, and current document unchanged.
- R4: Remove the automatic memory-reload implementation and its enforcement-only constants/state where they are no longer used. Legacy persisted `memoryPressureReloadAt` / `memoryPressureReloadURL` fields may be ignored; they must not affect execution.
- R5: Keep memory telemetry diagnostic-only. The UI/status may classify an estimate as normal/elevated/high, but it must clearly state that memory monitoring does not automatically reload or interrupt tasks.
- R6: Keep non-disruptive local memory housekeeping: bounded task message history, stale observation cleanup, detached attachment dispatch cleanup, and idle transient-resource release may continue.
- R7: Keep explicit user-initiated memory cleanup/discard behavior available through the existing manual `cleanup_memory` tool. Manual action is not an automatic memory limit.
- R8: Existing memory-pressure same-tab recovery tickets must no longer be created by automatic monitoring. Existing unrelated navigation/recovery mechanisms remain unchanged.
- R9: Add regressions proving (a) repeated 1.8 GiB samples do not reload/navigate/release the task, (b) values above 2 GiB still do not interrupt, (c) automatic monitoring never sends the host memory-discard request, (d) direct non-user-initiated cleanup calls fail closed as `automatic-memory-recovery-disabled`, and (e) manual cleanup still sends its explicit host request.
- R10: Preserve the v2.9.98 Stop/reload-hydration and reply-carry behavior; removing automatic memory reload must not change Stop-disappearance handoff rules.
- R11: Bump userscript metadata/runtime/README/version assertions to 2.9.99.
- R12: Deliver only after exact-head GitHub Actions Test succeeds, then merge, verify canonical-main Test and Release workflow, read back the v2.9.99 asset, and record compliance evidence.

## 5. Target behavior

Memory monitor tick
→ read optional JS-heap estimate
→ update diagnostic pressure level
→ optionally compact only script-owned stale/bounded state
→ **return to normal task supervision**
→ no reload
→ no navigation
→ no tab discard
→ no workspace release
→ no task handoff solely because of memory.

Manual memory cleanup
→ user explicitly invokes cleanup
→ retain the existing safety checks and host request behavior.

## 6. Safety / ownership

This change deliberately favors uninterrupted task execution over proactive renderer-reset behavior. Browser/OS-level memory management can still terminate or reload a page independently; the userscript must not claim it can prevent that. Existing task persistence and ordinary recovery logic remain available if such an external event actually occurs.

## 7. Verification

Focused regressions must verify:
1. two or more 1.8 GiB samples leave the same task and route running;
2. a >2 GiB sample does not trigger an automatic recovery action;
3. no `tab-memory.request` is emitted by automatic monitoring;
4. no memory recovery NAV ticket is created by automatic monitoring;
5. no `memoryPressureReloadAt` / `memoryPressureReloadURL` is written;
6. manual `requestHostMemoryCleanup(..., userInitiated:true)` still works;
7. local cleanup remains bounded and non-destructive;
8. existing Stop-disappearance/reload-hydration tests stay green.

## 8. Acceptance criteria

- AC-1: The log message “网页 JS 堆估算已连续达到 1.75 GB…正在释放旧页面任务监督器…” can no longer be produced by the runtime.
- AC-2: High JS-heap telemetry never automatically changes the task route or suspends the runner.
- AC-3: The task continues processing continuously until an ordinary task/recovery rule—not memory pressure—requires a transition.
- AC-4: Manual cleanup remains available.
- AC-5: Exact-head, canonical-main Test and Release v2.9.99 all succeed.

## 9. Compliance record

Implementation head `d906bd91e68f7afb357866166675073447d1a93d` passed GitHub Actions Test run `36339772553`: 258 tests, 251 passed, 0 failed, 7 skipped. Focused regressions passed for repeated 1.8 GiB monitoring without reload/host requests, >2 GiB monitoring without interruption, fail-closed non-user cleanup calls, manual cleanup host requests, diagnostic-only status, and the v2.9.98 Stop/reload-hydration + reply-carry regressions.

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R4 / AC-1-AC-3 | passed | The automatic threshold/reload constants, pressure streak, `memoryReloadSafety()`, `reloadTaskForMemoryPressure()`, legacy reload-field writes, and the “网页 JS 堆估算已连续达到…” runtime message are removed. Automatic sampling never creates a NAV ticket, changes the task URL/token/state, releases the runner/workspace, reloads, or contacts the host. |
| R5-R6 | passed | Memory pressure remains diagnostic-only; status explicitly says it will not automatically refresh or interrupt tasks. Elevated/high estimates may only run bounded local cleanup of script-owned stale state. |
| R7 / AC-4 | passed | Explicit `cleanup_memory` / `requestHostMemoryCleanup(..., userInitiated:true)` remains available and its regression still verifies the redacted host request. Non-user calls return `automatic-memory-recovery-disabled`. |
| R8-R9 | passed | Regressions verify 1.8 GiB and >2 GiB never create memory recovery tickets or host discard requests and never write `memoryPressureReloadAt` / `memoryPressureReloadURL`. |
| R10 | passed | Existing Stop disappearance, reload hydration, pagehide reply snapshot and fresh-session carry regressions remain green in the full suite. |
| R11 | passed | Userscript metadata/runtime, README and package assertions report 2.9.99. |
| R12 / AC-5 | passed | Final PR head `541cf765638834034f7c0e6fc0365d8a394c52ff` passed exact-head Test `36339834317`; PR #107 merged as `df1bd5de18b5d4a9ee4605d7d2a1df899ff2a1c2`; canonical-main Test `36339874667` succeeded; Release `36339908061` succeeded and published `v2.9.99`. Release asset `chatgpt-auto-confirm.user.js` is 353333 bytes with SHA-256 `b272b4a14ebb42b0cbf1fb404e8408438fef6d807ecab74d459b7713b4e51661`; canonical main readback reports metadata/runtime 2.9.99. |

## 10. Final delivery evidence

- Implementation PR: #107.
- Final exact-head SHA: `541cf765638834034f7c0e6fc0365d8a394c52ff`.
- Final exact-head Test: `36339834317`, success.
- Merge SHA: `df1bd5de18b5d4a9ee4605d7d2a1df899ff2a1c2`.
- Canonical-main Test: `36339874667`, success.
- Release workflow: `36339908061`, success.
- GitHub Release: `v2.9.99`, published 2026-09-27T18:14:38Z.
- Release asset: `chatgpt-auto-confirm.user.js`, 353333 bytes, SHA-256 `b272b4a14ebb42b0cbf1fb404e8408438fef6d807ecab74d459b7713b4e51661`.
- Release target/source commit: `c1ec8363c0340e7bc1a4135d0d22f8ea810f5c7a`; the release workflow verified the userscript file on tested canonical main is byte-identical to that source commit.
