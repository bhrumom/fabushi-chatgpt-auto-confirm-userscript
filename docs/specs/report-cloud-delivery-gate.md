# Final report cloud delivery gate

Status: active
Owner: standalone userscript
Date: 2026-11-03
Supersedes: github-delivery-prompt-only-v2.10.77.md R3/R4/R7; latest-report-handoff-v2.10.81.md unconditional settlement

## Context and goal
The user supplied a live report with empty commit URL/SHA and verified=false. An earlier authorization card must not qualify that report for settlement or fresh-chat handoff. When delivery evidence is missing, send exactly “继续完成所有，并把工作成果提交到云端” in the same conversation.

## Requirements and acceptance
- R1: Both next and complete, in goal and once modes, require githubDelivery.verified === true, a full 40-character hexadecimal SHA, and an HTTPS github.com OWNER/REPO/commit/SHA URL matching it. This checks the report claim, not independently authenticated GitHub delivery. Missing/false/malformed evidence cannot advance the round, discard the current route, or finish the task. Old persisted delivery flags remain inert.
- R2: Missing evidence triggers the exact requested continuation regardless of historical authorization or the authorization-handoff switch. Reuse existing continuation boundary, acknowledgment, cooldown and ownership fences; no three-attempt authorization cap can waive delivery evidence. A new response without evidence may receive a new continuation; the same response cannot be resent across reloads.
- R3: Current cards/settlement, generation, paused tasks, foreign ownership, nonempty drafts, rate limits and blockers prevent sending. Do not navigate or alter the task/round while requesting delivery. Stale goal revisions retain existing handling.
- R4: Valid evidence preserves existing next/complete settlement behavior. Preserve prompt delivery instructions. Explain report evidence separately from observing authorization in UI/logs.
- R5: Add DOM regressions for missing/false/mismatched/valid evidence, switch on/off, prior authorization, repeated inspection, same-chat exact prompt and safety guards. Run parity, syntax and full regressions in Actions.

## Architecture / plan
Keep report parsing tolerant for recognizing reports; add a separate delivery predicate at finish and a live inspection branch before recovery. Derive eligibility from the current exact task/round report rather than legacy persisted delivery flags. Reuse continueWithoutAuthorization with a delivery-repair option, the existing persisted send boundary and continuation recognition. Revalidate the report and boundary after asynchronous send preparation. No direct GitHub calls from the browser and no new scheduler.

## Failure modes / scope
A report is evidence supplied by the model, not proof of remote existence. Malformed JSON recovery cannot synthesize delivery proof. Invalid report identities retain existing handling. Missing evidence remains in the same chat until a new report or an actual separate recovery condition. No changes to migration work itself, credentials, approval policy, or unrelated once-task semantics.

## Delivery and rollback
Bump to 2.10.91 and generate the bundle; submit source and regressions for Actions validation. Browser installation/live acceptance must be stated separately. Rollback reverts this change and restores prompt-only behavior.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R4 | passed | Report gate and exact-message DOM regressions passed in Actions 41564096404 (including cards, settlement, prior authorization, both switch states and persisted send boundaries). |
| R5 | passed | Actions 41564386118 at 6b3a6aa: bundle parity, syntax and full 730-test suite passed (723 passed, 7 existing skips, 0 failures). Earlier fixture/version failures corrected. Final PR-head validation and delivery evidence are tracked in PR #209. |

## Live action evidence
The requested exact continuation was sent once through Chrome UI in the original conversation on 2026-11-03; the user message and active response were visible. This manual action is not acceptance of automatic runtime behavior. Installed version was 2.10.90 at inspection; newer installation is tracked separately in PR #209.

## Markdown commit link correction — 2026-11-03
The live report supplied a valid SHA and verified=true but wrapped commitUrl as [URL](URL). v2.10.91 rejected that representation and incorrectly requested submission again.

R6: Normalize surrounding whitespace, a single complete Markdown link (using its destination), and autolink angle brackets before existing HTTPS GitHub/SHA validation. Do not accept embedded prose, foreign destinations, partial SHAs, or Markdown labels concealing a destination with a different SHA. Valid wrapped evidence must follow normal next/complete settlement and never trigger the cloud reminder. Add the exact screenshot SHA fixture, both statuses, and invalid-destination tests. Release 2.10.92 after Actions parity/syntax/full regressions; installation remains separate.

| Requirement | Status | Evidence |
| --- | --- | --- |
| R6 | blocked | Implementation and exact-head Actions pending. |
