# Unacknowledged continuation after renderer rollback — v2.10.71

Status: completed (integrated acceptance in v2.10.73)
Owner: Fabushi userscript
Last updated: 2026-10-23
Related: stalled-continuation-recovery-v2.10.70.md

## Live finding
Installed 2.10.70 renders explicit 开启/关闭 controls correctly. Original task 9a70a374-d09f-433b-8a65-6ed70b60a1fc remains on /c/6ada32d8-71d0-83e8-ac43-834af61e1510 after reload: the failed continuation user bubble was not retained by ChatGPT, leaving the initial marked user and its older response. The persisted click boundary equals that older user/response. continuationCount=1, authorizationRequiredContinuation=true, and the send intent is many hours old. Requiring the latest visible user text to itself be a continuation excludes this real unacknowledged-send case.

## Requirements / acceptance
- R1/AC1: A route-matched pending continuation click fence that still equals the current owned user/response boundary after the existing 90-second send-confirmation timeout is actionable even when ChatGPT rolled back the failed continuation bubble and the latest visible user is the initial task marker.
- R2/AC2: This backed expired fence may inspect the old final-looking response associated with that same boundary; it is not a newly acknowledged continuation response. Preserve quiet eight-second content stability, fresh whole-page card/settlement checks, route ownership, pause, ordinary generation, user drafts and actual distinct newer final responses. Never replay the click; use the existing carried handoff and preserve old final/work text.
- R3/AC3: Retain all 2.10.70 draft/error fixes and the visible header-level explicit 开启/关闭 UI, workspace persistence and default-off semantics. No permission or other task state is broadened.
- R4/AC4: Actions-only bundle/syntax/full tests; exact PR/main/release identities and digest; both original tasks must visibly progress after installed update. Prove new-route dispatch or real generation with preserved task IDs and no replay in the old route. Record each live outcome separately.

## Plan and edge cases
Compute a same-boundary expired pending fence before final classification. Extend aged continuation evidence to include that backed fence. Ignore an old final-looking action row only for that exact fenced response, then delegate to the same bounded no-replay handoff. New user/response boundaries and changing text retain normal final/confirmation behavior. Blank hydration without such an aged fence stays protected. Session-overflow tasks must survive original-tab reload.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R4 / AC1-AC4 | passed | Final integrated source c514eb32; PR #192; main Actions 39884321266: parity/syntax and 570 tests (563 pass, 0 fail, 7 skip); Release 39884547997, asset 667629960, SHA256 dbf633d002616241c6cc6dcfca337a188c343d647e7b623b8ee9ef4d296dbf88. See installed/live evidence below. |

## Final installed acceptance — 2026-10-23
- First original task `9a70a374-d09f-433b-8a65-6ed70b60a1fc`, work round 21, progressed from `/c/6ada32d8-71d0-83e8-ac43-834af61e1510` to `/c/6adab914-beb0-83e8-a084-c248b9854cbe`; root runtime reads 2.10.73. Native page shows Stop and new web-search activity. Original task identity/round preserved.
- Second original task `3dd43a37-9f36-4b7a-adac-dfcc87584523`, work round 17, progressed from `/c/6ada1987-7850-83e8-8cc0-609c6b72730e` to `/c/6adab4db-6614-83e8-b213-90498f607495`; observed Stop, new pairing/database audit work, later same-chat continuation and real response at 09:37. Its active document remains runtime 2.10.71; it was not reloaded during generation. Installed extension is enabled 2.10.73.
- Explicit header-level 开启/关闭 controls confirmed in both workspaces. First control tested ON then OFF with immediate aria/state readback; second explicitly set OFF. No manual Send/Retry, permission click, task-state edit, or synthetic failure was used to claim recovery. Existing automation continued normally.
- Earlier 2.10.70/71 did not recover the first task: renderer alias and inherited Stop hydration gaps were discovered live and closed by combined 2.10.72/73. 2.10.72 was not separately installed. Cloud regressions verify no old-boundary send replay; live acceptance verifies real task progression, not completion of downstream migration work.
