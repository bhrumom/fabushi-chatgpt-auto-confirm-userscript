# Authorization card without conversation-scoped option falls back to primary Allow — v2.10.51

Status: implementation
Owner: Fabushi ChatGPT auto-confirm
Last updated: 2026-10-16

## Problem

Some ChatGPT authorization cards do not expose a separate “允许本次会话 / allow for this conversation” option. The existing userscript recognizes the card but waits for a split-menu arrow and then remains blocked when the conversation-scoped option is absent. In the observed product state, the card's primary 允许 / Allow action is the intended completion path.

## Goal

When a structurally trusted authorization card has no conversation-scoped authorization option, click the card's primary exact 允许 / Allow action directly. Preserve all existing card recognition, ownership, pause, settlement, and false-positive safeguards.

## Requirements

- R1: Keep cards() as the single authorization-presence authority.
- R2: A structurally trusted authorization card with an enabled exact primary 允许 / 批准 / Allow / Approve action and no split-menu control is actionable through that primary action.
- R3: When a split-menu control exists, first try the existing conversation-scoped option. If it is unavailable after the bounded menu observation, an enabled exact primary 允许 / 批准 / Allow / Approve action may be clicked as the explicit fallback.
- R4: Do not broaden direct fallback to arbitrary buttons or descriptive text. Exact primary-action matching remains required.
- R5: Existing conversation-scoped authorization remains preferred whenever present.
- R6: Existing permanent/global-option rejection remains unchanged when a conversation-scoped option is available.
- R7: Direct primary fallback starts the existing task-scoped authorization settlement protection and does not duplicate Send, open a fresh conversation, or clear task identity.
- R8: Paused/cancelled tasks and disabled controls remain non-actionable.
- R9: Transcript content, isolated ordinary Allow controls, and unrelated UI remain excluded.
- R10: All tests/builds run only in GitHub Actions.

## Acceptance

- AC1: Explicit authorization card containing only primary 允许 is detected as actionable and the primary button is clicked once.
- AC2: Explicit authorization card containing only primary Allow is detected as actionable and the primary button is clicked once.
- AC3: A split-menu card still selects the conversation-scoped option first.
- AC4: A split-menu card with no conversation-scoped option falls back once to the exact primary Allow, without clicking a permanent menu item.
- AC5: Isolated ordinary Allow and transcript Allow remain excluded.
- AC6: Exact-head GitHub Actions Test and generated-userscript check pass before integration.

## Delivery

Bump userscript/runtime to v2.10.51. Merge through the normal PR path and let canonical-main Test trigger the guarded Release workflow. The release must contain the exact generated chatgpt-auto-confirm.user.js from the tested canonical main.