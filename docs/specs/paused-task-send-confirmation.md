# Paused task during send confirmation

Status: implemented; release and installed acceptance pending
Owner: Fabushi ChatGPT userscript
Last updated: 2026-10-31

## Context and goal
An attempted send was visible in ChatGPT, but the current task could not bind its conversation while another task in the same tab was paused. After 90 seconds, the script discarded the original send identity and queued a duplicate in a fresh conversation. Deleting the paused task let recognition proceed.

## Requirements
- PS-R1: A paused, unbound send must not count as a concurrent active send when the new route's latest user turn exactly matches the current task's prepared prompt and the route is not already bound to that paused task.
- PS-R2: If the current task's own marker is visible but a different task still owns the route, preserve the current send identity and report the ownership conflict. Never turn this confirmed visible send into an automatic fresh resend.
- PS-R3: Keep route ownership exclusive. A paused task's bound route is not silently transferred. An unrelated unmarked route with a paused ambiguous sender, or any route with another active ambiguous sender, remains unadoptable and cannot cause a duplicate timeout resend while visible user content leaves ownership unresolved.

## Scope, architecture and data flow
The canonical task identity and route guards remain in `src/runtime/attachments-and-task-identity.inc.js`; timeout recovery remains in `src/runtime/send-and-navigation.inc.js`. This change affects only same-tab send confirmation and does not change authorization, task prompts, or stored task schema. A marker is positive evidence of the attempted user turn; a route conflict remains unresolved until the competing task is removed or another safe route is observed.

## Edge cases and implementation
Filter paused tasks from the active ambiguous-send count only with an exact latest-user/prepared-prompt match. At timeout, if a marker is visible but route capture is refused, or paused send ambiguity remains on a new route with visible user content, keep `attempted`, token, phase, round and attachments, and continue polling. Do not clear a user's unrelated composer draft. Preserve the existing retry for a truly unmarked, unowned timeout.

## Verification and acceptance
- PS-AC1: A paused unbound task does not prevent safe adoption of the current task's unique new route.
- PS-AC2: A marked current turn on a paused task's bound route is not resent at timeout; removing the competing task then permits recognition of the original send.
- PS-AC3: An unrelated unmarked route with a paused sender remains unadoptable and does not trigger a duplicate resend; focused tests, full test suite, generated bundle check and syntax check pass.

## Release, rollback and evidence
Build the generated userscript from modular source. Release and Chrome installation require exact revision validation; rollback is the prior released userscript. Live Chrome behavior is recorded separately from local regression evidence.

## Provenance
User report and screenshot of the 2026-10-31 send at 10:54 showing a visible ChatGPT turn, followed by repeated “unbound send” recovery; deleting the paused same-tab task allowed recognition. Existing send-confirmation and workspace specs remain applicable.

## Compliance
| Item | Status | Evidence |
| --- | --- | --- |
| PS-R1 / PS-AC1 | passed | Exact latest-user prompt match allows adoption despite a paused unbound attempt; focused regression passed. |
| PS-R2 / PS-AC2 | passed | Marked send retains token, attachments, phase and round through timeout and binds after the paused owner is deleted; focused regression passed. |
| PS-R3 / PS-AC3 | passed for local behavior | Unrelated visible user remains unadoptable without a duplicate resend; focused regression passed. Final full suite: 632 tests, 625 passed, 0 failed, 7 skipped. Generated bundle, syntax and diff checks passed. |
| Release and installed Chrome acceptance | blocked | No exact-head CI result, merge, release or installed Chrome verification yet. |
