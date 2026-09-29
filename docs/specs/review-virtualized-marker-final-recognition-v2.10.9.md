# Review final reply recognition after task-marker virtualization — v2.10.9

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-09-29
Supersedes: the v2.10.8 final-precedence rule only for the narrow case where ChatGPT has virtualized the current task's marker-bearing user turn after this exact dispatch already exposed Stop.

## 1. Live failure

A real planning/review conversation completed visibly and showed the ordinary final response toolbar, but the userscript repeatedly logged:

- `规划/验收会话已确认发送 · 第 1 轮`
- generation/loading
- `检测到本轮停止按钮已经消失且没有授权卡片`
- `已在任务标识被页面虚拟化后，通过当前任务精确 conversation URL 回退读取最新 assistant 工作内容`

Instead of parsing the finished review and dispatching its `next`, the script classified the turn as an abnormal Stop-disappearance end and created another review conversation.

The current v2.10.8 control flow explains the behavior:

1. `routeEndedOwned` allows an exact-route, no-foreign-owner fallback when the marker-bearing user turn was virtualized.
2. `activityTurn = latestTurn()` can therefore still see the latest assistant text and final toolbar.
3. But `strongOwnedFinal` requires `turn.owned`.
4. `turn.owned` remains false because `taskTurnForInspection()` intentionally refuses route-only ownership unless an explicit recovery identity/continuation exists.
5. Therefore `stopDisappearedFreshEligible` wins even though the latest assistant response is visibly final.
6. The abnormal carry proves the text can be safely extracted, but that same text is not allowed through normal final classification, so review JSON is never parsed.

## 2. Goals

1. Recognize a final reply for the exact current dispatch even if ChatGPT virtualizes its marker-bearing user turn after generation has already been observed.
2. Preserve strict ownership: an exact route alone must still never authorize an assistant result.
3. Bind the fallback final reply to the same assistant response boundary that was observed while Stop was visible.
4. Let the normal final-stability and `finish()` path parse the planning/review response.
5. If the review says `status:"next"`, dispatch the returned `next` as the next Work round.
6. If the review says `status:"complete"`, finish the task.
7. If the response boundary cannot be proven to be the same generation, fail closed and keep the existing fresh-session abnormal recovery.
8. Do not weaken the v2.10.8 30-second × 7 conversation-load recovery.

## 3. Non-goals

- Route equality by itself is not final-result ownership.
- A stale toolbar from an older assistant reply must not satisfy completion.
- A foreign task marker/URL owner must never be consumed.
- A manual newer user turn must never be attributed to the task.
- Do not bypass review JSON validation or repair limits.
- Do not change the final stability duration.
- Do not use transcript text as durable ownership identity when a renderer response/turn identifier is available.

## 4. Safety model

The fallback is enabled only when all of the following are true:

1. The live canonical conversation URL exactly equals the current task URL.
2. The task is not in an ambiguous unbound send state.
3. The current task marker is no longer mounted.
4. No other task marker is mounted.
5. No other task record owns the route.
6. This exact dispatch previously observed a Stop control. The existing dispatch identity already binds URL + phase + round + token + goal revision.
7. While Stop was visible, the runtime persisted a compact assistant-response boundary identity derived from current renderer identifiers (message/turn/content-search unit keys), not the transcript.
8. After Stop disappears, the latest assistant candidate has text and a response-local final Copy toolbar.
9. The candidate's assistant-response boundary identity exactly matches the boundary captured while Stop was visible.
10. No authorization card, blocker, rate limit, or active Stop remains.

Only then may `taskTurnForInspection()` promote the current candidate to task-owned final evidence.

## 5. Response-boundary identity

Add `assistantResponseBoundaryKey(turn)`.

Preferred renderer identifiers, read from the response turn/article and their closest semantic wrappers:

- `data-message-id`
- `data-chatgpt-selection-message-id`
- `data-chatgpt-search-message-ids`
- `data-turn-key`
- `data-content-search-turn-key`
- `data-content-search-unit-key`
- `data-chatgpt-search-unit-key`

The helper returns a compact identifier string only when at least one structural identifier exists. It must not persist response text.

Persist task field:

- `stopObservedAssistantBoundaryKey`

It is updated whenever Stop is observed for the exact generation and cleared with the existing Stop-observation state.

If the renderer provides no structural assistant boundary key, the fallback does not promote final ownership.

## 6. Runtime behavior

### 6.1 Stop visible

For the exact current route/generation:

- obtain the route activity turn even when the marker is virtualized;
- persist `stopObservedGenerationIdentity`;
- persist `stopObservedAssistantBoundaryKey` when available.

### 6.2 Stop disappears

Before the historical Stop-disappearance handoff:

- `taskTurnForInspection()` checks whether the persisted Stop generation identity matches the current dispatch;
- obtains the unscoped latest assistant candidate;
- requires candidate final text + matching assistant boundary key;
- if matched, returns the candidate with `owned:true` and `stopBoundRouteFinal:true`.

The existing `strongOwnedFinal`, `classify()`, final stability window, and `finish()` then operate normally.

### 6.3 Review completion

For `phase:"review"`:

- the stable final response is passed unchanged to `parseReview()`;
- matching `taskId` + `round` remain mandatory;
- `status:"next"` writes `task.next`, increments round, switches to Work, and queues the next Work dispatch;
- `status:"complete"` finishes the task;
- malformed reports still use the existing review-repair path.

## 7. Requirements

- R1: Capture a structural assistant response boundary while Stop is visible.
- R2: Bind it to the existing exact dispatch generation identity.
- R3: Clear it whenever Stop-generation state is cleared.
- R4: Promote a marker-virtualized final reply only when the current structural response boundary matches the Stop-observed one.
- R5: Require exact route and no competing marker/route owner.
- R6: Require final response-local Copy evidence and no Stop.
- R7: Never promote a different/replaced assistant response boundary.
- R8: Never promote when no structural response boundary can be established.
- R9: The normal final-stability window remains unchanged.
- R10: Work final recognition from v2.10.8 remains unchanged.
- R11: Review `status:"next"` must use the final review content to populate the next Work instruction and increment round.
- R12: Review `status:"complete"` must finish normally.
- R13: Abnormal Stop-disappearance recovery remains for unproven route-only endings.
- R14: Existing load-error 30-second × 7 behavior remains unchanged.
- R15: Existing authorization, rate-limit, blocker, attachment, cooldown, and JSON-identity guards remain unchanged.
- R16: Publish only after exact-head Test, merge, canonical-main Test, Release, tag and release-asset verification all succeed.

## 8. Verification

Focused regressions must prove:

1. Review generation begins with marker + Stop and captures a structural assistant boundary.
2. The marker is then removed to simulate ChatGPT virtualization.
3. Stop disappears and response-local Copy/Share appears on the same assistant response boundary.
4. The turn is promoted as owned final, does not queue abnormal fresh recovery, survives the existing final stability window, and reaches `finish()`.
5. A valid review `status:"next"` is parsed and its `next` becomes the following Work instruction with round incremented.
6. A valid review `status:"complete"` finishes the task.
7. Replacing the assistant response with a different response boundary after Stop observation does not promote final ownership.
8. A final toolbar with no captured structural boundary does not get route-only final ownership.
9. v2.10.8 final-toolbar, load-error, inherited-Stop, foreign-task, and authorization regressions remain green.
10. Full `npm test` and syntax check pass in GitHub Actions.

## 9. Acceptance criteria

- AC-1: The live failure mode no longer logs “停止按钮消失接力” when the same Stop-observed response is visibly final and its task marker was merely virtualized.
- AC-2: The final review body is actually passed to `parseReview()`.
- AC-3: A `next` review automatically schedules the next Work round from that review's `next` field.
- AC-4: A `complete` review terminates normally.
- AC-5: Different/stale response toolbars remain fail-closed.
- AC-6: Route equality alone never authorizes completion.
- AC-7: No existing v2.10.8 recovery contract regresses.
- AC-8: Delivery evidence is bound to exact commits/runs and the published v2.10.9 asset.

## 10. Implementation plan

1. Add `assistantResponseBoundaryKey()`.
2. Persist/clear `stopObservedAssistantBoundaryKey` with Stop generation state.
3. Extend `taskTurnForInspection()` with the narrow Stop-bound same-response final fallback.
4. Add review-phase marker-virtualization regressions and stale-response negative coverage.
5. Bump metadata/runtime/README to 2.10.9.
6. Run exact-head CI, merge, canonical-main CI, release and asset readback.
7. Update this compliance table with final evidence.

## 11. Compliance record

| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R15 / AC-1-AC-7 | pending implementation | Live logs + v2.10.8 source audit identify the ownership gap. |
| R16 / AC-8 | pending delivery | Requires exact-head Test, merge, canonical-main Test, Release and asset verification. |
