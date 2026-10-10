# Hidden-tab scheduling and modular source
Status: active
Owner: standalone userscript
Date: 2026-10-10

## Problem and goal
Installed 2.10.42 uses chained page timers; it does not consume background-wake or background-clock responses. Installed extension has a wake handler outside its guarded scope and throws RESPONSE_SOURCE undefined. User observed a 34-minute hidden send wait and requests modular source.

## Requirements
- R1: Optional extension clock races the native fallback exactly once. Host wake drains overdue waits and wakes owned supervision without activating tabs, overriding pause, bypassing cooldowns or concurrent tick/send.
- R2: Abort, clear and shutdown remove callbacks/listeners. Denied/missing host uses native fallback. Renderer freeze and computer sleep cannot be guaranteed away.
- R3: Development sources are split by responsibility with a deterministic manifest and build. Generated installable userscript remains one file. No runtime eval, remote imports or duplicated editable implementation.
- R4: Build check in CI fails on stale generated artifact. Existing regression fixtures continue exercising the complete installed bundle. Dedicated clock tests with native timers withheld exercise host responses, wake deadlines, abort/clear and pause-safe wake.
- R5: Extension listener is inside its idempotent content bridge guard, tested by repeated injection plus actual alarm -> content -> page event. Native acceptance must inspect installed version and real inactive-tab progress; simulated tests are separate.

## Architecture
An independent background-clock module has an explicit window/onWake interface and lifecycle disposal. Legacy runtime is organized into ordered domain source units assembled in the same lexical bootstrap scope, preserving state identity and initialization order. This is a low-risk source modularization step, not a claim that all legacy domains have independent dependency interfaces. Manifest documents ownership/order; subsequent extraction can introduce explicit services without changing install format.

## Verification/compliance
Implemented in 2.10.44, commit 4be7b3a8219c0a1bce57c1608d6e91596676ceb0. Exact-head Actions 38033881779 passed generated artifact verification, syntax and regression tests (job 114160201635). Installed management readback confirms 2.10.44 enabled. Native task 6558f830-6eb9-431e-a275-630a33a1012d recognized Work final at 15:22, review at 15:25 and next Work dispatch at 15:26. Earlier native readback showed 539 host clock responses while queued, identifying navigation rejection separately from clock delivery. CI clock tests with withheld page timers verify host deadlines, exactly-once callbacks and disposal. Natural prolonged hidden renderer freeze acceptance remains open; do not infer it from VM tests or host counts. No local regression suite was run; local bundle and syntax checks passed.

R6: Navigation deferral diagnostics include the host rejection reason, so invalid source validation cannot appear as an unexplained repeated cooldown. Preserve all guard decisions.
