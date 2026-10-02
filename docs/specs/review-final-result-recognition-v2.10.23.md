# Review final result recognition — v2.10.23

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-02

## 1. Problem

Review/acceptance conversations can visibly finish and produce the exact current `MAHAYANA_TASK_REPORT_V1` result while ChatGPT virtualizes the original marker-bearing user turn or remounts the final assistant response under a different renderer structural key. v2.10.22 can then miss `turn.owned`, fail the structural boundary comparison, wait through the Review no-final grace, and open another Review conversation for the same task/round. Repeating that recovery creates the observed infinite acceptance loop.

## 2. Principle

Review final recognition follows the same high-level completion model as Work: first establish that the current dispatch has ended safely, then consume the current final assistant result. Review has additional semantic identity available inside the result itself. A report that parses successfully for the exact current `taskId` and `round` is stronger evidence than renderer-only turn/message keys, which are implementation details that may disappear or change during virtualization/remount.

## 3. Required final evidence

A marker-virtualized/remounted Review result may be promoted only when all of these are true:

1. The live canonical conversation URL equals the task URL.
2. The current dispatch identity (URL + phase + round + token + goal revision) previously observed generation/Stop.
3. Stop is now absent.
4. There is no live authorization card or settlement latch blocking completion.
5. No foreign task marker or other task record owns the exact route.
6. The latest assistant candidate is a natural assistant reply, is not streaming, and contains a report accepted by the existing `parseReview()` / `currentReviewReport()` path.
7. That report's `taskId` and `round` exactly equal the current task identity.

Under those constraints, the exact Review report itself authorizes `final:true` even when `assistantResponseBoundaryKey()` is empty or changed after renderer remount.

## 4. Non-goals and safety

- Route equality alone never authorizes completion.
- Arbitrary natural-language Review prose does not get Work's natural-text fallback.
- A report for another task or another round remains fail-closed.
- A malformed report remains fail-closed and continues through the existing bounded Review settlement/repair path.
- A newer manual user turn or foreign task marker remains a hard ownership conflict.
- Work completion behavior is not relaxed.
- Authorization, rate-limit, blocker, attachment, and send-ambiguity guards remain unchanged.

## 5. Runtime change

`taskTurnForInspection()` keeps the existing Stop-bound structural recovery path, but additionally derives `currentReviewReport(candidate.text, task)` for a non-streaming natural assistant candidate. If it is valid for the exact current task/round, the candidate is promoted as `reviewResultFinal`, `structuredReviewFinal`, `owned:true`, and `final:true`, without requiring the old and new structural response keys to match.

Structural response identity remains useful for ordinary Work and for Review cases whose final UI is recognized through response-local toolbar evidence. It is no longer the sole gate for an exact structured Review result.

## 6. Regression requirements

Focused tests must prove:

1. Exact Review result completes after marker virtualization even when there is no structural response key.
2. Exact Review result completes after the renderer remounts the assistant response under a different structural turn key.
3. Exact Review `status:"next"` advances to Work, increments round, and preserves `next`.
4. Exact Review `status:"complete"` finishes the task.
5. Wrong taskId/round never gains ownership.
6. Non-JSON/malformed Review text without structural ownership remains in the bounded no-final settlement path.
7. Existing same-boundary Copy/toolbar Review and Work final tests remain green.

## 7. Verification and delivery

- No local test/build execution.
- Run syntax/tests only in GitHub Actions or htch-runtime.
- Acceptance evidence must bind to the exact branch/PR HEAD.
- After merge, re-check canonical `main` exact HEAD and its GitHub Actions before considering the fix delivered.
