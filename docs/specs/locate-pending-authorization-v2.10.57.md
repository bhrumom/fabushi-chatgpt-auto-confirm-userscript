# Locate pending authorization — v2.10.57

Status: active
Owner: standalone userscript workbench and authorization adapter
Date: 2026-10-17

## Context and goal
Chrome conversation 6ad2f884-d244-83e8-839e-86e9043c643a remained at approval from 12:44 while scans continued. Read-only UI investigation found a real GitHub permission card hidden under Previous activity; both automatic approval checkboxes were off. Expanding Previous activity exposed Reject / Allow once. This is a manual approval wait, not proof of a hung runner or permission to approve the underlying unrelated repository write. Current v2.10.56 only says waiting for approval and provides no way to locate the card from the workbench.

## Scope and requirements
- LA-R1: Approval status distinguishes manual approval (both automatic modes off) from automatic processing. The notice explains that Previous activity may contain the card, and that manual approval waits without a timeout. Persisted approval tasks receive this explanation immediately after installation without requiring a state transition.
- LA-R2: Show a Locate authorization card action only for the selected local task in approval state. On invocation recheck task ownership, exact canonical route, competing route ownership and live card presence. Never navigate or send a prompt.
- LA-R3: Locate opens only closed ancestor details or a collapsed disclosure whose aria-controls explicitly identifies a container of the detected card. Scroll that card into view and close the overlay on success. Never activate Allow, Reject, menus, unrelated disclosures or arbitrary text matches. If unavailable, retain the panel and show recovery guidance; missing card is not approval success.
- LA-R4: Preserve automatic authorization settings, settlement, bounded refresh policy, task URL/token/phase/round/attempted/attachments and existing final-reply handling. No automatic permission grant or auto-mode enablement is added.
- LA-R5: Publish additive v2.10.57 after exact PR and canonical-main Actions generated parity, syntax and full regression pass. Install the tested bytes into the existing script entry. Local investigation/installation are separate from allowed-runtime acceptance.

## Architecture, interfaces and strategy
Keep cards() as presence authority. Add locatePendingAuthorization(task) to reply-and-approval; return boolean, with no task mutation. Workbench owns taskStatusText/taskRecoveryStatusText and a guarded locate button. UI uses the same status formatter in sidebar/header. No schema, dependencies, scheduler or external account change. Edit matching source/bundle text; do not run local generators. Regression cases cover manual/automatic labels, persisted approval explanation, owned disclosure reveal, missing/foreign/paused cards, no permission click, and unchanged dispatch identity.

## Failure modes, constraints and non-goals
A virtualized card without a provable disclosure relationship requires manual expansion; show guidance rather than guessing. Multiple task ownership fails closed. Existing authorization settlement may outlive a DOM gap and must retain its protection. This change does not implement the repository-writing task displayed inside the third-party approval card, change Chrome memory recovery, or bypass manual permissions. All executable checks run only in GitHub Actions or htch-runtime; htch-runtime currently reports offline.

## Verification and acceptance
- LA-AC1: Regression proves correct manual/automatic status, persisted waiting guidance and sidebar/header presentation.
- LA-AC2: Locate reveals the card via its owning disclosure, never grants/denies or changes the dispatch, and rejects missing, paused, foreign or competing ownership.
- LA-AC3: Exact PR/main Actions pass with run SHA, commands, counts and exit codes recorded. Existing skips remain skips.
- LA-AC4: Release/tag/asset digest and installed version match tested source. Authenticated live acceptance on an allowed runtime is passed only with actual evidence; otherwise blocked.

## Release, rollback and observability
No destructive migration. Use normal PR merge, tested main release, then import into existing script manager. Roll back with a reviewed revert and higher version. Approval status and actionable notice expose the wait reason without credentials or card payload. Record per-requirement evidence here before final handoff.

## References
User screenshot and read-only Chrome AX observation 2026-10-17; canonical main e6d70da709a670a19e98aab3ec98a1a27c630c7a; bounded-authorization-recovery-v2.10.55.md; authorization-primary-allow-fallback-v2.10.51.md.

## Compliance
Pending exact-head verification and delivery; no completion claimed.
