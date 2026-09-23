# Retained composer cleanup — Specification

Status: active
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-23
Related issue/task/PR: user correction to v2.9.64 send ambiguity behavior

## 1. Context / problem

Userscript v2.9.64 protects an ambiguous attempted send indefinitely when the full prepared prompt remains in ChatGPT's composer. This prevents duplicates, but leaves stale input text visible and changes the established bounded confirmation/recovery policy.

## 2. Goal

At the existing send-confirmation timeout, clear only the exact prepared prompt left by the attempted send, then continue the original bounded ambiguous-send recovery policy.

## 3. Non-goals / out of scope

- Do not clear unrelated user drafts or partially changed composer text.
- Do not change the existing send-confirmation timeout, route adoption, or fresh-retry policy.
- Do not clear prompt text before that existing timeout elapses.

## 4. Requirements

- R1: Keep the original send token, task, phase, round, and attachment state until the existing confirmation timeout.
- R2: At timeout, clear the composer only if its normalized contents exactly match the attempted task's prepared prompt.
- R3: After clearing that exact stale prompt, continue the existing route adoption and ambiguous-send retry rules; do not add indefinite waiting.
- R4: Preserve unrelated or modified composer text.
- R5: Add regressions for exact prompt cleanup + original fallback and unrelated draft preservation.
- R6: Publish userscript v2.9.65 and paired extension v0.6.22 after CI.

## 5. Current state

v2.9.64 checks whether the composer exactly matches `preparedPrompt` after timeout, records a notice, and returns without clearing or continuing the old retry policy.

## 6. Target state

At the same timeout, exact stale task text is cleared through the existing controlled-input helper; the same call then follows original unique-route adoption and retry policy. Any nonmatching draft remains untouched.

## 7. Architecture and ownership boundaries

The task's persisted token/prepared prompt identify the exact content that this dispatch placed in the composer. A match authorizes clearing only that content, never any unrelated composer draft. Conversation marker/unique route remain the send-ownership evidence.

## 8. Interfaces / contracts / schemas / data flow

No schema change. Reuse `composer()`, `normalize()`, and `setInput()`.

## 9. Constraints and non-functional requirements

Keep the original timeout and bounded retry cadence. Do not add polling, DOM observers, or extra timers.

## 10. Failure modes and edge cases

- Exact task prompt remains: clear, then continue established fallback.
- User edited even one normalized character: leave the draft and continue existing safe handling without overwriting it.
- New route/marker is discoverable: adoption takes precedence and original send remains bound.
- No route evidence and exact draft is cleared: existing immediate ambiguous retry occurs at the original timeout.

## 11. Implementation strategy

Add one exact-match clear helper, replace v2.9.64's indefinite return with cleanup and fallthrough, bump versions, add focused tests, sync exact bundle to extension.

## 12. Verification / test strategy

Run focused JSDOM tests proving exact cleanup then retry, nonmatching draft preservation, and existing route adoption; run full userscript suite, syntax/diff checks, extension bundle contract, exact-head CI and main CI.

## 13. Acceptance criteria / Definition of Done

- AC-1: Exact retained prompt is empty after the original timeout, while the task follows existing fallback behavior.
- AC-2: A changed/unrelated draft is never cleared.
- AC-3: The existing route/marker adoption path wins over retry when ownership evidence appears.
- AC-4: Userscript and extension releases bundle v2.9.65/v0.6.22 and all CI passes.

## 14. Release / migration / rollback

No storage migration. Rollback by reverting the fix; keep v2.9.64 available as the preceding release.

## 15. Observability / evidence

Pending tests and release evidence.

## 16. References / provenance

- `docs/specs/send-acknowledgement-and-multi-tab-efficiency-v2.9.64.md`
- `chatgpt-auto-confirm.user.js` `stopAmbiguousSend()` and `setInput()`
- User correction on 2026-09-23: clear the exact lingering composer text at the original timeout, then follow the old waiting/recovery policy.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R6 | pending | |
| AC-1-AC-4 | pending | |
