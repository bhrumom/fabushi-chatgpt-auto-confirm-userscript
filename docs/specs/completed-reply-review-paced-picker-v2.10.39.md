# Completed reply handoff and paced model picker — v2.10.39

Status: active
Owner: Fabushi ChatGPT auto-confirm userscript
Last updated: 2026-10-09
Related: user screenshot of completed Work reply with no Review, rapid picker toggles

## 1. Context / problem
The current inspection checks conversation-length notices before normal completed-response stability. A stale page-chrome notice can therefore hand off an already committed Work answer as an interrupted Work, preventing the expected next Review. The nested model/reasoning picker retries multiple clicks separated by 90–120ms, allowing a just-opened strength view to be toggled closed before React settles.

## 2. Goal
Preserve exact owned, stable final-answer-to-Review transitions; preserve legitimate length-limit continuation when the actual current response contains a limit notice. Open/recover model and reasoning surfaces using one paced trigger interaction at a time.

## 3. Non-goals
No new inference from arbitrary page text, no duplicate Sends, no bypass of identity, approvals or length-limit guards, no UI redesign.

## 4. Requirements
- R1: A strong final from the exact current task/route with a committed response-local Copy and nonempty substantive answer can settle through ordinary stability even when a stale page-chrome length notice remains.
- R2: A genuine length-limit notice inside the current response still triggers continuation and never falsely completes it.
- R3: Final precedence must honor active Stop, streaming, approval, rate limit, blocker and ambiguous-send guards and preserve the ordinary four-second final-stability window.
- R4: The Work final transitions to queued Review preserving full reply; other phases keep their existing contract.
- R5: Remove rapid consecutive trigger toggles for model/reasoning. A single interaction followed by a minimum quiet interval precedes any later trigger interaction, including recovery, menu close and slider reacquisition.
- R6: Keep radio aria-checked confirmation, slider aria-valuenow confirmation, Chat-before-model-before-reasoning ordering and fail-closed behavior.
- R7: Regression tests cover stale chrome versus in-response limit notices, stable Work-to-Review, and minimum click separation; all tests only in GitHub Actions.

## 5. Current state
Length notices are handled above classify() in inspect(). reopenModelPicker and ensureTaskReasoningPreset directly call trigger.click() repeatedly after 90–120ms.

## 6. Target state
An owned committed final with an unrelated stale chrome limit notice proceeds to normal stability; a current assistant response limit notice retains the handoff path. A shared paced trigger adapter serializes toggle attempts without rapid retries.

## 7. Architecture and ownership
Only canonical userscript owns DOM interpretation, task state and model interactions. Never read unrelated task transcripts or reuse stale turn controls.

## 8. Data flow
No persistence migration. Local transient last picker click time regulates each click. Final response remains bound by existing task marker, canonical conversation URL, Copy toolbar and prior observation.

## 9. Constraints
No local builds/tests. Preserve user workspace, attachments, send identity and parallel task fairness. Do not weaken authorization safeguards.

## 10. Failure modes
Missing current response ownership -> retain guarded recovery. Current response length notice -> continuation. Pending Stop/cards -> wait. Missing picker/slider -> fail closed, defer and retry without burst clicks.

## 11. Implementation strategy
Narrowly gate stale chrome notice under strong owned final and pass existing stability. Add paced model-trigger helper and route all model/reasoning trigger clicks through it. Add dedicated tests.

## 12. Verification
GitHub Actions exact PR HEAD syntax + node tests; check main and release only after required gates.

## 13. Acceptance
- AC1: Stable committed Work with stale chrome limit notice moves into queued Review.
- AC2: Genuine current assistant length-limit continues same Work phase.
- AC3: Model/reasoning trigger interactions are spaced and verify selected state.
- AC4: CI passes and source publication is traceable.

## 14. Release/rollback
Version 2.10.39 on successful integration; rollback by reverting PR. No task schema changes.

## 15. Observability
Record PR head, Actions run, version, and live browser follow-up (not yet claimed).

## 16. References
Existing final-reply-structure-recognition-v2.10.3.md, current-response-length-handoff-v2.9.71.md, transient-model-reasoning-picker-v2.10.33.md and user screenshot 2026-10-09.

## 17. Compliance
| AC | Status | Evidence |
| --- | --- | --- |
| AC1 | passed | Simulated stale page-chrome length notice + committed latest Work Copy action stays on current task until the four-second final stability gate, then queues Review with the exact response; PR #159 Test run 37925433012 succeeded, head 4592d43640d68032cad707a2b0564504e0b0ac6d. |
| AC2 | passed | Existing current-response length-limit + toolbar regression remains passing; genuine current-response notice continues same Work phase rather than falsely completing. |
| AC3 | passed | Explicit two-reopen regression exercises at least three trigger clicks and verifies >=600ms separation (implementation minimum 650ms); nested menu model, slider and fail-closed tests remain passing. |
| AC4 | blocked | PR exact-HEAD Test 37925433012: 385 total, 378 pass, 0 fail, 7 skipped; canonical-main Test, automatic Release and published asset validation still pending. Browser live acceptance not asserted. |
