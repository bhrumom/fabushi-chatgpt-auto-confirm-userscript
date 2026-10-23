# Expired continuation and inherited Stop deadlock — v2.10.73

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-23
Related: stalled-continuation-recovery-v2.10.70.md; unacknowledged-initial-boundary-v2.10.71.md; continuation-boundary-alias-v2.10.72.md

## Verified original-task state
Original task 9a70a374-d09f-433b-8a65-6ed70b60a1fc is running, not busy or navigating, on its bound /c/6ada32d8-71d0-83e8-ac43-834af61e1510. Full session overflow confirms authorizationRequiredContinuation=true, one aged send intent, old document Stop identity still matching the route/phase/round/token, and reloadStopAbsentSince=0. The explicit connection-interruption path precedes and returns before legacy hydration tracking, while the structural observer defers to that hydration timer. They therefore wait on one another even after alias comparison is repaired.

## Requirements / acceptance
- R1/AC1: An already-expired, owned, route-matched pending continuation fence uses its own normal eight-second quiet/card confirmation; it must not wait on inherited-Stop hydration tracking from a later inspector branch. Keep inherited-Stop hydration gating unchanged for other conversations and initial blank shells.
- R2/AC2: Preserve all existing current Stop, card/settlement, final/draft, pause, ownership, deadline, alias compatibility, click fencing, carried-work and cap guards. Never manually clear task state or replay an old Send click to make acceptance pass.
- R3/AC3: Regress the exact combined live state: old document Stop, zero reload timer, initial marked user, legacy UUID alias, old final-looking response, visible connection-interruption notice, aged pending continuation. Actions-only parity/syntax/full tests; verified source/main/release and digest. Final installed runtime must prove progression of both original tasks and visible functional header-level 开启/关闭 controls. Record actual live routes/task identity/phase/round and evidence boundaries.

## Plan
Exclude only expiredPendingFence from the generic observer's dependency on legacy inherited-Stop hydration. All its own ownership/draft/Stop/card checks still run first, and its stable content identity and final fresh card scan remain mandatory. The old hydration path continues to guard all non-expired/non-continuation cases. Roll forward source/bundle/version together; no local test/build.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R3 / AC1-AC3 | pending | Cloud and both-original-task acceptance pending. |
