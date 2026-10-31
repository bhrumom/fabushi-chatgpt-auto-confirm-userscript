# Home page stale user node send recovery — Specification

Status: active
Owner: canonical ChatGPT userscript
Last updated: 2026-10-31
Related issue/task/PR: user report 2026-10-31

## 1. Context / problem
The live Chrome tab is on `chatgpt.com/` with a ready composer and no visible conversation, while the workbench remains at `新会话页面仍保留旧消息`. The pre-send guard uses `conversationRoleNodes('user').length`, which includes stale, hidden, or non-conversation nodes retained in the DOM.

## 2. Goal
Allow the prepared task to dispatch once when the home page has no visible conversation user turn.

## 3. Non-goals / out of scope
No change to ambiguous post-click send confirmation, route ownership, or authorization handling.

## 4. Requirements
- R1: A hidden or non-conversation user-role node must not block a fresh send.
- R2: A visibly rendered user turn in a conversation container must still block a fresh send.
- R3: Preserve the prepared token, prompt, attachments and no-duplicate-send path during waits.

## 5. Current state
The send guard counts every canonical user-role DOM node, including nodes outside a mounted conversation turn.

## 6. Target state
The send guard accepts only a rendered user message inside a conversation turn.

## 7. Architecture and ownership boundaries
Change the canonical userscript pre-send guard; use existing role and rendered-message helpers.

## 8. Interfaces / contracts / schemas / data flow
No persisted schema change. Prepared intent remains durable before clicking Send.

## 9. Constraints and non-functional requirements
Retain the 45-second stalled UI recovery and existing same-tab ownership rules.

## 10. Failure modes and edge cases
Hidden SPA remnants, `aria-hidden` content, suggested prompts styled as user messages, and a genuinely visible old conversation turn.

## 11. Implementation strategy
Add a narrowly scoped fresh-send user-turn predicate and replace the raw node-count check.

## 12. Verification / test strategy
Fixture tests for hidden stale turns, non-conversation user styling, and a visible old turn; build and focused tests.

## 13. Acceptance criteria / Definition of Done
- AC-1: Home page with stale hidden or non-conversation user nodes advances beyond the old-message wait.
- AC-2: Visible old turn retains one prepared intent and makes zero Send clicks.
- AC-3: Generated userscript matches sources.

## 14. Release / migration / rollback
Bump to v2.10.84. Roll back by reinstalling v2.10.83 if needed.

## 15. Observability / evidence
The workbench message must distinguish actual visible old turns from hidden DOM remnants.

## 16. References / provenance
Live Chrome accessibility tree on 2026-10-31; `src/runtime/send-and-navigation.inc.js` send guard; renderer shell specification v2.10.4.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 / AC-1 | passed | The hidden-turn and home-suggestion regression reaches the send-button check without entering the old-message wait. |
| R2 / AC-2 | passed | The visible-old-turn regression keeps the prepared intent and records zero Send clicks. |
| R3 / AC-3 | passed | All 634 tests: 627 passed, 7 skipped, 0 failed; generated-source check passed. |
| Installed Chrome acceptance | blocked | The 2026-10-31 Chrome page still runs the previous installed userscript until the updated release is installed. |
