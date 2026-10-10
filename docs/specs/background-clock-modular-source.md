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
Pending exact-head Actions, installed upgrade and inactive-tab evidence. No local regression suite; local build/syntax checks are allowed.

R6: Navigation deferral diagnostics include the host rejection reason, so invalid source validation cannot appear as an unexplained repeated cooldown. Preserve all guard decisions.
