# Live approval surface miss and Stop handoff — v2.10.14

Status: implementation
Owner: Fabushi ChatGPT auto-confirm
Last updated: 2026-09-30

## Live evidence

The abandoned Work conversation from the reported 10:12 failure was reopened directly after the failure. It still visibly contains the pending GitHub authorization card while Stop is absent. The current ChatGPT DOM exposes:

- card surface class containing `@container/approval-card`;
- heading/copy: `允许 ChatGPT 使用 GitHub？`;
- actions: `拒绝`, `允许一次`, and a split-menu button with `aria-label="审批选项"`;
- the assistant is still in `正在思考` / tool-work state.

Therefore the failure is not only the v2.10.13 post-click disabled/remount race. A still-pending card can be visible in the live DOM while the bounded role-derived scanner returns no card. Stop presence masks that miss until Stop disappears; the existing destructive branch then treats one cached zero-card scan as proof of abnormal completion.

## Root cause

v2.10.13 still had two independent weaknesses:

1. Authorization discovery was primarily derived from recent user/assistant role scopes plus following-sibling heuristics. The current renderer can mount the connector card in an approval-specific surface that is not reliably covered by those role-derived scopes.
2. Stop-disappearance recovery trusted the earlier cached authorization scan from the same inspection and could hand off immediately on one `pending.length === 0` result.

This makes the bug possible even when the card was never clicked and remains visible.

## Requirements

- R1: Treat ChatGPT's explicit live approval surface (including class containing `approval-card`) as a first-class authorization scope independent of conversation-role recognition.
- R2: Include the latest content-search turn roots directly, even when user/assistant role units are remounting.
- R3: Scan both preceding and following sibling surfaces around the latest response boundary.
- R4: Immediately before any destructive Stop-disappearance handoff, perform a fresh authorization scan from the current DOM rather than trusting the inspection's cached scan.
- R5: At that destructive boundary, use a wide structural fallback over the primary ChatGPT surface. It must still require the stable authorization action cluster: Reject + Allow/Allow once + split-menu.
- R6: If that fresh/wide scan finds a card, retain the exact conversation, enter approval state, and auto-authorize when enabled.
- R7: A single zero-card scan after Stop disappears is never sufficient to open a new conversation. Arm a task/dispatch-bound confirmation window of at least 8 seconds, then re-read the live DOM again.
- R8: If any approval appears during the confirmation window, cancel the handoff.
- R9: Only after the window expires and a final fresh/wide scan still finds no approval may the pre-existing Stop-disappearance fresh-session recovery run.
- R10: v2.10.13 protections remain: disabled approval controls are still pending, and post-click settlement still has its route/token/phase/round-bound latch.
- R11: Ordinary Allow controls without Reject + split-menu structure must not become authorization cards.
- R12: All tests/builds run only in GitHub Actions.

## Verification

GitHub Actions regression coverage must include:

- exact current live-style `@container/approval-card` surface;
- card outside role-derived turn scopes;
- a structural card intentionally outside the bounded normal scopes that is recovered by the critical wide scan;
- Stop visible first, then Stop removed while card remains;
- card removal followed by one zero-card scan: conversation must remain bound;
- only after the 8-second stable no-approval confirmation may the legacy fresh handoff proceed;
- existing disabled/remount settlement tests remain green;
- ordinary Allow controls remain excluded.

## Acceptance criteria

- AC-1: The reported live GitHub card shape is detectable before Stop disappears.
- AC-2: The same card is detectable after Stop disappears.
- AC-3: The reported abandoned conversation state cannot produce a fresh-session handoff.
- AC-4: No single cached or instantaneous zero-card scan can trigger destructive handoff.
- AC-5: Genuine Stop-disappearance/no-final recovery still works after the bounded confirmation window.
- AC-6: PR exact-head Test, canonical-main Test, and automatic Release all succeed for v2.10.14.
