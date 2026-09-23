# Stop interrupted generation before same-chat continuation — Specification

Status: active
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-23
Related issue/task/PR: user screenshot and report, 2026-09-23

## 1. Context / problem

When a bound ChatGPT conversation shows `连接已中断，正在等待完整回复`, ChatGPT can still expose the Stop control while hiding/disabling Send. `sendContinuation()` currently treats any Stop control as a hard blocker, so the task keeps waiting with no attempt to stop the stuck generation. The user confirms Stop must be pressed first; only after the Stop control disappears does ChatGPT expose Send.

## 2. Goal

For an explicitly detected connection interruption in the exact task-owned conversation, stop the stuck generation, wait for Stop to disappear, then send `继续完成所有` in that same conversation when Send becomes available.

## 3. Non-goals / out of scope

- Do not stop unrelated generations, other conversations, or normal task work.
- Do not navigate, refresh, or create a new conversation for this same-chat continuation.
- Do not change rate-limit, approval, ownership, or manual-draft safeguards.

## 4. Requirements

- R1: Only the explicit interrupted-turn recovery path may authorize clicking Stop.
- R2: Click Stop before writing the continuation prompt when Stop remains visible.
- R3: Persist that Stop was clicked and avoid repeated clicks while the same Stop control remains visible.
- R4: Wait for Stop to disappear before writing/sending the recovery prompt; if it remains, keep durable pending intent and retry later.
- R5: Once Stop disappears, wait for the existing asynchronous Send control and send exactly once in the bound URL.
- R6: Keep cards, blockers, rate limits, unrelated drafts, pause/cancel, and task URL guards intact.

## 5. Current state

`inspect()` routes connection interruptions through `sendContinuation()`. That function returns immediately when Stop is visible, and does not attempt a Stop click.

## 6. Target state

The interrupted path clicks the visible Stop control once, persists the click timestamp, and waits for the same conversation's Stop control to disappear. Only then does it prepare `继续完成所有` and use the existing bounded Send-control wait.

## 7. Architecture and ownership boundaries

`inspect()` owns exact conversation/task-bound interruption detection. `sendContinuation()` receives an explicit permission flag only from that branch; other continuation callers retain the Stop hard block. Existing stable URL/token/phase/round ownership remains unchanged.

## 8. Interfaces / contracts / schemas / data flow

Reuse `pendingContinuationStopClickedAt` as persisted recovery state. Add a call option indicating explicit interrupted-generation recovery; no storage schema migration.

## 9. Constraints and non-functional requirements

Bound each Stop disappearance wait to a few seconds; do not add a tight polling loop. Use existing scheduler retry cadence after timeout. Preserve conservative safeguards.

## 10. Failure modes and edge cases

- Stop click has no effect: timestamp prevents repeated clicking; later supervision retries after the Stop state changes.
- Stop disappears asynchronously: wait, then populate prompt and observe the Send control.
- A non-interrupted continuation sees Stop: keep waiting without clicking it.
- User pauses/cancels during wait: abort before any continuation send.

## 11. Implementation strategy

1. Add a bounded Stop-disappearance waiter.
2. In `sendContinuation()`, authorize one Stop click only when the caller identifies the exact interrupted branch.
3. Thread that authorization from `inspect()`; preserve it through persisted pending continuation state where needed.
4. Add DOM regression tests asserting the order Stop click → Stop disappears → prompt input → Send click, plus non-interrupted guard behavior.
5. Bump script patch version and record spec compliance.

## 12. Verification / test strategy

Run focused workbench tests, full userscript test suite, `node --check`, and `git diff --check`. Publish only after repository CI passes.

## 13. Acceptance criteria / Definition of Done

- AC-1: Screenshot-equivalent interruption with Stop visible sends only after Stop is clicked and disappears.
- AC-2: Stop remains visible: no duplicate Stop clicks and no Send click.
- AC-3: Non-interruption continuation never clicks Stop.
- AC-4: Recovery retains the same task conversation URL and sends `继续完成所有` at most once.

## 14. Release / migration / rollback

Patch release v2.9.66. No migration. Roll back to v2.9.65 if needed.

## 15. Observability

Task log records Stop click, wait state, and subsequent same-chat continuation in order.

## 16. References / provenance

- `docs/specs/interrupted-turn-content-same-chat-continuation.md`
- `chatgpt-auto-confirm.user.js` `inspect()` and `sendContinuation()`
- User screenshot/report: connection interruption needs Stop pressed before Send becomes available.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 | passed | Only `inspect()` passes `stopInterruptedGeneration:true` for a detected exact-task interruption; ordinary continuation remains blocked by Stop. |
| R2-R3 | passed | `sendContinuation()` persists the interrupted recovery state and `pendingContinuationStopClickedAt` before waiting; it activates Stop once. |
| R4 | passed | `waitForStopButtonGone()` polls at 100 ms for up to 3 seconds; the durable pending continuation remains for scheduler retries. |
| R5 | passed | Recovery fills the composer and uses the existing bounded Send-button wait only after Stop disappears. Regressions assert Stop → prompt → Send order and same route. |
| R6 | passed | Existing URL, rate-limit, cards, blocker, draft, pause and cancel guards remain; ordinary continuation test confirms it does not click Stop. |
| AC-1-AC-4 | pending | |
