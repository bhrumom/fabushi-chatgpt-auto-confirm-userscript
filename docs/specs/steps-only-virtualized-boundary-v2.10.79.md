# Steps-only rest with virtualized task messages — v2.10.79

Status: active
Date: 2026-10-24
Owner: standalone userscript

## Problem and goal
After v2.10.78 installed through Fabushi, the live ongoing task rendered only work activity while its original user marker was virtualized. The strict marker-only rest detector could miss this state. Extend the hourly-rest specification without relaxing final-answer ownership.

## Requirements / acceptance
- R1: Preserve all v2.10.78 hourly-rest behavior and safeguards.
- R2: Allow an exact-route fallback only when the marker is absent, there is no competing owner/task, and the persisted Stop generation identity equals the current task/route/phase/round identity. A mounted user must match the recorded observed user boundary; a new manual user fails closed.
- R3: Without a mounted boundary require a current content-search response turn and scope both activity and reply checks to that turn. Historical primary replies and tool steps must not interfere. This is recovery attribution only and does not confer final-answer ownership.
- R4: Preserve the same rest identity across marker virtualization of the observed user, so an already-started hour does not restart. Exact-head CI, source/bundle parity, main CI and release provenance remain required. Report live observation separately from simulated hourly cycles.

## Architecture / constraints
Extend stepsOnlyResponse only; reuse persisted Stop ownership and current turn selectors, existing scheduler and carry. Use the existing stopObservedUserBoundaryKey for continuity; do not create a second writer. No new permission surface. No new automatic prompt before the hour expires. Unknown/foreign routes and ambiguous sends remain excluded.

## Verification / release / rollback
Add focused fixtures for a virtualized user with a prior primary reply in another turn, a matching/mismatching observed user, lack of Stop authority, rest continuity and a late real reply. Run full GitHub Actions, deliver v2.10.79 through existing release flow, and verify installation. Rollback to v2.10.78 restores strict marker-only detection.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R4 implementation | passed | Executable head `d510ba6c1155e9f8bb95f4c111f5407e81438fac` passed full [Test 40076513227](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/40076513227), including hourly repeat and virtualized ownership/carry fixtures. |
| R4 release | blocked | Awaiting final docs-head Test, merge, main Test and release readback. Post-release evidence is recorded in PR #198. |
| Live hourly expiry | blocked | No hour-long live cycle yet observed. |
