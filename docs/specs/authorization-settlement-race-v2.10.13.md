# Authorization settlement race — v2.10.13

Status: implementation
Owner: Fabushi ChatGPT auto-confirm
Last updated: 2026-09-30

## Problem

Live ChatGPT connector authorization can transiently disable or remount the visible approval card after the script clicks the conversation-scoped grant. During that asynchronous settlement window the Stop control may already be absent. v2.10.12 treated disabled approval controls as if the authorization card no longer existed, so a single scan could satisfy the Stop-disappearance fresh-session handoff guard and abandon the still-pending conversation.

The observed failure sequence is:

1. The card is correctly detected.
2. The split approval menu is opened.
3. “Allow … for this conversation” is clicked.
4. ChatGPT disables/remounts the card while the connector grant is settling.
5. Stop is absent.
6. The card scanner returns zero because controls are disabled or briefly absent.
7. The task logs “停止按钮已经消失且没有授权卡片” and opens a fresh chat.

## Requirements

- R1: Authorization surface presence must be independent from control actionability. Reject + Allow + split-menu structure still counts as a pending card when any/all controls are disabled.
- R2: authorize() may click only an actionable card. Disabled/remounted cards remain in approval/waiting state and are never treated as absent.
- R3: Clicking the conversation-scoped grant starts a task-scoped, route/phase/round/token-bound settlement latch for 12 seconds.
- R4: While that latch is active, transient absence of the card cannot trigger Stop-disappearance fresh-session recovery, ended-without-final recovery, retryable-error recovery, conversation-load recovery, or composer-clearing abnormal-end logic.
- R5: A disabled primary button is not authorization-success evidence. Success is never inferred from disabled state.
- R6: The latch must clear when the dispatch identity is cleared or a real final reply finishes the phase.
- R7: After the latch expires, normal Stop-disappearance recovery resumes if no approval surface, final reply, blocker, rate limit, or active generation exists.
- R8: Generic popup dismissal must continue to preserve disabled authorization dialogs because structural authorization presence remains detectable.
- R9: Ordinary Allow buttons without Reject + split-menu structure remain excluded.
- R10: Ship as v2.10.13 only after exact-head GitHub Actions Test passes, then canonical-main Test passes and the automatic Release workflow publishes v2.10.13.

## Verification

GitHub Actions only; no local test/build is used.

Regression coverage must include:

- a visible authorization card whose Allow/Reject/menu controls become disabled while Stop disappears;
- a post-click transient DOM gap where the authorization card is absent for a scan;
- preservation of the exact conversation during both states;
- normal fresh-session recovery after the bounded settlement latch expires;
- the existing real-shape “允许一次” split-button flow still selecting only the conversation-scoped grant;
- ordinary Allow controls remaining excluded.

## Acceptance criteria

- AC-1: Disabled authorization card is returned by cards() with actionable=false.
- AC-2: Stop disappearance while that card is visible never clears the current URL/token or queues a fresh chat.
- AC-3: Selecting the conversation grant starts a persisted settlement latch.
- AC-4: A zero-card scan inside that latch never produces the “停止按钮已经消失且没有授权卡片” handoff.
- AC-5: After latch expiry, the existing recovery policy resumes.
- AC-6: Exact-head Test, protected/canonical main Test, and Release v2.10.13 all succeed.
