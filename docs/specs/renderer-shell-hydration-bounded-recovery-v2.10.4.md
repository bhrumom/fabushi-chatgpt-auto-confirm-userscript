# Renderer shell hydration and bounded recovery — v2.10.4

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-28

## 1. Problem

A completed ChatGPT conversation can be visibly present after reload while the userscript reports:

- “页面刷新后仍在恢复当前任务内容；已保留会话并继续监督，等待消息区和输入框完成加载。”
- “页面刷新后当前会话输入框已就绪，但消息区仍未挂载；最多等待 30 秒，仍为空时只刷新当前会话，不会重复发送或新开会话。”

The current implementation treats `[data-message-author-role=user|assistant]` as the primary message-mount signal. Current renderer variants can expose role at the turn level instead, so a real transcript can be misclassified as a shell-only page.

There is also a true infinite-refresh bug. `recoverStalledRoute()` uses `ROUTE_RECOVERY_LIMIT=2`, but once `rendererRecoveryExhausted` reaches its retry time it clears `routeRecoveryAttempts` back to zero. The same URL/phase/round can therefore repeat 1/2 → 2/2 → cooldown → reset → 1/2 forever.

## 2. Goal

1. Recognize currently rendered ChatGPT turns even when role metadata moved from `data-message-author-role` to turn-level role attributes.
2. Keep final-reply ownership and response-toolbar binding safe.
3. Make shell-only same-route recovery genuinely bounded for one conversation generation.
4. Never automatically enter an endless refresh cycle.

## 3. Requirements

- R1: Recognize user/assistant role from `data-message-author-role`, `data-turn`, or `data-author-role`.
- R2: De-duplicate nested role hosts so one rendered turn is counted once.
- R3: All core transcript checks use the same canonical role-node helper: task marker lookup, loading detection, active generation, visible-message detection, progress fingerprint, latest turn, recovery boundary, approval-surface scan, and send-page cleanliness.
- R4: A turn-level role host with a rendered semantic message descendant counts as a mounted message even if the role host itself has zero layout rects.
- R5: Response toolbar ownership must still bind to the latest assistant turn and must reject older/foreign controls.
- R6: Same-route renderer recovery attempts are keyed by exact conversation URL + phase + round + goal revision.
- R7: Once the bounded same-route recovery limit is reached for that recovery generation, automatic reload remains exhausted. Time passing alone must not reset the counter.
- R8: Recovery exhaustion can be cleared only by real progress, a new route/generation, explicit new dispatch, or an existing reset path that already has new task evidence.
- R9: While recovery is exhausted, the script continues supervision without refreshing the page and emits one durable diagnostic explaining that automatic reload has stopped.
- R10: No duplicate Send click and no automatic new-chat handoff is introduced by this fix.
- R11: Existing final reply, approval, interruption, stale-loader, and zero-rect regressions remain green.
- R12: Release as v2.10.4 only after exact-head and canonical-main tests pass.

## 4. Implementation

Introduce canonical message helpers:

- `conversationRole(node)`
- `conversationRoleNodes(role?)`

Supported role sources:

- `data-message-author-role`
- `data-turn`
- `data-author-role`

Prefer the legacy inner role host when present, otherwise use the turn-level role node. De-duplicate by owning conversation turn.

Replace direct role-selector scans in the message lifecycle with these helpers.

Change `recoverStalledRoute()` so `rendererRecoveryExhausted` is terminal for the current recovery generation. Remove the timer-based reset-to-zero behavior.

## 5. Verification

Focused regressions:

1. Turn-level `data-turn="user|assistant"` transcript is considered mounted.
2. Turn-level role transcript supports task-marker ownership and final Copy detection.
3. Nested legacy + turn-level role metadata is de-duplicated.
4. Shell-only first and second recovery attempts remain bounded.
5. After the limit, advancing time does not restart automatic reload.
6. Hydrated message progress clears the exhausted recovery state through the normal progress/reset path.
7. Existing zero-rect, inherited-Stop, Copy-only final, natural-final fallback, and stale-loader tests remain green.

## 6. Acceptance

- No repeated 1/2 → 2/2 → cooldown → 1/2 cycle on the same conversation generation.
- A visibly rendered turn-level transcript is no longer logged as “消息区仍未挂载”.
- No weakening of cross-task/old-toolbar ownership rules.


## 7. Delivery evidence — 2026-09-28

- PR #117 exact-head Test #348: success on `38898d55aac38f2cf2f03a1a85250ae0ce815b56`.
- Exact-head regression total: 274 tests / 267 passed / 0 failed / 7 skipped.
- Focused regressions passed:
  - `turn-level data-turn roles are mounted messages and support final reply ownership`
  - `nested data-turn and legacy role hosts are de-duplicated to one user and one assistant turn`
  - `loading recovery reaches a durable same-route limit and never restarts by time alone`
  - `stalled route exhaustion preserves the task and cannot restart the refresh loop`
  - `same-tab recovery exhaustion retains the runner and workspace lock without another reload`
- PR #117 squash merge: `56e94bb4106ca95a10f02c8fbe249e63ea74cc5c`.
- Canonical-main Test #349: success.
- Release #161: success.
- Tag `v2.10.4` targets the canonical merge commit.
- Release asset `chatgpt-auto-confirm.user.js`: 362466 bytes.
- Release asset digest: `sha256:3ec478e20c83a1171efc7e467fec924e0fb288a2683e499536bf3e6ccbe56015`.

### Compliance

| Requirement | Status | Evidence |
| --- | --- | --- |
| R1-R5 | passed | Turn-level role support, de-duplication, final Copy ownership, existing zero-rect and toolbar tests all passed in Test #348/#349. |
| R6-R9 | passed | Durable same-route exhaustion tests prove elapsed time does not re-arm refresh and supervision remains active. |
| R10-R11 | passed | Full regression suite is green; no duplicate-Send or shell-only fresh-chat behavior introduced. |
| R12 | passed | v2.10.4 released from tested canonical main. |
