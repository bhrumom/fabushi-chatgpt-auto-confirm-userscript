# Stalled continuation recovery — v2.10.70

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-23
Related: connection-interruption-continuation-v2.10.69.md; structural-stop-absence-recovery-v2.10.68.md

## Context and observed failures
Both installed 2.10.69 task tabs stalled after same-chat continuation. The first has a mounted continuation user bubble, “消息传输超时。请重试。” and a script-owned continuation draft. The second has a blank ended response and an aged persisted click boundary equal to the current user/response boundary. Its full task exists in session overflow, while the compact localStorage snapshot omits it; preserve overflow and task identity during upgrade.

## Requirements / acceptance
- R1/AC1: A pending continuation must not unconditionally return when its send helper makes no progress. Continue normal error/ended inspection. Ordinary generation, pending cards/settlement, pause, ownership and unrelated drafts remain protected.
- R2/AC2: Only a recognized recovery prompt backed by current route-scoped pending/sent continuation intent may pass the structural observer's draft guard. Preserve all unrelated drafts. Expand activity and rescan cards before no-Stop recovery.
- R3/AC3: An owned latest continuation with no response and an aged send intent is actionable after the normal eight-second stable no-Stop window and at least the existing send-confirmation timeout. A blank initial hydration shell is not such evidence.
- R4/AC4: Never replay a persisted click on the same boundary. If it remains unacknowledged beyond the timeout, or a confirmed response error leaves a backed recovery draft but no usable Send control beyond that timeout, use a carried successor handoff with reason continuation-ack-timeout after a fresh no-card/settlement check. This bounded ambiguity escape may bypass only historical-card gating, not current permission requests. Normal successful continuation counts remain capped at three.
- R5/AC5: Recognize localized “消息传输超时” as the existing send-timeout class; no known phrase is required for blank-response acknowledgment timeout. Validate in Actions only: bundle parity, syntax, complete regressions, exact-head source/release digest. Update both original tabs, preserve session-overflow tasks and prove progress without duplicate dispatch.

## Architecture and plan
Share the exact current continuation boundary computation between sending and acknowledgment-timeout detection. The structural observer admits backed recovery drafts, confirms a stopped owned response, and delegates to the same continuation sender. A deduped aged boundary takes a guarded carried handoff rather than clicking Send again. The pending gate path returns only after real progress or active protection; otherwise the rest of inspection remains reachable. Clear only the proven script recovery draft when taking that handoff. No scheduler watchdog is added without evidence of a scheduler failure.

## Constraints / failure modes
No local build/tests; source concatenation allowed. Keep normal final reports, live Stop, authorization, settlement, user drafts and foreign routes fail-closed. Snapshot overflow is durable recovery state and must survive upgrade. Rollback reverts source/bundle/tests/version together.

## Verification
Reproduce both observed structures with shared fallback renderer, generic contenteditable composer, pending flag, old persisted boundary and long elapsed send time. Cover old/new user boundaries, retained recovery vs unrelated drafts, blank response with/without aged intent, authorization appearance, Stop/settlement, reload dedupe, original task and phase/round/carry retention.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R5 / AC1-AC5 | pending | Implementation and cloud/live acceptance pending. |
