# Ended detection: stale loader and recovery persistence — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related incident: live v2.9.59 still refreshes an ended tool-heavy conversation every 15 minutes

## 1. Context / problem

The v2.9.59 ended-conversation detector is present, but the live task can still miss it and fall back to the generic 15-minute stalled refresh.

The observed trace exposes three independent gaps:

1. Ended eligibility currently requires `!sample.rawLoading`. `rawLoading` is page-global and intentionally scans broad ChatGPT surfaces. A stale/decorative loader or progress/status element outside the active conversation can therefore block ended detection even when the owned conversation has no Stop/streaming/approval state and the composer is already enabled.
2. Manual pause/resume does not clear the task's in-memory `observations`. A task that was already stalled for 15 minutes can therefore be resumed and hit the old stalled timer almost immediately; this explains the live “恢复 11 秒后第 8 次刷新” sequence.
3. Explicit manual-recovery capability is transient. Automatic script/page re-bootstrap calls `armWorkspaceRecoveryIdentity()` in strict mode and can overwrite the manual recovery identity after a script-triggered reload. Marker-virtualized tool-only conversations then lose the ownership needed for ended detection.

## 2. Goal

Make the ended-without-final detector authoritative for an idle owned conversation even if unrelated page-global loading UI remains, reset stale stall timers on resume, and preserve explicit manual recovery across document/script reloads until the task actually advances or starts a fresh dispatch.

Publish as userscript v2.9.60.

## 3. Non-goals

- Do not ignore assistant-turn streaming/busy markers, Stop, approval cards, blockers or rate limits.
- Do not treat an unavailable/disabled composer as an ended conversation.
- Do not weaken normal final-reply ownership.
- Do not preserve manual recovery into a new dispatch, new phase/round, or completed task.
- Do not remove the generic 15-minute refresh for genuinely unresolved pages.

## 4. Requirements

- R1: Ended-without-final eligibility must use conversation-scoped activity evidence, not a broad page-global loading hint, when the exact task route is owned.
- R2: A broad/stale page loader must not block ended detection when the active turn is not streaming, Stop is absent, approval/blocker/rate-limit are absent, and the task composer is enabled.
- R3: Assistant-turn streaming/busy state must continue to block ended detection even if the composer is visible.
- R4: While an ended-without-final candidate is active, the generic 15-minute stalled refresh must not race it.
- R5: Manual task resume must clear prior observation/stall timing for that task so an old 15-minute clock cannot trigger an immediate refresh after resume.
- R6: Explicit manual recovery must persist as task state across userscript/page bootstrap and script-triggered reloads for the same task phase/round/token.
- R7: Re-arming recovered identity without an explicit override must inherit the persisted explicit-recovery capability.
- R8: Explicit-recovery capability must be cleared by fresh-dispatch cleanup and when a real final reply advances/completes the task.
- R9: Ordinary tasks that were never manually recovered remain strict after startup; no automatic stable-text completion is introduced.
- R10: Add a regression where a visible stale/global loading indicator coexists with an owned ended conversation and enabled composer; the task must send `继续完成所有` after the 8-second gate.
- R11: Add a regression proving pause/resume deletes stale observations so a 15-minute progress clock cannot immediately refresh.
- R12: Add a regression proving startup re-arm preserves explicit manual recovery metadata for a previously manually recovered exact-route task.
- R13: Preserve existing loading/Stop/streaming/approval/final and cross-task negative tests.
- R14: Bump metadata/runtime/version assertions to 2.9.60.
- R15: Merge only after exact-head GitHub Actions Test passes, then verify canonical-main Test and Release v2.9.60.

## 5. Target behavior

Task is waiting on exact bound conversation
→ tool execution is over / composer is usable
→ a stale page-global status/spinner may still exist
→ no conversation-local Stop/streaming/approval/blocker/rate-limit
→ ended timer starts
→ remains stable for 8 seconds
→ send `继续完成所有` in the same chat
→ no 15-minute refresh.

Pause → resume
→ clear old observation/progress clocks
→ re-check from zero
→ do not inherit a pre-pause 15-minute stall.

Script/page reload during an explicit manual recovery
→ preserve explicit recovery capability for the same phase/round/token
→ re-snapshot the currently mounted user boundary
→ continue end/final detection instead of reverting to strict marker-only ownership.

## 6. Verification

- Full repository Test workflow on exact PR head.
- New stale-global-loader ended-detection regression passes.
- New resume-observation-reset regression passes.
- New explicit-recovery bootstrap persistence regression passes.
- Existing v2.9.59 ended-conversation regressions remain green.
- Existing final/loading/streaming/approval/cross-task guards remain green.
- Canonical-main Test succeeds.
- Release workflow publishes v2.9.60.

## 7. Acceptance criteria

- AC-1: An ended conversation with an enabled composer is not held forever by unrelated page-global loading UI.
- AC-2: Manual resume cannot immediately trigger an old 15-minute stalled refresh.
- AC-3: Script-triggered reload does not erase explicit manual-recovery ownership.
- AC-4: Ended detection continues in the same chat after about 8 seconds.
- AC-5: No duplicate fresh chat or false completion is introduced.
- AC-6: Exact-head Test, canonical-main Test and Release workflow all pass.
- AC-7: Canonical main and GitHub Release report v2.9.60.

## 8. Delivery evidence

- Implementation PR: #75.
- Final exact-head SHA: `a18e5586f2779fdd94baa857aa8ce4d0ffa892b4`.
- Exact-head Test run: `35734723797`, conclusion `success`; full suite `176/176 PASS`, `0 FAIL`.
- Squash merge / canonical source SHA: `d877ab4b97cc35d61c449ac0ad2fb9513873f069`.
- Canonical-main Test run: `35734816181`, conclusion `success`.
- Release workflow run: `35734868119`, conclusion `success`.
- GitHub Release: `v2.9.60`, published 2026-09-22T13:39:14Z from `d877ab4b97cc35d61c449ac0ad2fb9513873f069`.
- Release asset: `chatgpt-auto-confirm.user.js`, 281516 bytes, SHA-256 `6511641ee53629c45671b37d71f701b3b27d6d9a3f95b173e8b7eeb4e3d77ca2`.
- Canonical main readback reports metadata `@version 2.9.60` and runtime `VERSION = '2.9.60'`.

## 9. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R4 | passed | Ended detection now relies on conversation-scoped activity plus an enabled composer, ignores unrelated page-global loader UI, and suppresses the 15-minute stall refresh while an ended candidate is active. |
| R5 | passed | Manual resume deletes the task observation and clears ended timers before re-inspection. |
| R6-R9 | passed | Explicit manual recovery is persisted as task state and inherited when recovery identity is re-armed across reload/bootstrap; fresh dispatch and real final completion clear it; ordinary tasks remain strict. |
| R10-R12 | passed | New regressions cover a stale global loader, resume observation reset, and explicit-recovery startup persistence. |
| R13 | passed | Full suite retains assistant-local busy/streaming, Stop, approval, final and cross-task guards. |
| R14 | passed | Metadata/runtime/version assertions report 2.9.60. |
| R15 | passed | Exact-head Test 35734723797 passed before merge; canonical-main Test 35734816181 and Release 35734868119 succeeded. |
| AC-1-AC-5 | passed | The live failure modes are covered without introducing fresh-chat duplication or automatic stable-text completion for ordinary tasks. |
| AC-6 | passed | Exact-head, canonical-main and Release workflows all succeeded. |
| AC-7 | passed | Canonical main and GitHub Release both report v2.9.60. |
