# Active assistant turns suppress premature page recovery — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-23
Related issue/task/PR: live Chrome report, 2026-09-23

## 1. Context / problem

In the live ChatGPT conversation, the latest assistant turn exposed `aria-busy="true"` and the Stop button, while task supervision reported “页面长时间没有恢复” and repeated route recovery. This message comes from route hydration/ownership recovery, not the separate 15-minute idle watchdog. The route identity-mismatch timeout can fire during active assistant generation. In addition, navigation inspection treats assistant-local busy markers as outside page loading UI, so it can clear the persisted recovery counter while the assistant is still active; after reload this can restart the same recovery cycle.

## 2. Goal

Prevent route or idle recovery from refreshing/navigating away from a conversation while its latest assistant turn is active, preserve route-recovery counters during active work, and restart identity-mismatch grace only after activity clears.

## 3. Non-goals / out of scope

- Do not alter connection-interruption continuation policy.
- Do not treat Stop disappearance alone as final completion.
- Do not remove recovery for an actually idle, owned, non-final conversation.
- Do not change exact-route ownership, final-reply rules, or the 15-minute idle timeout.

## 4. Requirements

- R1: The 15-minute stalled refresh is based on visible page progress, not Stop disappearance; Stop/streaming/busy can remain present while an unchanged page still refreshes after 15 minutes.
- R2: A change to the last eight visible user/assistant messages (new message, changed ID/text, or activity marker) resets the idle timer, even if task ownership is temporarily unavailable.
- R3: Progress fingerprints may reset the timer only; they must not attribute content to a task or authorize completion/continuation.
- R4: Fast route hydration/ownership recovery must not preempt the progress-based 15-minute timer when visible conversation messages exist.
- R5: A genuinely empty route still uses the existing bounded route-loading recovery.
- R6: Active assistant generation must not clear persisted same-route/document recovery attempt counters.
- R7: Add regressions for Stop-visible stale pages, new replies resetting the interval, temporary marker mismatch, and persisted recovery counters.
- R8: Preserve existing ownership, final, interruption, loading, and recovery-budget tests.
- R9: Bump userscript metadata/runtime to 2.9.69.

## 5. Current state

There are two separate paths: `stallEligible` gates the 15-minute no-progress refresh, while `identityMismatchSince` invokes `recoverStalledRoute()` after the shorter route hydration timeout. The latter can preempt the 15-minute page-progress window even when visible replies exist. The no-progress signature can also miss new transcript content when task ownership is temporarily unavailable.

## 6. Target state

The idle refresh timer follows visible transcript-tail changes and does not treat Stop/streaming as a veto. A newly rendered or updated page reply resets the full 15-minute interval; if nothing changes for 15 minutes, refresh is allowed even if Stop remains visible. Fast route hydration recovery is limited to pages with no visible conversation messages, so it cannot beat the page-progress timer. These observations never establish task ownership or final completion.

## 7. Architecture and ownership boundaries

Task-scoped `inspect()` retains ownership as the boundary for interpreting content. A bounded fingerprint of the last eight visible user/assistant message nodes is included only in the stalled-progress signature, so newly rendered page replies reset the idle clock without changing task ownership. Fast route-recovery eligibility checks whether any visible conversation messages exist. Same-route recovery-counter resets consult the active-generation guard.

## 8. Interfaces / contracts / schemas / data flow

No external schema changes. `visibleConversationProgressFingerprint()` contributes message IDs, bounded text tails and activity markers for the latest eight visible message nodes to the progress signature only. Stop/streaming/card/loading flags remain in the signature as observable page changes but do not veto the 15-minute timeout. Quick route recovery checks `visibleConversationHasMessages()` before applying the shorter hydration timeout.

## 9. Constraints and non-functional requirements

- Keep multi-task route isolation and avoid additional DOM polling or expensive scans.
- Preserve normal visible scan cadence and the 15-minute idle recovery interval.
- Active states should not cause repeated reload/navigation attempts.

## 10. Failure modes and edge cases

- Tool execution with unchanged assistant text but Stop visible: wait, do not refresh.
- Busy marker remains after Stop temporarily disappears: wait, do not refresh.
- Approval or effective conversation loader is present: wait, do not refresh.
- Active marker clears: begin a fresh idle progress interval.
- No active marker and genuinely unchanged owned conversation: retain current recovery behavior.

## 11. Implementation strategy

1. Add deterministic tests showing Stop/busy without page changes still refreshes after 15 minutes.
2. Add a regression showing a new visible reply resets that interval.
3. Keep short route recovery limited to empty conversation pages and preserve recovery counters during active generation.
4. Verify idle recovery behavior and existing tests remain intact.
5. Update version metadata/runtime and this compliance record.

## 12. Verification / test strategy

- `node --check chatgpt-auto-confirm.user.js`
- Focused regression in `test/workbench.test.mjs`
- Full `npm test`
- Diff and exact version readback

## 13. Acceptance criteria / Definition of Done

- AC-1: A Stop-visible/busy page with no visible changes is refreshed after 15 minutes.
- AC-2: A newly rendered or updated reply resets the full 15-minute no-progress interval, even if it cannot be attributed to the task.
- AC-3: Visible conversation messages prevent the short route-hydration path from preempting the 15-minute timer.
- AC-4: A genuinely empty route retains existing bounded route recovery.
- AC-5: Progress fingerprints never establish task ownership or final completion.
- AC-6: Full existing test suite passes and both version declarations report 2.9.69.

## 14. Release / migration / rollback

No storage migration. Rollback by reverting the implementation commit. Publish only after the user requests release or the repository's required verified delivery process is authorized.

## 15. Observability / evidence

The task state remains `generating`/`approval`/`loading` through `classify()` and no stalled-refresh log is written while those active signals remain.

## 16. References / provenance

- Live Chrome page `https://chatgpt.com/c/6ab398ea-9260-83e8-a7ae-022b98feecf2`, inspected read-only 2026-09-23.
- `docs/specs/ended-detection-stale-loader-v2.9.60.md`
- `docs/specs/recovered-final-reply-identity.md`

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1–R6 | passed | Stop/busy flags no longer veto the 15-minute refresh; visible transcript-tail changes reset the clock. Visible messages suppress the shorter route path, empty-route recovery remains, and active generation retains persisted counters. |
| R7–R8 | passed | Regressions cover 16-minute unchanged active turns, marker mismatch, counter persistence, new visible replies resetting the clock, and existing ownership/final/interruption/loading guards. |
| R9 | passed | Userscript metadata and runtime report 2.9.69; README current version updated. |
| AC-1–AC-6 | passed | `npm test`: 203 tests, 196 passed, 0 failed, 7 skipped. Regressions prove an unchanged Stop-visible page refreshes at 15 minutes, a new/updated visible reply restarts the full interval, and visible transcripts bypass the short route-recovery path. Syntax and whitespace checks pass. |
