# Connection interruption without prior authorization — v2.10.69

Status: completed
Owner: Fabushi userscript
Last updated: 2026-10-22
Related: structural-stop-absence-recovery-v2.10.68.md; optional-authorization-concurrent-recovery-v2.10.67.md

## Context and goal
The user explicitly requires a connection-interrupted conversation with no authorization card ever observed to receive “继续完成所有，按模板回复” in the same conversation. The default-off historical-card switch currently allows such interruptions to hand off immediately. Treat this explicit connection interruption as a bounded exception to that switch.

## Requirements and acceptance
- R1/AC1: An owned current connection-interruption notice without route-matched authorization history arms same-conversation continuation even with the optional switch off. Send the exact prompt “继续完成所有，按模板回复”. Both generic structural recovery and explicit/legacy connection interruption recovery share this behavior.
- R2/AC2: Retain the three-send route-scoped total cap; no fourth send. Durable pending intent survives reload, does not adopt a different route, and carries no fresh history across dispatch reset. A recovered response with valid final evidence uses normal final handling and existing bounded no-card policy.
- R3/AC3: Expand/scan and eight-second confirmation stay authoritative. Pending authorization, settlement, active ordinary generation, pause, ownership, draft and ambiguous-send guards remain. Explicit stale Stop recovery uses the existing bounded Stop action only for a current interruption notice.
- R4/AC4: The optional switch still controls ordinary ended/other abnormal conversations. Workbench text explains the connection-interruption exception without enabling the checkbox. No authorization evidence is invented.
- R5/AC5: Actions-only syntax/bundle/full regressions, exact-head main and release verification, asset digest, installed Chrome version/UI and preserved task state. Distinguish deterministic tests from naturally observed live failures.

## Architecture and state
A canonical-route-scoped connectionInterruptionContinuationURL records an observed owned interruption before shared authorization gating. Shared continuation eligibility accepts this scoped intent or the ordinary checkbox, with the same durable counter and click fencing. The special prompt is recognized by ownership/continuation adapters. Clear dispatch resets the special intent. Legacy pending interruption uses the same explicit intent. Current cards always take precedence.

## Constraints and failure modes
No local build/tests; source concatenation only. Do not mistake quoted/historical notices for a live owned interruption, or replay clicks on one user/response boundary. Do not clear unrelated drafts. Route change makes the special intent ineffective. Rollback reverts source, tests and generated version together.

## Verification plan
Cover switch off/on, connection prompt, repeated inspection/reload dedupe, three-send exhaustion, route/dispatch reset, observed/pending authorization, draft/pause/foreign route, generic and explicit stale-Stop connection paths. Verify all legacy regressions and current running tabs in place.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1 / AC1 | passed | PR #188; structural, explicit stale-Stop and legacy paths tested with switch both off/on. Exact new prompt is sent once in the same route. |
| R2 / AC2 | passed | New route-scoped intent is durable and reset by clearDispatchIntent. Existing shared counter caps at 3, including earlier continuation attempts. Boundary/reload, route reset, third/fourth-send regressions pass. |
| R3 / AC3 | passed | Existing expansion/confirmation retained. Explicit interruption alone can stop a stale Stop once; draft, pause, foreign route, current card, observed authorization and settlement regressions pass. |
| R4 / AC4 | passed | Checkbox default remains off; installed workbench help directly shows the connection-interruption exception. Other no-card recovery retains ordinary checkbox semantics. |
| R5 / AC5 | passed | Exact PR head c07970a557f24cfb2747c7fadc0ed83084449567, Test 39794067084/job 119876916222; main source 65189a2c3b2ffa5c6a777e9c505e5d2fa05c68b0, Test 39794459802/job 119878202954: 553 total, 546 pass, 0 fail, 7 skip, bundle parity/syntax passed; canonical-main run completed/success. Guarded Release 39795974134 published v2.10.69 at the source SHA; asset 666111314 uploaded 2026-10-22T14:28:43Z. Asset digest and downloaded bytes match source/output SHA256 451a9364c03e48c655202e33c4c1d014e8c263f033615083f44aeae53e21a765. Release job 119883226970 logs reached terminal cleanup at 14:28:44Z without errors; its API status projection still reported queued at final readback, so publication is proven by the actual release/asset rather than that stale status. |

## Installed acceptance
Official raw-main SHA256 matches source: 451a9364c03e48c655202e33c4c1d014e8c263f033615083f44aeae53e21a765. Chrome Fabushi installed list shows enabled 2.10.69. Both current task tabs were reloaded in place after checking empty composers and absence of pending authorization; runtime DOM version confirms 2.10.69:
- /c/6ada1c07-3838-83e8-875c-e738f6f7c06e: task 9a70a374-d09f-433b-8a65-6ed70b60a1fc, round 21, generating, continuationCount 1.
- /c/6ada1987-7850-83e8-8cc0-609c6b72730e: task 3dd43a37-9f36-4b7a-adac-dfcc87584523, round 17, waiting, continuationCount 0.
Workbench checkbox unchecked; help explicitly states the connection exception. No new natural connection failure was observed after installation: same-route continuation behavior is deterministic-regression evidence, while actual runtime version, help/default, task identity and supervision were directly observed.

PR: https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/pull/188

Release: https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/tag/v2.10.69
