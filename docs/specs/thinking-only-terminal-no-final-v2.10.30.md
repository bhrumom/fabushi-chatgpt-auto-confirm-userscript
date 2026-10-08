# Thinking-only terminal response and no-final recovery — v2.10.30

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-08
Related issue/task/PR: user screenshots 2026-10-08; PR pending

## 1. Context / problem

A real ChatGPT session may stop with a collapsed `思考了 3m 2s` (thought-duration) row and visible response-local Copy/feedback/share actions, yet show **no user-facing final answer body**. The composer is back and Stop is gone. The user reports that Fabushi stays in “等待响应” rather than recognizing that this generation has ended.

At canonical main `529ebd44c501d5412748ed9037db9456e76af806` (v2.10.29), `latestTurn()` makes normal `final` contingent on nonempty assistant content, correctly preventing an empty assistant from being treated as completed work. However, `inspect()` can also regard a stale renderer loading/busy indicator as active while the finished response action row is already present, excluding the turn from the eight-second ended-without-final recovery. The normal natural-language fallback cannot help because no substantive answer exists.

Screenshots show the visible end state, not the DOM; no claim is made that the precise live selectors were captured.

## 2. Goal

Recognize a current-task, thinking-only/empty-body ChatGPT **ended generation** using a strong, response-local completion toolbar, then enter the existing bounded **ended-without-final** fresh-session recovery instead of waiting indefinitely or falsely marking the task completed.

## 3. Non-goals / out of scope

- Never mark a thinking-only/empty-body Work or Review response as a successful final answer.
- Do not infer success from Stop absence, a timer, a thought-duration label, a page-level Copy/Share control, or an older assistant's toolbar alone.
- No same-chat duplicate continuation and no changes to user authorization, model selection, or the dedicated interruption/rate-limit paths.
- Do not use generic whole-page text to attribute task identity.
- No local build/test execution.

## 4. Requirements

- R1: Detect `terminalEmptyReply` only on the latest assistant response associated with the task: Copy **and** at least one established secondary completion action, Stop absent, and either no substantive reply body or only a narrowly recognized completed thinking-duration summary.
- R2: A response-local Copy with a substantive reply retains the ordinary final pathway and four-second stability; secondary actions must still be optional there.
- R3: The empty-body toolbar is terminal-**generation** evidence, not task-final evidence: `turn.final` and successful Work/Review result parsing remain false.
- R4: Guard with exact route, task ownership or the already-established route-only **abnormal recovery** boundary, no competing owner/foreign marker, idle empty composer, no active Stop/stream, approval or settlement, blocker/rate-limit, retryable error, or ambiguous send.
- R5: The strong empty-response toolbar may override **stale page-wide loading** only within R4's narrow gate; it must not override active Stop, active streaming/busy, loading a genuinely unfinished response, or other safety conditions.
- R6: Preserve the existing eight-second ended-no-final stability/cooldown before queuing a fresh recovery, with no duplicate old-chat Send.
- R7: Older/foreign/composer-level action rows, incomplete toolbar, a newer user turn, or mismatched route must never authorize this fast path.
- R8: When the newest message contains an actual final natural-language answer, existing final classification wins; do not silently replace it with no-final recovery.
- R9: Protect a Reply-only Review without valid report from false completion; it remains subject to the existing Review no-final grace period.
- R10: Publish v2.10.30 only after current-HEAD GitHub Actions tests, canonical-main tests, release workflow, tag and release-asset provenance are verified.

## 5. Current state

`latestTurn()`: Copy + `content` + no Stop/stream => final. No content => no final. `inspect()`: `effectiveLoading` can mask an otherwise settled thinking-only response; without action-bound terminal evidence this state may stay waiting/loading despite an idle composer.

## 6. Target state

Latest task-bound assistant turn → no substantive body + response-local Copy and companion action + no Stop → settled exact-route idle guards → ignore only stale broad loader → existing `abnormalNoFinalEligible` and eight-second timer → fresh task-preserving handoff. A real final answer follows the normal final path.

## 7. Architecture and ownership boundaries

`latestTurn()` alone owns response-local toolbar and answer-body classification. `taskTurnForInspection()` maintains strict ownership; route-only fallback remains **abnormal recovery only**. `inspect()` combines the signal with active-generation/approval/composer/error/loading gates and feeds the existing no-final recovery state machine. No second scheduler or persistent state owner.

## 8. Interfaces / contracts / schemas / data flow

Add the transient internal field `terminalEmptyReply` to the latest assistant turn, and a guarded inspection/sample signal of the same name for diagnostics. No new localStorage fields, schema change, or external API. Reuse existing `abnormalNoFinalSince` / `abnormalNoFinalSignature` for stability and `queueInterruptedFreshRetry()` for recovery.

## 9. Constraints and non-functional requirements

Keep action inspection bounded to the same latest response/control lane and use existing association checks. Preserve read performance during streaming. Never copy invented or empty "finished work" into a Review result. No build/test on Mac or local container; use GitHub Actions only.

## 10. Failure modes and edge cases

- Only `思考了 3m 2s` + Copy/Like/Share and no answer: abnormal-ended, not `done`.
- Same with stale page loading marker: becomes eligible only after settled idle guards.
- Same with stale `aria-busy`: wait for the existing inactivity safety window.
- Real Stop, active new response, pending grant, rate limit, composer draft, or send ambiguity: not eligible.
- Copy from an older reply or global sidebar: no terminal signal.
- A normal final body + Copy: completes as before.
- Only a thought-duration label with no bound final toolbar: no fast path.
- Review without a parseable final report: follow Review's longer settlement gate.

## 11. Implementation strategy

1. Add targeted empty-body/thinking-duration action-bound signal to `latestTurn()`; never turn it into `final`.
2. Combine with settled route, ownership, composer, loading, stream, approval and error boundaries in `inspect()`, with an exception only for stale page-wide loading.
3. Reuse ordinary abnormal-no-final timers and handoff; log that the current response ended without a user-facing answer.
4. Add JSDOM regressions for the screenshot analogue, stale loader, streaming, old/global toolbar, unfinished actions, real answer, foreign route and Review grace.
5. Bump metadata/runtime/README/test version to v2.10.30.

## 12. Verification / test strategy

GitHub Actions `Test` only: `node --check chatgpt-auto-confirm.user.js` and full `npm test` including focused thinking-only terminal fixtures. Validate a stable terminal case triggers exactly one fresh recovery after eight seconds; no false `done`, no old-conversation Send, and no other regression.

## 13. Acceptance criteria / Definition of Done

- AC-1: The user-supplied screenshot scenario is represented by a response-lane DOM fixture and recovered after the normal stability interval, without falsely claiming completion.
- AC-2: Stale loader or stale busy indicator cannot indefinitely hide strongly evidenced empty-answer termination.
- AC-3: Copy-only normal final answers are preserved; older/unrelated toolbars, active Stop/stream, approval, cross-task identity and Review grace fail closed.
- AC-4: Exact-source GitHub Actions Test is green with no skipped required checks; canonical-main and Release evidence match the delivered version.

## 14. Release / migration / rollback

Version `2.10.30`; existing persisted tasks remain compatible. Merge through PR only after exact-HEAD CI. Automatic GitHub Release publishes the userscript; previous main `2.10.29` is the rollback.

## 15. Observability / evidence

Record source SHA, PR, exact-head Test, main Test, Release/tag/asset provenance and any remaining absence of live DOM verification. The screenshot is observation only, not proof of the new code working live.

## 16. References / provenance

- User screenshots taken 2026-10-08 showing `思考了 3m 2s`, response action icons, idle composer and no Stop.
- `chatgpt-auto-confirm.user.js` at `529ebd44c501d5412748ed9037db9456e76af806`: `latestTurn()`, `inspect()`, `classify()`.
- `docs/specs/final-reply-structure-recognition-v2.10.3.md`
- `docs/specs/ended-conversation-continue-v2.9.59.md`
- `docs/specs/final-toolbar-stop-race.md`

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R9 / AC-1-AC-3 | passed | PR #148 implements strongly response-local thinking-only terminal evidence without marking the task complete. GitHub Actions Test run 37728262719 on executable head c7c91bccd0e24fe4197023b8927ee3c7efccf8e4 passed syntax and 350 tests (343 pass, 0 fail, 7 pre-existing skips); final doc-only HEAD requires separate verification. |
| R10 / AC-4 | blocked | Final PR-head Test, main Test, Release, tag and published asset checks pending. |
| Live browser DOM confirmation | blocked | Screenshots supplied; exact authenticated DOM was not captured. |
