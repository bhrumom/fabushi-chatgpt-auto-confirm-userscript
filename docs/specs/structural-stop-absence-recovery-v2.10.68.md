# Structural stopped-conversation recovery — v2.10.68

Status: active
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
A route/turn-scoped structural observer runs after safe current-message/activity expansion and before legacy pending-continuation or text-specific recovery. It records a quiet confirmation deadline while ordinary classification continues; after eight stable seconds it performs a new wide card scan and queues the standard abnormal handoff. Disabled/busy UI attributes do not outweigh missing Stop. Real final evidence, ownership boundaries and loading-only shells remain protected. Existing specific classifier helpers remain compatibility helpers; production inspection uses the structural observer.

## Failure modes / constraints
Unknown historical authorization is not invented. Expanding a disclosure is not proof it has no card; wait for a fresh inspection and lazy DOM hydration. Cards mounting late cancel confirmation. An unrelated draft is not cleared by the observer. Preserve phase, round, goal, attachments and actual visible work. Do not modify unrelated tasks or use local build/test. Rollback reverts source, version, tests and generated bundle together.

## Verification / provenance
Test arbitrary unknown failures with/without Retry, stale streaming/loading, Stop reappearance, lazy card revelation, valid finals, foreign routes/users, pause/drafts, and enabled/disabled cap behavior. User clarification 2026-10-22; AGENTS.md; optional-authorization-concurrent-recovery-v2.10.67.md.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1-R5 / AC1-AC5 | pending | Implementation and cloud verification pending. |
