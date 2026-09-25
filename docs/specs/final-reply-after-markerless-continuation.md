# Final reply after a markerless continuation — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-25
Related incident: live ChatGPT screenshot shows a final assistant reply followed by an unnecessary `继续完成所有` continuation

## 1. Context / problem

When ChatGPT virtualizes the original task-marker user message, `latestTurn(task)` returns unowned. The exact-route final-only fallback currently requires a previously armed `recoveredFinalIdentity`, even when the latest visible user message is the exact `继续完成所有` prompt and the task has persisted a continuation send. An otherwise complete assistant reply can therefore be treated as an ended-without-final conversation and trigger another continuation.

## 2. Goal

Recognize a strong final reply to this task's recorded continuation when the original marker is virtualized, preventing duplicate `继续完成所有` sends while retaining exact-route and foreign-turn safeguards.

## 3. Non-goals

- Do not accept arbitrary assistant text or toolbar controls from before a newer user turn.
- Do not attribute a visible non-task user turn to the task.
- Do not relax Stop, pending approval, exact URL, competing URL owner, or foreign task marker guards.
- Do not change the existing final toolbar and stable-across-scans completion requirements.
- Do not publish a new version unless explicitly requested.

## 4. Requirements

- R1: Keep mounted task-marker ownership as the preferred final-reply attribution path.
- R2: If the task marker is absent, allow the existing exact-route final-only fallback without a recovery identity only when the latest mounted user turn exactly equals `CONTINUATION_PROMPT` and this task has `continuationCount > 0`.
- R3: The fallback still requires exact live/task URL equality, no other persisted task owner for the URL, no foreign task marker, no mounted own marker contradicting the latest user, no Stop and no pending authorization card.
- R4: The candidate assistant and response toolbar must belong to the latest visible assistant turn after that exact continuation user turn; an older final toolbar before it cannot satisfy completion.
- R5: Strong final evidence and the existing final stability gate remain required; missing/ambiguous identity stays waiting and must not trigger route-only continuation when a qualifying final turn is visible.
- R6: Existing foreign-user and cross-task negative regressions remain green; add positive and stale-prior-toolbar regressions.

## 5. Current state

The screenshot's final assistant answer visibly has Copy, feedback, share and source controls. A later user turn with `继续完成所有` appears below it, followed by a new active response. This confirms that a continuation was sent after the preceding answer. The markerless route fallback does not run unless `recoveredFinalIdentityMatches()` succeeds, even when the persisted task records a continuation and the exact continuation prompt is the latest visible user turn.

## 6. Target state

On an exact, uniquely owned bound conversation, a recorded continuation prompt can serve as the current user boundary when the original task marker is virtualized. The fallback reads only the latest assistant turn after that prompt and only accepts the existing strong final evidence. A toolbar belonging to the prior assistant turn remains excluded.

## 7. Architecture and ownership boundaries

The fallback is local to `taskTurnForInspection()`. It may set recovered route ownership only for the candidate response after the recorded continuation. It must not relax `latestTurn(task)` or change attribution for normal turns. Exact canonical conversation URL, persisted task URL uniqueness, task marker absence, and foreign marker checks remain independent gates.

## 8. Verification / test strategy

- Add JSDOM regression for markerless exact continuation + persisted continuation count + strong final toolbar + no pre-armed recovery identity.
- Add regression showing an old assistant toolbar before a later continuation prompt is not considered the continuation reply.
- Preserve existing foreign visible user-turn, foreign marker, cross-task, Stop, approval, and final stability regressions.
- Run `node --check`, focused tests, and `npm test`.

## 9. Acceptance criteria

- AC-1: A strong final assistant reply after a recorded continuation is owned and completes through the normal stability gate even if the original marker was virtualized and no recovery identity was armed.
- AC-2: A final toolbar before the latest continuation user turn does not complete the task.
- AC-3: Existing route/foreign task/user/Stop/approval protections remain fail-closed.
- AC-4: No redundant continuation is initiated once this final evidence is available.

## 10. Delivery / release

No storage migration is required. This request does not itself authorize publishing another release. Roll back by reverting the fallback relaxation and regressions.

## 11. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R6 | passed | `taskTurnForInspection()` keeps mounted marker ownership first, then permits exact-route final-only recovery when the latest user turn is the recorded exact continuation prompt; exact route uniqueness, foreign task markers, newer mounted user turns, Stop, approvals, strong final controls and latest-assistant scoping remain required. |
| AC-1 | passed | New regression proves `taskTurnForInspection()` and `ownedFinalReplyReady()` accept a final response after a recorded continuation without any pre-armed recovery identity. |
| AC-2 | passed | New regression places an older final toolbar before the latest continuation prompt and proves no route-owned final is returned. |
| AC-3 | passed | Existing recovered final, foreign user-turn, foreign-marker, Stop/approval and cross-task regressions remain green in full suite. |
| AC-4 | passed | With the latest answer classified as final, `inspect()` does not meet the `!sample.final` abnormal-continuation condition; exact final recognition regression passes. |
| Verification | passed | `node --check chatgpt-auto-confirm.user.js`; `npm test`: 212 tests, 205 passed, 0 failed, 7 skipped. |
