# Retry generic ChatGPT network errors — v2.9.89

Status: active  
Owner: Fabushi ChatGPT Auto-confirm userscript  
Last updated: 2026-09-27  
Related issue/task/PR: user report, overnight network-error page

## 1. Context / problem

ChatGPT can leave a task's latest assistant turn in an application-level error state such as “A network error occurred. Please check your connection and try again.” with a visible Retry button. This is neither a completed reply with a response toolbar nor one of the narrowly recognized “message send timed out/failed” notices. On long chats the original task marker is also virtualized: route-ended supervision already has a safe latest visible turn for status checks, but the retry detector was passed the marker-scoped unowned turn with no response article. The task therefore remained in supervision without a completion or retry transition.

## 2. Goal

Treat a stable ended/erroring bound conversation as an abnormal end and queue the task into a fresh ChatGPT conversation, carrying forward safe visible work when available.

## 3. Non-goals / out of scope

- Do not treat generic network-error text alone as a final answer or as grounds to retry.
- Do not retry quoted/discussed error text, stale earlier errors, or workbench log content.
- Do not change the established continuation, retry/backoff, task-ownership, or same-tab recovery policy.

## 4. Requirements

- R1: Match common English and Chinese network/connection error notices in the current assistant response or existing page-level error scope.
- R2: Assistant-response error matches must also have a nearby visible Retry/重试 control and must be scoped to the current task response.
- R3: A newer final reply, active Stop/streaming state, authorization card, page loading, rate limit, blocker, or ambiguous route must prevent abnormal-end recovery.
- R4: When the exact task route is uniquely owned, the assistant has no final toolbar, Stop/streaming and approvals are absent, and the composer is empty, start an eight-second stable observation; then queue a fresh conversation while preserving task phase, round, goal and attachments.
- R5: If composer text blocks the exact-route idle check, clear it only after all other safe-idle and unique-ownership conditions hold, log the cleanup without recording its content, and restart the stability interval. Never clear text on a foreign/ambiguous route or during active generation/approval.
- R6: A newer final reply must prevent an older network error from triggering a retry, and the network-error notice itself must not be carried as useful work.

## 5. Current state

`sendTimeoutNotice()` recognizes message send failures but omits the visible English “network error occurred” wording shown in the user report. Additionally, the inspection path passes it the unowned marker-scoped turn after marker virtualization instead of `activityTurn`, even though exact-route route-ended supervision has already established the visible turn boundary. The general no-final path waited on a nonempty composer and, when eligible, sent another continuation into the same failed chat. Final-reply classification correctly rejects the error card because it has no response completion toolbar.

## 6. Target state

The latest task response is checked through the exact-route activity turn if the original task marker is virtualized. A stable no-final, no-Stop, no-approval state with an empty composer queues the task into a fresh chat. A draft is cleared only after the same strict idle/ownership checks pass, then the full stability interval starts over. A retryable error card supplies diagnostic context but does not itself bypass the stable-idle guard.

## 7. Architecture and ownership boundaries

The userscript owns DOM classification and task continuation. ChatGPT owns its localized error text and Retry control. Existing exact-route/task-turn ownership remains authoritative; the existing fresh-session retry path records the old route and carries only safely scoped visible work.

## 8. Interfaces / contracts / schemas / data flow

No persisted schema or external interface changes. The existing `sendTimeoutNotice()` signal contributes to abnormal-state evidence; the existing `queueInterruptedFreshRetry()` transition archives the old route and schedules the task for a fresh dispatch.

## 9. Constraints and non-functional requirements

- Keep scanning bounded to current response text and nearby controls.
- Require actionable control context for assistant error cards to avoid false positives.

## 10. Failure modes and edge cases

- Missing Retry control: do not auto-retry based on text alone.
- Quoted or historical error: do not override the current response.
- Current final response after an earlier error: do not retry the old error.

## 11. Implementation strategy

Extend the retryable-message-error matcher with common network/connection failure wording; retain current response scoping and retry-control requirements. For exact-route route-ended recovery, pass the already selected latest visible `activityTurn` to the detector. Clear a blocking composer draft only after safe idle/ownership checks, reset the stability timer, and route stable no-final states through `queueInterruptedFreshRetry()` rather than continuing inside the failed conversation. Add matcher, draft-cleanup and full-inspection regressions.

## 12. Verification / test strategy

Run focused network-error tests, the complete `npm test` suite, `node --check`, and `git diff --check`.

## 13. Acceptance criteria / Definition of Done

- AC-1: The reported English network error with visible Retry is recognized on the latest exact-route response after task-marker virtualization.
- AC-2: Stable abnormal ends queue a fresh conversation after the eight-second guard; normal activity, missing Stop clearance, approvals, ambiguous routes and visible final replies do not.
- AC-3: A composer draft is cleared only after strict idle ownership checks and starts a new eight-second observation window.
- AC-4: Error notices are excluded from carried work; unrelated work text remains eligible for safe carry.
- AC-5: Full test, syntax, and diff checks pass.

## 14. Release / migration / rollback

No migration. Release as v2.9.89 only after exact-HEAD checks pass. Roll back by reverting this matcher and its regression coverage.

## 15. Observability / evidence

Record local and remote validation below. The screenshot proves the visible error copy and Retry control, but does not establish browser runtime behavior after a code change.

## 16. References / provenance

- `AGENTS.md`
- `docs/specs/loading-failure-recovery-and-scan-cost.md`
- User screenshot/report dated 2026-09-27.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R2 / AC-1 | passed locally | `send timeout recovery recognizes...` covers the reported English copy, Chinese network failure, visible Retry, missing Retry rejection, quoted-content rejection, and workbench-log rejection. Inspection uses `activityTurn` when the marker is virtualized. |
| R3-R4 / AC-2 | passed locally | `marker-virtualized exact-route waiting task queues a fresh session...`, `waiting response queues a fresh session...`, `manual recovered marker-virtualized tool-only...`, and the final-toolbar/active-generation regressions pass. These checks guard the eight-second stable idle, exact-route ownership, approval/Stop/loading, and final-reply boundaries. |
| R5 / AC-3 | passed locally | `route-owned abnormal-end detection clears a blocking composer draft...` and `resumed ended conversation clears a recovery composer draft...` confirm draft cleanup only on the safe exact-route idle path, with the stability interval restarted; a newer foreign user turn remains rejected. |
| R6 / AC-4 | passed locally | `inspect opens a fresh session after a stable virtualized-task network error` verifies the error text itself is not carried; existing visible-work carry tests remain green. |
| AC-5 | passed locally | `npm test`: 229 tests, 222 passed, 7 skipped, 0 failed; `node --check chatgpt-auto-confirm.user.js` and `git diff --check` pass. Exact-HEAD GitHub Actions, published release, and live Chrome retest remain pending. |
