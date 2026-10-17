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
Implementation PR [#174](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/pull/174) merged as `a04a927c10dcf7ece10ac4141a1acc473a9ef235`. PR exact source `ce0532526a9b0c5f20982d3b43d7fc82da681f3f` passed [Test 39007501263](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/39007501263); canonical main passed [Test 39007614472](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/39007614472). Both ran `npm run build:check`, `node --check chatgpt-auto-confirm.user.js`, and `npm test` on ubuntu-latest / Node 24, all exit 0: 441 total, 434 passed, 7 existing skips, 0 failed. No local generator, build, test or acceptance was run.

| Requirement / criterion | Status | Evidence / reason |
| --- | --- | --- |
| LA-R1 / LA-AC1 | passed | Persisted manual approval test verifies wait explanation, header/sidebar text, locate action, and immediate sidebar update after changing the task checkbox. Both automatic modes retain automatic wording. |
| LA-R2 | passed | Locate rechecks local ownership, approval state, exact route, competing owner/marker and live card. Missing/foreign/paused/competing cases pass. |
| LA-R3 / LA-AC2 | passed | Owning aria-controls disclosure and closed details are revealed; unrelated disclosure and grant/deny controls are not activated. No card returns failure and UI retains manual-expansion guidance. No text-only disclosure guessing. |
| LA-R4 | passed | Locate regression preserves serialized dispatch/attachments and autoApprove=false. Existing bounded recovery, settlement, no-duplicate and final-reply suite passes unchanged. |
| LA-R5 / LA-AC3 | passed | Exact PR/main checks above; version/runtime parity verified by Actions. Release and installation observations below are separate from live acceptance. |
| LA-AC4 release and installation | passed | Versioned tag, source blob, asset digest and installed enabled version verified below. |
| LA-AC4 allowed-runtime live acceptance | blocked | Device discovery reports htch-runtime offline. No authenticated allowed browser was available for live acceptance. Existing local task pages were not reloaded or used to exercise the new behavior. |
| Stable raw download availability | blocked | Direct raw.githubusercontent.com download returned curl exit 35, connection reset. API blob equality and release integrity do not prove raw endpoint availability. |
| Automatic release configuration | blocked / not-configured | Release run 39007696218 failed. CLI publication is a delivery fallback, not proof of configured RELEASE_TOKEN. |

Release [v2.10.57](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/tag/v2.10.57) tag and target resolve to `a04a927c10dcf7ece10ac4141a1acc473a9ef235`. Asset `chatgpt-auto-confirm.user.js`: 529518 bytes, Git blob `5244433fb3e6c541108b71396e7a0f9186169501`, SHA-256 `a178b6a900c1019c55405f4a6dc88a117d19c5390d5ea8b4e9aeb9946f8c8e6c`; GitHub asset digest equals the uploaded tested file. The CLI created this immutable release only after canonical-main Test succeeded.

Read-only Chrome installation observation after importing that file into the existing Fabushi script manager: one ChatGPT auto-confirm entry, `2.10.57 chatgpt-auto-confirm 已启用`, with successful installation message. The temporary management tab was closed and the original task tab restored. The original tab was already at a later conversation with a Stop control, so no active response was interrupted. Import confirms installation, not the loaded revision of existing pages; already-loaded runtimes activate the update on their next normal document load.

Local investigation before implementation expanded Previous activity and exposed a real GitHub Allow once card. No grant was clicked and neither automation checkbox was changed. Implementation/Actions/release/installation are delivered; allowed-runtime end-to-end acceptance remains blocked as recorded.
