# Manual continuation final-report adoption

Status: active
Owner: standalone Fabushi userscript
Date: 2026-11-02

## Problem and goal
On the original /c/6ae7f55e-b63c-83e8-a133-b14b2a8374db task, an operator sent “继续完成所有” using native Chrome input without a scripted continuation counter. The original marked task remains mounted, so latestTurn(task) rejects the newer manual boundary and inspection waits even after the exact task/round final report appears. Restore final-report settlement without treating arbitrary manual conversation as task-owned.

## Requirements / acceptance
- R1/AC1: On the task's exact unique route, a mounted own marker followed exclusively by one or more recognized exact continuation prompts may admit the latest complete current-task/current-round Work JSON report with zero recorded continuation sends. The assistant must follow the latest user. Reject a different intervening user message, foreign marker, wrong identity/round, malformed/truncated report, stale prior report, other route/owner/workspace, paused/terminal/unsent task or active Stop/streaming.
- R2/AC2: This is a final-report-only adapter in taskTurnForInspection. Do not increment continuation counters, manufacture authorization history, submit another continuation, adopt partial work or loosen latestTurn ownership. Existing current authorization, settlement, rate-limit, draft, stability and pause guards still determine settlement. Reload must rederive evidence without replaying a send.
- R3/AC3: A current status=next report follows the existing configured task mode: continuous goals advance with next, single tasks retain next and finish that single run. Changing once-task semantics is outside this repair. Provide behavioral evidence for both modes and no duplicate sends.
- R4/AC4: Validate bundle parity, syntax and full regressions in Actions, then integrate/release/update through the publication workflow already authorized in this chat. Verify installation separately from real incident acceptance; do not interrupt active approvals or generation.

## Architecture / implementation
Before taskTurnForInspection's mounted-marker rejection, a narrow helper validates route/tab ownership, the complete user-message chain after the marker, current ended response and completeWorkFinalReport identity. Return an owned structured final candidate only; use normal report stability and finish. No storage migration or scheduler change. Preserve existing markerless recovery and recorded-continuation paths.

## Verification and failure modes
Reproduce marked initial prompt → manual continuation → complete JSON without persisted continuationCount. Test both task modes, reload and repeated inspection. Negative cases cover intervening manual prompt, foreign marker/owner/route/workspace, wrong identity/round, invalid/partial JSON, stale report before latest continuation, Stop, streaming, pending card, pause and changed user boundary. Never use URL alone as message ownership. Test current report ID against task.id, not IDs quoted in earlier messages.

## Release / rollback / provenance
Increment to v2.10.86, keep source and bundle identical, use PR and protected Actions before release. Rollback reverts helper, call site, bundle and version. Related: final-reply-after-markerless-continuation.md, latest-report-handoff-v2.10.81.md and response-error-extra-high-v2.10.85.md. Latest explicit request is to repair manual continuation following the authorized v2.10.85 publication.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R4 | pending | Implementation and verification pending. |

## Live correction — v2.10.87
The original Chrome document after v2.10.86 installation still waited. Read-only debugging proved the exact task/round report is complete, the route/workspace is correct, continuationCount is zero, and no Stop/card/settlement is present. The actual user adapter returns an extra standalone H4 with data-conversation-role=user and class sr-only before each user content unit. Its text is “你说：你”; it is presentation metadata rather than a user message. Exclude only these standalone hidden role headings from the manual-continuation chain, leaving latestTurn ownership and all real user messages strict. Add the exact heading-plus-content structure to the positive test, and verify a visible intervening user message still rejects adoption. Preserve all prior R1–R4 criteria and rerun Actions before release/update.
