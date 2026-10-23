# Unacknowledged continuation after renderer rollback — v2.10.71

Status: active
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
| R1-R4 / AC1-AC4 | pending | Implementation and cloud/live verification pending. |
