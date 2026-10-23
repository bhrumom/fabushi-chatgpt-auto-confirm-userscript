# Editable prompt composition and GitHub delivery — v2.10.76

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-23
Related: work-final-report-direct-dispatch-v2.10.53.md; active-task-composer-cleanup-v2.10.74.md

## Requirements and acceptance
- R1/AC1: An explicit workbench prompt-composition entry displays ordered task, attachment/context/carry, execution rules, user additions, mandatory GitHub delivery and report/identity sections, with exact complete prompt preview. Distinguish the already prepared immutable send from the next send preview.
- R2/AC2: Users can edit execution rules and add/edit/enable/disable/reorder/delete additional prompt sections. Save workspace-scoped configuration durably with bounded inputs, restore defaults, preserve reload/other-workspace isolation. Changes affect only newly prepared sends, not an ambiguous/in-flight prepared prompt. UI uses textContent/value rather than HTML interpolation.
- R3/AC3: Each newly prepared task prompt requires actual permitted work results committed and pushed to GitHub, then remote readback before any final next/complete report. Read-only work may publish permitted audit evidence, never modify prohibited production files or invent commits. Include task/round-bound githubDelivery {commitUrl,sha,verified} in final JSON. Fixed protocol and delivery requirements remain visible and mandatory.
- R4/AC4: A delivery-required final report missing valid GitHub evidence must not finish, increment round or open a report-repair/new session. Preserve its original route/task/round and request commit/readback in the same conversation through guarded normal editor/Send. Exact task identity, full commit URL/SHA agreement and verified=true are required. The script validates the model-authored evidence contract, not authenticated GitHub repository truth; do not claim otherwise.
- R5/AC5: Pending cards/settlement, pause/ownership/active generation and persisted send fencing remain authoritative. Delivery reminders are bounded and cannot replay one user/response boundary after reload. At the bound limit retain pending state and visible explanation. When evidence arrives normal final next/complete handling resumes. Legacy already-sent prompts retain their old contract; new sends snapshot mandatory delivery and current prompt configuration.
- R6/AC6: Actions-only parity/syntax/full regression verification. Verify UI configuration and persistence in installed runtime without sending test tasks or committing arbitrary downstream work. Publish/install exact tested release and record live evidence vs deterministic contract evidence.

## Architecture / plan
Add a normalized workspace prompt configuration with default execution rules and ordered additions, and one canonical workPromptSections composer feeding both sender and UI preview. Snapshot configuration/delivery contract when preparing a new dispatch. Reuse current task report parser plus a GitHub delivery predicate; intercept only otherwise valid missing-evidence reports before finish mutates state. Add a same-route pending-delivery sender with its own count/boundary, no permission bypass, and a task/round marker. Reject malformed identity through existing parsing. Preserve report evidence and active send intents in durable task snapshots. No GitHub credentials in the page or new automatic authorization grants.

## Verification
Prompt parts/order and preview parity; configuration edit/add/remove/reorder/default/isolation/roundtrip; prepared prompt immutability; URL/SHA malformed/foreign task/false verified rejection; both next and complete blocked without evidence; original route/round retained; same-boundary retry/reload dedupe and retry cap; valid evidence resumes; card/Stop/pause/foreign route protection; legacy report compatibility.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R6 / AC1-AC6 | pending | Implementation, cloud and installed acceptance pending. |
