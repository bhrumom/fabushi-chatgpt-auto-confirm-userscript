# Partial authorization-card periodic same-route refresh — v2.10.28

Status: implementation
Owner: Fabushi ChatGPT auto-confirm
Last updated: 2026-10-02

## Problem

ChatGPT can mount a connector authorization card before that card is fully usable. In the observed production state the task is already bound to the correct conversation, the authorization surface is present, but its controls are still processing/unavailable. The userscript correctly refuses to treat that surface as absent and logs that the authorization card is still present while controls are processing or unavailable.

That safety behavior prevents an incorrect fresh-chat handoff, but it also has a liveness hole: the generic stalled-conversation refresh intentionally excludes any sample with an authorization card, so a partially loaded authorization card can remain forever without a page refresh.

A second incomplete-load shape is possible after the split approval control becomes clickable: the menu opens, but the conversation-scoped grant is not hydrated within the bounded menu scan. The current implementation also waits indefinitely in that case.

Version v2.10.27 is already allocated on canonical main to Chinese connection-interruption recognition, so this change ships as v2.10.28.

## Product requirement

When automatic authorization is enabled for a bound Fabushi task, an authorization card that remains structurally present but cannot yet be completed must periodically reload the **same conversation** instead of waiting forever.

This is a renderer recovery action, not an authorization bypass and not a destructive task handoff.

## Requirements

- R1: Preserve the existing separation between authorization **presence** and **actionability**. A disabled/remounted authorization card still blocks Stop-disappearance and other destructive handoff paths.
- R2: Treat an automatic-authorization attempt as temporarily unavailable when either:
  - the detected authorization card is structurally present but not actionable; or
  - the split approval menu is actionable but no conversation-scoped grant appears during the bounded menu scan.
- R3: Bind unavailable-card recovery state to the exact task identity: canonical conversation URL, task token, phase, and round. A different route or dispatch identity must start a new recovery episode.
- R4: After **60 seconds** of continuous unavailable authorization state, refresh the current exact conversation route. If the authorization card remains unavailable after reload, repeat no more often than once per 60 seconds.
- R5: A periodic authorization refresh must:
  - reload only the current bound conversation;
  - preserve task URL, token, phase, round, target/result/next, attachments, and dispatch identity;
  - never increment or reuse the generic stalled-refresh/fresh-handoff counter;
  - never create a new ChatGPT conversation merely because authorization remains unavailable.
- R6: The existing 12-second conversation-scoped authorization settlement latch has precedence. While settlement is active, no unavailable-card refresh may run even if controls are disabled or the card temporarily disappears.
- R7: A successful click of the conversation-scoped grant clears unavailable-card refresh state before/while entering the settlement latch.
- R8: When the authorization surface disappears outside settlement, automatic authorization is disabled, the task leaves the bound route/identity, or the phase finishes, clear the unavailable-card refresh episode so stale state cannot refresh a later task.
- R9: Manual authorization mode must not introduce periodic page reloads. If auto-authorization is disabled, preserve the current wait-for-user behavior.
- R10: A refresh failure must be non-terminal: keep the task bound, log the failure, and retry only after another 60-second interval.
- R11: Existing safeguards remain unchanged:
  - disabled authorization still counts as presence;
  - ordinary Allow buttons without Reject + split-menu structure remain excluded;
  - only the conversation-scoped grant may be selected automatically;
  - persistent/global grants remain forbidden;
  - Stop disappearance cannot override a visible authorization surface or active settlement latch.
- R12: Preserve the current v2.10.27 Chinese/English connection-interruption recognition already present on canonical main.
- R13: Ship as v2.10.28 only after exact-head GitHub Actions tests pass. No local test/build is used.

## Architecture / implementation plan

1. Add a task-scoped persisted unavailable-authorization episode with identity, first-seen timestamp, last-refresh timestamp, and refresh count.
2. Have `authorize()` mark the episode only for actual automatic-authorization attempts that cannot complete because controls/menu are not ready; clear it on successful conversation-scoped approval.
3. Add a dedicated same-route refresh helper with a 60-second cadence. Do not reuse `refreshStalledConversation()`, because its third no-progress window intentionally escalates to a fresh conversation.
4. In task inspection, after the normal approval classification/automatic authorization attempt, execute the dedicated refresh only if:
   - the same authorization episode is still pending,
   - the current route/identity still matches,
   - settlement is not active, and
   - no blocker/rate-limit/final completion has taken precedence.
5. Clear stale unavailable-authorization state whenever the approval surface is gone outside settlement or task identity is reset.
6. Add focused regressions around disabled-card liveness, repeated cadence, settlement precedence, successful approval cleanup, manual mode, and menu-hydration failure.

## Verification

GitHub Actions only; do not run the suite locally.

Focused regression coverage must prove:

- a disabled/non-actionable authorization card does not refresh before 60 seconds;
- the same card refreshes the same route after 60 seconds and does not queue a fresh session;
- a second refresh is blocked until another full 60 seconds has elapsed;
- repeated authorization refreshes never advance the generic stalled-refresh counter;
- an active settlement latch suppresses the periodic refresh;
- successful conversation-scoped authorization clears unavailable-card recovery state;
- an actionable split menu whose conversation-scoped option never hydrates enters the same unavailable-card recovery episode;
- manual auto-approval-off behavior remains waiting without auto-refresh;
- ordinary non-authorization Allow UI remains unaffected;
- existing Chinese and English connection-interruption regressions remain green.

## Acceptance criteria

- AC-1: Production code has a dedicated identity-bound unavailable-authorization refresh state and 60-second cadence.
- AC-2: A structurally present but non-actionable authorization card can no longer wait indefinitely under automatic authorization.
- AC-3: Reloads remain on the same canonical conversation and preserve task identity/data.
- AC-4: Authorization settlement still has precedence and cannot be interrupted by this recovery.
- AC-5: Persistent/global authorization is never selected.
- AC-6: No unavailable-authorization path can escalate to fresh-chat recovery.
- AC-7: Existing v2.10.27 connection-interruption localization behavior is preserved.
- AC-8: Focused regressions and the full exact-head GitHub Actions test workflow pass.


## Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| Identity-bound 60-second unavailable-authorization recovery | passed | PR #146 final head `30724dbb8f0c2ed70470d6cd76ce6ff63780c6b1` implements the dedicated task/route/token/phase/round recovery episode and same-route refresh cadence; it was squash-merged as canonical main `9c4a6dedee25090b49d82f64e036f181a2df9d2e`. |
| Preserve conversation/task identity and avoid fresh-chat escalation | passed | Focused regression coverage verifies 60-second same-route retries preserve URL/token/phase/round and do not consume `stalledRefreshAttempts`; exact final PR-head Test run `37005037639` succeeded. |
| Settlement and grant safety | passed | Focused regressions verify successful conversation-scoped approval clears unavailable state and the active 12-second settlement latch suppresses refresh; persistent/global grant selection remains excluded by the existing authorization contract. |
| Manual approval behavior | passed | Focused regression verifies `autoApprove=false` never performs periodic approval refresh. |
| v2.10.27 connection-interruption behavior preserved | passed | PR #146 preserved canonical v2.10.27 behavior; final PR-head Test run `37005037639` and canonical-main Test run `37005135261` both passed the full regression suite including existing localized interruption coverage. |
| Delivery | passed | Canonical-main Test run `37005135261` succeeded for `9c4a6dedee25090b49d82f64e036f181a2df9d2e`; Release run `37005205838` succeeded. GitHub Release `v2.10.28` targets that commit and contains `chatgpt-auto-confirm.user.js` (455012 bytes, `sha256:e8a629df152b474a3d152f8e3efb433e709ef11ebf1f5e12ca3bfb21628d1de3`). |
