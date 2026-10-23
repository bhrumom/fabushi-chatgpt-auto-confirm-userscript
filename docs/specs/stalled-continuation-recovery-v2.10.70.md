# Stalled continuation recovery — v2.10.70

Status: completed (integrated acceptance in v2.10.73)
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

- R6/AC6: The user cannot find the handoff switch. Place a single “授权卡片接力” control with explicit 开启 and 关闭 buttons in a dedicated always-visible row directly below the workbench header, outside the composer and collapsed settings. Do not depend on checkbox appearance: the supplied screenshot shows its text without an operable-looking box. Show 已开启/已关闭 immediately, preserve workspace persistence/default-off and connection-interruption exception, and visually verify in both original workspaces.

## Architecture and plan
Share the exact current continuation boundary computation between sending and acknowledgment-timeout detection. The structural observer admits backed recovery drafts, confirms a stopped owned response, and delegates to the same continuation sender. A deduped aged boundary takes a guarded carried handoff rather than clicking Send again. The pending gate path returns only after real progress or active protection; otherwise the rest of inspection remains reachable. After stopped/card confirmation, clear only the proven script recovery draft before the shared sender/handoff, allowing normal editor events to restore usable Send UI. No scheduler watchdog is added without evidence of a scheduler failure.

## Constraints / failure modes
No local build/tests; source concatenation allowed. Keep normal final reports, live Stop, authorization, settlement, user drafts and foreign routes fail-closed. Snapshot overflow is durable recovery state and must survive upgrade. Rollback reverts source/bundle/tests/version together.

## Verification
Reproduce both observed structures with shared fallback renderer, generic contenteditable composer, pending flag, old persisted boundary and long elapsed send time. Cover old/new user boundaries, retained recovery vs unrelated drafts, blank response with/without aged intent, authorization appearance, Stop/settlement, reload dedupe, original task and phase/round/carry retention.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R6 / AC1-AC6 | passed | Final integrated source c514eb32; PR #192; main Actions 39884321266: parity/syntax and 570 tests (563 pass, 0 fail, 7 skip); Release 39884547997, asset 667629960, SHA256 dbf633d002616241c6cc6dcfca337a188c343d647e7b623b8ee9ef4d296dbf88. See installed/live evidence below. |

## Final installed acceptance — 2026-10-23
- First original task `9a70a374-d09f-433b-8a65-6ed70b60a1fc`, work round 21, progressed from `/c/6ada32d8-71d0-83e8-ac43-834af61e1510` to `/c/6adab914-beb0-83e8-a084-c248b9854cbe`; root runtime reads 2.10.73. Native page shows Stop and new web-search activity. Original task identity/round preserved.
- Second original task `3dd43a37-9f36-4b7a-adac-dfcc87584523`, work round 17, progressed from `/c/6ada1987-7850-83e8-8cc0-609c6b72730e` to `/c/6adab4db-6614-83e8-b213-90498f607495`; observed Stop, new pairing/database audit work, later same-chat continuation and real response at 09:37. Its active document remains runtime 2.10.71; it was not reloaded during generation. Installed extension is enabled 2.10.73.
- Explicit header-level 开启/关闭 controls confirmed in both workspaces. First control tested ON then OFF with immediate aria/state readback; second explicitly set OFF. No manual Send/Retry, permission click, task-state edit, or synthetic failure was used to claim recovery. Existing automation continued normally.
- Earlier 2.10.70/71 did not recover the first task: renderer alias and inherited Stop hydration gaps were discovered live and closed by combined 2.10.72/73. 2.10.72 was not separately installed. Cloud regressions verify no old-boundary send replay; live acceptance verifies real task progression, not completion of downstream migration work.
