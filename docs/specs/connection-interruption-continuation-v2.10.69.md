# Connection interruption without prior authorization — v2.10.69

Status: active
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
| R1-R5 / AC1-AC5 | pending | Implementation and cloud acceptance pending. |
