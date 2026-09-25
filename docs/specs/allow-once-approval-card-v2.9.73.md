# ChatGPT “Allow once” authorization card compatibility — Specification

Status: completed
Owner: Fabushi userscript
Last updated: 2026-09-25
Related issue/task/PR: User-reported live ChatGPT authorization-card regression

## 1. Context / problem

ChatGPT changed the primary action in connector authorization cards from a strict “允许” / “Allow” label to “允许一次” / “Allow once”. The current userscript first locates an exact Allow button and only then validates the surrounding Reject + Allow + split-menu structure. Because “允许一次” does not match that entry label, the card is never returned by `cards()`, so the userscript does not open the adjacent approval-options arrow or select the conversation-scoped grant.

Live Chrome inspection on 2026-09-25 confirmed the current card shape: a primary `button` whose visible label is `允许一次`, an adjacent `button[aria-haspopup="menu"][aria-label="审批选项"]`, and—after opening—the existing Radix `div[role="menu"] > div[role="menuitem"]` option `Allow GitHub for this conversation`.

## 2. Goal

Recognize the new one-time primary approval label while preserving the structural and scope-safety checks, then continue using the existing split-menu flow to select only the conversation-scoped permission.

## 3. Non-goals / out of scope

- Do not click the primary one-time action directly.
- Do not approve permanent, all-chat, all-conversation, or future-session grants.
- Do not identify authorization cards from their descriptive body copy or connector name.
- Do not change task scheduling, conversation ownership, popup dismissal, or final-response semantics.

## 4. Requirements

- R1: Treat exact localized one-time approval labels such as `允许一次` and `Allow once` as valid primary approval actions.
- R2: Continue requiring an enabled Reject action and an enabled split-menu arrow in the same bounded ancestor before recognizing a card.
- R3: Open the split-menu arrow and select only an item accepted by `isConversationScopedAllow()`.
- R4: Continue rejecting permanent/global grants and ordinary standalone Allow/Allow-once controls.
- R5: Generic popup dismissal must recognize the new card as approval-like and must not close it.

## 5. Current state

`allowLabel` accepts only exact `允许`, `allow`, `approve`, or `批准`. The live primary label `允许一次` therefore prevents `cards()` from reaching the existing structural validation. Arrow discovery and the English connector-named conversation menu-item matcher already support the observed live DOM.

## 6. Target state

`cards()` accepts the narrow one-time label variants, validates the unchanged three-control structure, and hands the card to the existing authorization flow. The flow opens `审批选项` and selects `Allow GitHub for this conversation`, never the primary `允许一次` item.

## 7. Architecture and ownership boundaries

The standalone userscript remains solely responsible for DOM recognition and clicks on ChatGPT authorization cards. No extension-host, backend, connector, or storage contract changes.

## 8. Interfaces / contracts / schemas / data flow

No external schema change. Internal flow remains `cards()` → `authorize()` → `activateControl(arrow)` → scoped menu-item lookup → `activateControl(option)`.

## 9. Constraints and non-functional requirements

- Recognition must remain structural and fail closed.
- Exact action-label matching must avoid substring matches against unrelated prose.
- Existing Chinese and English authorization variants must remain supported.

## 10. Failure modes and edge cases

- A standalone `允许一次` button without Reject and a menu arrow is not a card.
- A Reject + `允许一次` pair without a split-menu arrow is not a card.
- A menu containing only `允许一次` or a permanent option remains unresolved and is not approved.
- An authorization card inside a modal is excluded from generic popup dismissal.

## 11. Implementation strategy

Extend the exact primary-approval label matcher with narrow Chinese and English one-time variants. Add a live-shape regression fixture using a form/card wrapper, `允许一次`, `aria-label="审批选项"`, a Radix-style `div[role="menu"]`, and the connector-named conversation option. Preserve all downstream logic.

## 12. Verification / test strategy

- Run the complete Node test suite.
- Assert the live-shape fixture is detected.
- Assert authorization opens the arrow and clicks the conversation-scoped item, not the primary one-time item.
- Assert standalone one-time controls remain excluded.
- Assert popup dismissal leaves a modal-hosted one-time authorization card connected.

## 13. Acceptance criteria / Definition of Done

- AC-1: A live-shape `允许一次` authorization card is returned by `cards()`.
- AC-2: `authorize()` opens `审批选项` and clicks `Allow GitHub for this conversation`.
- AC-3: Permanent and non-conversation menu items remain rejected.
- AC-4: Ordinary `允许一次` controls are not treated as authorization cards.
- AC-5: The full regression suite passes.

## 14. Release / migration / rollback

Ship as userscript v2.9.73. No migration is required. Roll back by reverting the label matcher, tests, documentation, and version bump.

## 15. Observability / evidence

Task logs continue to report opening the authorization menu, selecting the conversation-scoped grant, successful card dismissal, or failure to find a scoped item.

## 16. References / provenance

- Live ChatGPT Chrome page supplied by the user and inspected on 2026-09-25.
- `README.md` authorization behavior documentation.
- Existing authorization regressions in `test/workbench.test.mjs`.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 | passed | `allowLabel` accepts exact Chinese and English one-time variants; `actionText()` removes only `aria-hidden="true"` shortcut content before matching. |
| R2 | passed | `cards()` still requires enabled Reject and split-menu arrow controls in the same bounded ancestor. The ordinary-control regression remains excluded. |
| R3 | passed | The live-shape regression records one arrow `pointerdown`, one conversation-grant click, and zero primary-button clicks. |
| R4 | passed | Existing permanent-grant rejection passes; the expanded ordinary-control fixture includes standalone and Reject-paired `允许一次` buttons without a menu arrow and returns zero cards. |
| R5 | passed | The modal regression now uses `允许一次` with an `aria-hidden` shortcut and confirms generic popup dismissal leaves the authorization card connected. |
| AC-1 | passed | `current allow-once split authorization card is detected and selects only the conversation grant` asserts one detected card. |
| AC-2 | passed | The same regression creates the observed Radix `div[role=menuitem]` and confirms the connector-named conversation item is selected. |
| AC-3 | passed | `connector-named conversation grant is accepted but permanent grants are rejected` passes. |
| AC-4 | passed | `ordinary allow controls are not mistaken for authorization cards` passes with both `允许` and `允许一次` variants. |
| AC-5 | passed | `node --check chatgpt-auto-confirm.user.js`, `git diff --check`, and the full `npm test` run pass: 208 tests, 201 passed, 7 explicitly skipped, 0 failed. |
