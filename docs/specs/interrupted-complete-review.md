# Complete Review report takes priority over connection interruption
Status: active
Owner: Fabushi userscript
Last updated: 2026-10-12

## Problem and goal
A current Review response can contain the entire task report while ChatGPT shows a connection-interrupted banner and stale Stop. Existing interruption handling runs before structured-final classification and incorrectly fresh-handoffs Review.
## Scope and requirements
R1: On the exact bound route, before interruption recovery, read current assistant semantic content using the existing owned transcript extractor. A missing marker is allowed only with no competing task/route owner and semantic taskId+round identity.
R2: Require a fully closed JSON object parsed by JSON.parse, followed by existing parseReview schema/identity validation; never use tolerant field recovery to prove completeness. Reject truncated JSON, foreign task/round, missing next and contradictory newer user turns.
R3: A valid interrupted Review report must be identical across two scans at least 1500ms apart. Stop/spinner/streaming product flags cannot veto this semantic completion. Any actual text change resets the stability window.
R4: Approval, blockers, rate limit, attempted dispatch, paused/terminal task and old goal revision remain protected. Process complete/next via existing finish(), preserving Work result and next scheduling.
R5: No duplicate Send or recovery/new-chat during the stability window. Incomplete/malformed report retains existing interruption recovery. Work natural text is outside this change.
## Architecture and contract
The report remains taskId, integer round, complete|next status, nonempty summary, and nonempty next when status=next. Strict closed-object extraction is distinct from tolerant post-final parsing. Read rendered assistant text only, excluding hidden/user/tool output.
## Failure modes
Changed text restarts the wait. Wrong identity cannot complete. Stale goal revision uses existing finish() invalidation behavior. A network banner alone proves no result.
## Verification and acceptance
AC1: complete report plus Stop/interruption finishes Review.
AC2: next report plus Stop/interruption schedules Work with next and increments round once.
AC3: truncation, malformed/foreign report, newer user, approval never completes.
AC4: real installed live behavior is recorded separately from fixture tests.
## Delivery and rollback
Paired change shares delivery with navigation-commit-fallback. Revert Review override to restore original interruption priority.
## Provenance
2026-10-12 user screenshot and explicit instruction; canonical parseReview and visibleAssistantWorkTranscript.
## Compliance
Pending verification.

## Verification record
Passed: deterministic source generation and syntax checks; userscript full suite 419 total, 412 pass, 7 skipped, 0 failures. Host listener suite 15 pass, 0 failures. Review complete/next and rejection cases; same-document one-shot and post-grant pause/round/draft checks passed.
Blocked: installed original conversation acceptance pending live installation/site availability; tests do not prove service/network recovery.

| Requirement / AC | Final status | Evidence |
| --- | --- | --- |
| R1 | passed | Existing transcript extractor and newer-user fixture. |
| R2 | passed | Strict closed JSON scanner; truncated/foreign report fixtures remain Review. |
| R3 | passed | Two stable scans complete; changed report resets window despite Stop. |
| R4 | passed | Existing finish() transition; complete, next and approval fixtures. |
| R5 | passed | Complete report holds without fresh dispatch; original interruption regressions pass. |
| AC1 | passed | complete fixture ends task with Stop and interruption banner. |
| AC2 | passed | next fixture increments round once and schedules Work. |
| AC3 | passed | Truncated/foreign/newer-user/approval negative fixtures. |
| AC4 | blocked | Native UI confirms 2.10.48 installed/enabled; current exact incident progress could not be reliably observed during concurrent user navigation. |
