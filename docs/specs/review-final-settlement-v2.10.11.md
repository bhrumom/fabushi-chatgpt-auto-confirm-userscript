# Review final settlement after Stop disappearance — v2.10.11

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-09-29
Related live incident: authenticated Mac review conversation `https://chatgpt.com/c/6abb3477-f7c0-83e8-a641-293d51092400`
Supersedes: v2.10.9 only for the timing window where Stop disappears before the review's committed final response/toolbar is mounted.

## 1. Context / problem

The live planning/review conversation produced a valid final `MAHAYANA_TASK_REPORT_V1` JSON, but the userscript had already classified the same generation as abnormal and opened another review conversation.

The user-visible log shows the race directly:

- review send confirmed;
- page enters loading;
- a few seconds later the userscript logs `检测到本轮停止按钮已经消失且没有授权卡片`;
- a fresh review session is queued;
- the abandoned original review later contains the valid final JSON.

Work sessions are generally recognized correctly; the repeated-review failure is concentrated in review settlement.

v2.10.9 fixed a different but related failure: after marker virtualization, a final toolbar already present on the same Stop-observed response can be promoted to owned final evidence. The new incident happens earlier: Stop disappearance is acted on before the review response/toolbar has finished settling.

## 2. Live authenticated renderer evidence

Direct DOM/HTML inspection on the affected Mac tab confirmed the final review is a normal current ChatGPT fallback turn:

- outer response turn: `data-content-search-turn-key="fallback-turn-0"`;
- current user unit: `data-content-search-unit-key="fallback-turn-0:0:user"`;
- final assistant unit: `data-content-search-unit-key="fallback-turn-0:2:assistant"`;
- assistant message IDs: `8c1d5b21-919e-4997-9086-f7ed63c59947`;
- final assistant body: `[data-markdown-text-style="assistant-message"]` inside the assistant unit;
- final body is strict JSON with the expected current `taskId="c116ba39-933e-437c-b966-8b04f11155c0"`, `round=2`, and `status="next"`;
- final action row is outside the `:assistant` unit but inside the same outer turn;
- assistant Copy control is `button[aria-label="复制"]`;
- the user Copy control is separately `button[aria-label="复制消息"]`;
- no Stop control is present once the final response is settled.

This structure is already compatible with the canonical fallback-turn parser. The bug is settlement timing, not inability to parse the settled DOM.

## 3. Goal

1. Do not abandon a review generation merely because Stop temporarily disappears before final review settlement.
2. Recognize a complete, exact-identity review JSON as final review evidence even if the Copy toolbar is still hydrating.
3. Preserve v2.10.9's structural same-response ownership guard when the task marker is virtualized.
4. Keep Work Stop-disappearance behavior unchanged.
5. Keep explicit connection errors, stream-recovery timeout, authorization, rate-limit, blocker and load-error recovery unchanged.
6. Prevent infinite review hangs by retaining a bounded no-final fallback.

## 4. Non-goals / out of scope

- Do not treat arbitrary natural-language review text as final without the existing final toolbar.
- Do not accept JSON with a different `taskId` or `round`.
- Do not accept malformed or incomplete JSON.
- Do not make route equality alone sufficient ownership.
- Do not weaken foreign-task/route isolation.
- Do not change Work completion semantics.
- Do not remove bounded abnormal recovery for a truly ended review.

## 5. Requirements

- R1: Add a review-specific no-final settlement grace of 120 seconds.
- R2: Same-document Stop disappearance must not immediately fresh-handoff when `task.phase === "review"`.
- R3: During that grace, visible reply/work-step progress continues to reset the existing abnormal no-final signature timer.
- R4: A review response that parses through the existing `parseReview()` and matches current `task.id` + `task.round` may be treated as committed review-final evidence once Stop is absent and the candidate is not streaming.
- R5: Strict review JSON finality never applies to Work.
- R6: When the task marker is virtualized, the strict review JSON candidate may be promoted only when the current structural assistant response boundary exactly matches the Stop-observed boundary from v2.10.9.
- R7: A different response boundary, foreign task marker, foreign route owner, active Stop, authorization card, blocker or rate limit still fails closed.
- R8: The normal final stability gate remains in place before `finish()`.
- R9: After 120 seconds of unchanged review no-final state, existing abnormal fresh-session recovery may proceed.
- R10: Existing 15-minute generic page-stall, v2.10.8 load-error 30-second × 7, and v2.10.10 work-trace progress logic remain unchanged.
- R11: Runtime, README, tests and metadata are bumped to v2.10.11.
- R12: Delivery requires exact-head Test success before merge/release claims.
- R13: The Node test harness must terminate deterministically after all discovered tests finish. Long-lived userscript timers/listeners may exist by design inside JSDOM fixtures, but they must not turn a fully passing suite into a 10-minute Actions timeout. The harness may use Node's `--test-force-exit` only after the test runner has completed the test set; this must not reduce coverage, skip failures, or shorten per-test execution.

## 6. Target behavior

### Review still settling

Stop was seen for current review generation
→ Stop disappears
→ no valid final yet
→ keep same review conversation
→ keep scanning visible reply/activity progress
→ do not open duplicate review
→ if valid exact-identity JSON appears, classify it as final
→ pass through normal final stability
→ `finish()` → `parseReview()`
→ `next` schedules next Work round or `complete` ends task.

### Review truly ended without final

Stop disappears
→ no valid exact-identity JSON
→ no final toolbar
→ no page progress
→ wait 120 seconds
→ existing abnormal review handoff may run.

## 7. Architecture / ownership boundaries

No new subsystem.

- `latestTurn()`: keeps canonical message and toolbar extraction.
- `assistantResponseBoundaryKey()`: remains the structural response identity.
- `taskTurnForInspection()`: may promote a marker-virtualized strict review JSON only on the same Stop-observed response boundary.
- `parseReview()`: remains the single schema/identity validator.
- `inspect()`: owns review settlement timing and final classification.
- Work Stop-disappearance handling remains unchanged.

## 8. Implementation strategy

1. Add `REVIEW_ENDED_NO_FINAL_STABILITY_MS = 2 * 60 * 1000`.
2. Add a side-effect-free helper that calls `parseReview()` and returns whether the payload exactly matches the current review task/round.
3. Extend the v2.10.9 Stop-bound same-response fallback to accept either an ordinary toolbar-final candidate or a strict valid review JSON candidate.
4. In `inspect()`, compute strict review final evidence for the current owned turn.
5. Treat strict review JSON as `sample.final` while preserving the existing final stability window.
6. Exclude Review from the immediate `stopDisappearedFreshEligible` path.
7. Use 120 seconds instead of 8 seconds for review's abnormal no-final threshold.
8. Add a live-shape fallback-turn regression using `:0:user`, `:2:assistant`, outer action row and Chinese `复制`.
9. Add the Stop-disappearance race regression: review Stop disappears, no final yet, remain in same chat; final JSON later mounts and advances to Work.
10. Add a bounded-expiry regression proving a truly unchanged review still recovers after 120 seconds.

## 9. Verification / test strategy

Focused tests must prove:

1. The exact live fallback-turn shape parses the final review JSON and binds the assistant Copy to the assistant lane, not `复制消息`.
2. Review Stop disappearance with no final does not immediately queue a fresh review.
3. The same state remains in the original review after more than 8 seconds.
4. A later exact-identity valid JSON on the same response is recognized and advances `status:"next"` to the next Work round.
5. The valid JSON path also works when the task marker is virtualized but the Stop-observed assistant boundary still matches.
6. A different response boundary remains rejected.
7. A malformed/wrong-identity JSON remains rejected.
8. After 120 seconds of unchanged no-final review state, bounded abnormal recovery still occurs.
9. Existing Work Stop-disappearance test remains immediate and unchanged.
10. Full userscript syntax and regression suite pass.
11. The full suite exits on its own CI command path after reporting all tests, instead of remaining alive on background handles until the GitHub job timeout.

## 10. Acceptance criteria / Definition of Done

- AC-1: The live failure class no longer opens a duplicate review a few seconds after Stop disappears.
- AC-2: The affected live DOM shape is explicitly represented in regression coverage.
- AC-3: A valid current-task review JSON is eventually passed to `finish()` / `parseReview()`.
- AC-4: Work behavior is unchanged.
- AC-5: Marker virtualization remains same-response fail-closed.
- AC-6: Truly ended review sessions still have bounded recovery.
- AC-7: Exact-head CI succeeds.
- AC-8: The regression command finishes deterministically after the test report; a passing suite is not reported as `cancelled` solely because background JSDOM/userscript handles keep Node alive.

## 11. Release / rollback

No data migration.

Rollback target: v2.10.10. Rolling back reintroduces the review settlement race but does not invalidate persisted tasks.

## 12. Observability / evidence

Record:

- live conversation URL and DOM selectors above;
- exact PR head implementing the fix;
- focused regression names;
- exact-head Test run/result;
- merge/release evidence only after success.

## 13. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R10 / AC-1-AC-6 | implemented, pending CI verification | Runtime now gives Review a two-minute no-final settlement window, excludes Review from immediate same-document Stop-disappearance handoff, accepts only exact-identity `parseReview()` reports as structured review-final evidence, and keeps marker-virtualized promotion bound to the same Stop-observed assistant response boundary. Added live fallback-turn, delayed settlement, marker-virtualized structured report and bounded-expiry regressions; existing Work Stop-disappearance behavior is intentionally unchanged. |
| R11 | implemented, pending CI verification | Userscript metadata/runtime and README are bumped to v2.10.11. |
| R12 / AC-7 | pending | Requires exact-head Test on the final implementation commit. |
| R13 / AC-8 | implemented, pending CI verification | Prior exact-head run 36520312671 printed the complete passing regression tail through the final cache-expiry cases, then remained alive until the 10-minute job timeout because JSDOM/userscript background handles were still open. The test command now uses Node's supported `--test-force-exit` so the process exits only after the runner has finished the discovered test set; no tests are skipped or shortened. |
