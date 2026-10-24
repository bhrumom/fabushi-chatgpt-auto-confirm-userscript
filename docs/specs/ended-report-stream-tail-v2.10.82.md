# Ended report full read and bounded confirmation latency — v2.10.82

Status: active
Date: 2026-10-25
Owner: standalone userscript

## Problem / source evidence
The user reports long waits after report rendering on installed v2.10.81. Live logs show background 15-second observation/settlement cadence and repeated waiting states; the reported ended page had already advanced when inspected, so the exact past DOM is unavailable. Source inspection finds a reproducible indefinite gate: latestTurn uses Stop OR aria-busy/data-is-streaming to truncate the reply to its final 6000 characters. A complete long report with stale stream attributes loses taskId/round and cannot parse. The v2.10.81 fast guard also rejects the stale streaming flag before examining the report. Separately, ordinary hidden-tab cadence applies even while a report is being confirmed. These are code-confirmed causes; do not label the past live DOM as proven.

## Requirements / acceptance
- R1: Use bounded tail reads only while the real Stop control is present. After Stop disappears read the full current response, retaining streaming markers as activity diagnostics. Active generation keeps bounded reads.
- R2: A strict complete exact task/round JSON report without Stop may stabilize through the fast guard despite residual stream attributes. Text changes restart the existing four-second timer. Partial/tolerantly recovered reports cannot bypass streaming evidence. Current cards/settlement, drafts, active generation, wrong identity/route/owner, manual user boundary, and unacknowledged continuation fences remain authoritative.
- R3: Pending valid-report confirmation uses at most one-second rechecks through the existing background clock, including hidden tabs. This is limited to a bounded 15-second confirmation window on the exact current route, not a new polling loop or global faster background cadence. Other waits/backoffs remain unchanged.
- R4: A parsed current final report must be checked before unnecessary user-message/activity expansion when the fast guard applies. Maintain normal observation semantics for already authorized sessions; no duplicate settlement, changed goal or lost attachments.
- R5: DOM/fake-clock regressions reproduce reports longer than 6000 characters with stale aria-busy/data-is-streaming; cover both authorization modes, foreign/partial/changing reports, no duplicate advancement, active Stop bounded reads and hidden recheck selection. CI-only full parity/syntax/regression on PR and main; release/install v2.10.82 and record actual live acceptance separately.

## Design / ownership
latestTurn owns response reading and activity diagnostics. settleCurrentReportBeforeFreshHandoff owns only the preexisting narrow unqualified/fresh-dispatch guard and calls finish as the single transition owner. The ordinary qualified path retains its own stale-activity and final observation windows. tick selects an explicit one-second deadline only from a validated current candidate already observed on its own route and only for 15 seconds. No mutation observer, extra scheduler or fresh report authority from saved snapshots.

## Verification / delivery / rollback
PR to exact-head Test to main Test to automatic Release. Match downloaded release digest, install through existing Fabushi source, confirm installed version and new runtime UI. Do not reload or send over live approval/generation for acceptance. Prior release is rollback reference with known defect. Completion record is kept in PR description with passed/blocked/not-applicable against R1–R5, superseding this authoring-time table.

## Compliance at authoring
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R5 | blocked | Implementation and CI pending. |
