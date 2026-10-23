# Continuation boundary alias compatibility — v2.10.72

Status: completed (integrated acceptance in v2.10.73)
Owner: Fabushi userscript
Last updated: 2026-10-23
Related: stalled-continuation-recovery-v2.10.70.md; unacknowledged-initial-boundary-v2.10.71.md

## Observed remaining issue
The original 9a70a374 task retains an expired pending click boundary whose user key is id:7a7eedff-d2fd-437f-a202-0a60142681bd|fallback-turn-0 and response is turn:fallback-turn-0. After reload the same owned initial marker is canonicalized to its content-search unit, which exposes only id:fallback-turn-0. v2.10.71's exact comparison misses this alias. No competing task/user is present. The second original task has resumed work and carried into a successor under v2.10.70.

## Requirements / acceptance
- R1/AC1: Treat legacy UUID-plus-turn and current turn-only user keys as equivalent only when the exact response-turn key matches and the current owned latest user is the task marker or a recorded continuation. Do not adopt foreign/unowned users or different response turns.
- R2/AC2: Share that comparison between click deduplication and expired pending-fence recovery. Never replay Send merely because the renderer dropped a legacy UUID. Retain the 90-second send deadline, eight-second quiet no-Stop/card confirmation, settlement, draft and pause/route guards, carried work and three-send policy. Keep visible explicit header-level 开启/关闭 controls and workspace setting semantics.
- R3/AC3: Actions-only parity/syntax/full tests; exact-head PR/main and release digest. Install final runtime in the two original tabs. Prove actual progress for both preserved task IDs, no repeated old-boundary dispatch, and visually confirm functional enable/disable controls. Record all provenance and earlier acceptance gaps without claiming earlier versions completed this case.

## Plan / boundaries
A shared comparator accepts exact keys first, then strictly parses the stored/current key arrays. Alias compatibility requires an equal nonempty turn:<key> response and id: user keys whose last structural component equals that same turn, plus owned marker/continuation identity. No fuzzy text matching or arbitrary missing-boundary bypass. Existing recovery and snapshot ownership remains authoritative. Rollback reverts version/source/bundle/tests together.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R3 / AC1-AC3 | passed | Final integrated source c514eb32; PR #192; main Actions 39884321266: parity/syntax and 570 tests (563 pass, 0 fail, 7 skip); Release 39884547997, asset 667629960, SHA256 dbf633d002616241c6cc6dcfca337a188c343d647e7b623b8ee9ef4d296dbf88. See installed/live evidence below. |

## Final installed acceptance — 2026-10-23
- First original task `9a70a374-d09f-433b-8a65-6ed70b60a1fc`, work round 21, progressed from `/c/6ada32d8-71d0-83e8-ac43-834af61e1510` to `/c/6adab914-beb0-83e8-a084-c248b9854cbe`; root runtime reads 2.10.73. Native page shows Stop and new web-search activity. Original task identity/round preserved.
- Second original task `3dd43a37-9f36-4b7a-adac-dfcc87584523`, work round 17, progressed from `/c/6ada1987-7850-83e8-8cc0-609c6b72730e` to `/c/6adab4db-6614-83e8-b213-90498f607495`; observed Stop, new pairing/database audit work, later same-chat continuation and real response at 09:37. Its active document remains runtime 2.10.71; it was not reloaded during generation. Installed extension is enabled 2.10.73.
- Explicit header-level 开启/关闭 controls confirmed in both workspaces. First control tested ON then OFF with immediate aria/state readback; second explicitly set OFF. No manual Send/Retry, permission click, task-state edit, or synthetic failure was used to claim recovery. Existing automation continued normally.
- Earlier 2.10.70/71 did not recover the first task: renderer alias and inherited Stop hydration gaps were discovered live and closed by combined 2.10.72/73. 2.10.72 was not separately installed. Cloud regressions verify no old-boundary send replay; live acceptance verifies real task progression, not completion of downstream migration work.
