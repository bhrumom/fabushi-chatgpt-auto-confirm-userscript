# Structural stopped-conversation recovery — v2.10.68

Status: delivered
Owner: Fabushi userscript
Last updated: 2026-10-22

## Context / goal
The user clarifies that recovery must use shared structural evidence across arbitrary failures: Stop disappears, expand the current message/activity, inspect the entire page for authorization, and treat absence of a card as an abnormal interruption rather than waiting on a known error string. This replaces production reliance on the v2.10.67 concurrent-error-specific Retry classifier.

## Requirements / acceptance
- R1/AC1: On the owned bound route without Stop, expand current collapsed message and current response/activity disclosure controls before deciding. Re-read DOM after expansion; do not click permission actions, unrelated turns, menus, model pickers, user quotes or navigation controls. Pace/bound reveal attempts.
- R2/AC2: Use a stable eight-second no-Stop observation plus a fresh whole-page authorization scan before abnormal recovery. Unknown error copy, stale loading/busy/streaming markers, missing toolbar and virtualized original marker must not cause an indefinite wait. Changing actual response text and reappearing Stop reset the confirmation. Blank renderer shells remain same-route hydration recovery.
- R3/AC3: Current pending cards and authorization settlement block handoff; a card revealed during expansion is handled in place. Valid current final reports and strongly owned completed replies retain normal final handling. Pause, route ownership, draft and unconfirmed-send guards remain authoritative.
- R4/AC4: Abnormal recovery uses the existing carried handoff, optional authorization checkbox (default off), and three same-conversation continuation cap from v2.10.67. No fourth continuation. No classification needs a known error phrase or Retry control.
- R5/AC5: Source/bundle parity, syntax and full tests run only in GitHub Actions. Verify exact-head PR/main CI, release digest, installed runtime, visible switch, and current original task state.

## Architecture / implementation
A route/turn-scoped structural observer runs after safe current-message/activity expansion and before legacy pending-continuation or text-specific recovery. It records a quiet confirmation deadline while ordinary classification continues; after eight stable seconds it performs a new wide card scan and queues the standard abnormal handoff. Disabled/busy UI attributes do not outweigh missing Stop. Real final evidence, ownership boundaries and loading-only shells remain protected. The concurrent-error-specific Retry matcher and handler are removed; production inspection uses the structural observer. Legacy persisted retry fields are cleared for migration compatibility.

## Failure modes / constraints
Unknown historical authorization is not invented. Expanding a disclosure is not proof it has no card; wait for a fresh inspection and lazy DOM hydration. Cards mounting late cancel confirmation. An unrelated draft is not cleared by the observer. Preserve phase, round, goal, attachments and actual visible work. Do not modify unrelated tasks or use local build/test. Rollback reverts source, version, tests and generated bundle together.

## Verification / provenance
Test arbitrary unknown failures with/without Retry, stale streaming/loading, Stop reappearance, lazy card revelation, valid finals, foreign routes/users, pause/drafts, and enabled/disabled cap behavior. User clarification 2026-10-22; AGENTS.md; optional-authorization-concurrent-recovery-v2.10.67.md.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1 / AC1 | passed | Current-message expansion precedes activity expansion and structural observation. Bounded Map/WeakSet pacing prevents repeated collapse. Lazy-card reveal regression passes in PR #187. |
| R2 / AC2 | passed | Eight-second route/turn/content-scoped confirmation; unknown errors with/without Retry and stale streaming regressions pass. Stop/content changes reset observation. Empty renderer shells retain hydration handling. |
| R3 / AC3 | passed | Whole-page live card/settlement checks run before confirmation and immediately before handoff. Full suite covers final reports, route ownership, pause, drafts, inherited Stop and submission guards. |
| R4 / AC4 | passed | Optional default-off gate and durable route-scoped cap retained. Both one-attempt and three-attempt unknown-error cases pass without clicking Retry; no fourth continuation. |
| R5 / AC5 | passed | Exact-head PR Test 39787895925 at f54d56e10e520806bef4c4dc829d4578bff8701c; canonical main Test 39788417083 at a39be348e58b9b3620031458879917b54b230eb2; Release 39788788842 all success. 539 tests: 532 pass, 0 fail, 7 skip. Bundle parity and syntax passed in Actions. Release asset 665991165 SHA256 99bef8a27a8a0355891a26e4cb7229d8a38aafb6bae632b2f454f30622aad866 matches downloaded asset and source. |

## Installed runtime acceptance
Chrome Fabushi installed list shows enabled 2.10.68. Both existing running tabs were reloaded in place after verifying empty composer and no pending approval; DOM runtime version reads 2.10.68. Workbench checkbox `新开会话前检查授权（最多继续3次）` is visible and unchecked. No default-on behavior was introduced.
- Task 3dd43a37-9f36-4b7a-adac-dfcc87584523: route /c/6ada0c2b-efac-83e8-887b-fcbe0486965e, round 16, waiting, continuationCount 1; original user-reported route has already progressed via the existing task chain.
- Task 9a70a374-d09f-433b-8a65-6ed70b60a1fc: route /c/6ada0f55-8724-83e8-8920-a08d0681a4ac, round 20, waiting, continuationCount 0.
- The original concurrent error disappeared before the new runtime was activated. Generic failure recovery is regression-verified; this acceptance does not claim a newly observed natural concurrent failure recovered by v2.10.68. Actual version, checkbox, retained task identity and active supervision are directly verified.

Release: https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/tag/v2.10.68
PR: https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/pull/187
