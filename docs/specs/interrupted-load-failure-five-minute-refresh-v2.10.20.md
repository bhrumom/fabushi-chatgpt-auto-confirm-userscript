# Interrupted/load-failure active refresh and five-minute stall policy — v2.10.20

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-01

## 1. Problem

Two current ChatGPT failure surfaces can otherwise leave a task parked in a waiting state:

- `Connection interrupted. Waiting for the complete answer` while the bound conversation still exposes Stop/generation state.
- `Could not load this ChatGPT conversation` with `Try again` rendered as ordinary text rather than a semantic button.

The generic unchanged-page refresh interval is also still 15 minutes, which is longer than the requested recovery window.

## 2. Required behavior

1. Recognize both the existing localized interruption wording and the current English `Connection interrupted. Waiting for the complete answer` wording.
2. If interruption remains visible while Stop is still present, preserve the exact bound conversation and task identity, but refresh that route after 5 minutes with no visible progress.
3. Continued interruption may refresh again after another 5-minute no-progress window; this dedicated interruption recovery must not become a permanent wait merely because the generic stalled-window counter reached its normal fresh-handoff threshold.
4. Recognize `Could not load this ChatGPT conversation` as a route-level conversation-load failure.
5. The load-failure detector must work when `Try again` is inert text, provided the exact load-failure sentence is in the main ChatGPT surface and no conversation messages are mounted.
6. Preserve the existing explicit load-failure cadence: first observation starts a 30-second timer, then same-route refreshes at least 30 seconds apart, up to 7 refreshes before the existing fresh-session handoff.
7. Change generic no-visible-progress refresh from 15 minutes to 5 minutes. Visible transcript/activity changes restart the timer.
8. Never duplicate the task send as part of these refreshes. Existing task/phase/round/token/attachments/recovery context remain durable.

## 3. Regression coverage

- English interruption wording is recognized.
- English `Could not load this ChatGPT conversation` is recognized even when `Try again` is not a button.
- Generic stall refresh does not run before 5 minutes and may run at 5 minutes.
- Active Stop/busy does not exempt an otherwise unchanged bound page from the 5-minute generic refresh.
- Interrupted Stop state refreshes after 5 quiet minutes and preserves its interruption intent.
- Existing 30-second x 7 load-failure recovery remains covered.
- Packaged metadata/runtime version and 5-minute constants are asserted.

## 4. Delivery

- GitHub Actions `Test` on exact PR head must pass (`node --check` + full `npm test`).
- Merge only after exact-head Test succeeds.
- Canonical-main Test must pass on the merge SHA.
- The `Release` workflow, triggered by successful canonical-main Test, must publish `v2.10.20` and attach `chatgpt-auto-confirm.user.js`.

## 5. Compliance record

| Requirement | Status | Evidence |
| --- | --- | --- |
| Runtime + regressions | pending | Await exact-head GitHub Actions Test. |
| Merge/main/release | pending | Await delivery pipeline. |
