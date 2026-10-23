# Continuation boundary alias compatibility — v2.10.72

Status: active
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
| R1-R3 / AC1-AC3 | pending | Cloud and both-original-task verification pending. |
