# Conversation authorization required before handoff — v2.10.66

Status: completed
Owner: Fabushi userscript
Last updated: 2026-10-22

## Context and goal
The user requires at least one observed authorization card in the current ended/interrupted conversation before ending it or opening its successor. Without such evidence continue in the same conversation with “继续完成所有，闭环后按模板输入”. This supersedes earlier always-fresh interruption and completion policies.

## Requirements and acceptance criteria
- R1 / AC1: Persist actual card presence with its canonical conversation URL, including manual/disabled authorization cards. Appearance is sufficient; do not manufacture a grant or require a successful click. Reject foreign routes/tasks and quoted controls.
- R2 / AC2: Gate normal completion, next-round handoff, malformed-report repair, interruption, blocked retry, length-limit and rate-limit fresh retries for bound conversations. Unknown historical evidence fails closed. Initial unbound dispatch remains possible.
- R3 / AC3: Without evidence retain URL, task identity, phase, round, attachments and goal, and send the exact continuation in that conversation only after generation stops. Respect pause, ownership, pending authorization, rate limits, blockers and unrelated drafts.
- R4 / AC4: Persist continuation intent before clicking. Ambiguous sends must not be duplicated after reload; continue only when a subsequent owned response ends. Throttle repeated continuation rounds. A new conversation cannot reuse the old URL evidence.
- R5 / AC5: Pending authorization remains handled by existing controls; once resolved and appearance recorded existing completion/handoff logic resumes. No permanent permission selection changes.
- R6 / AC6: Build parity, syntax and full regressions run in GitHub Actions; inspect exact-head CI, main CI, release and installed runtime separately.

## Architecture / data flow
Card scanner records authorizationSeenURL/authorizationSeenAt on the unique bound route owner. Boundary guards queue authorizationRequiredContinuation without clearing dispatch. inspect sends through the existing composer only on the owned route; the existing exact-route ended-session fallback also covers a virtualized or entirely unmounted original user marker, while rejecting competing markers. Pending cards still block handoff after appearance is recorded. A route-scoped persisted continuation intent prevents repeated clicks for the same ended turn. Existing final-report contract remains unchanged.

## Constraints and failure modes
No local build/test; GitHub Actions is authoritative. Source concatenation may be performed as file generation. Unsendable or length-exhausted chats remain bound and visibly waiting; absence of a card never permits a fresh-chat escape. No backfill from generic history or earlier conversations. Old cards not observed by this version remain unknown. A successful card appearance does not prove successful authorization.

## Implementation and verification
Add shared guard and composer continuation, wire all bound-session transitions, update version and README, add focused DOM regressions and adapt existing handoff fixtures to explicitly include prior observed authorization. Verify cloud CI and publish through normal guarded release workflow. Rollback by reverting source, generated bundle, version and tests together.

## Provenance
User request 2026-10-22; AGENTS.md; spec-first-ai-development.md; connection-interruption-fresh-handoff-v2.10.25.md; work-execution-completion-gate-v2.10.62.md; tested-github-release-delivery.md.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1 / AC1 | passed | Card scanner records route-scoped appearance; disabled card, durable snapshot, cross-route and quoted-controls regressions pass. |
| R2 / AC2 | passed | Completion, next report, repair, interrupted/blocked/length/rate-limit transitions use the shared guard. No-card boundary regressions pass. |
| R3 / AC3 | passed | Exact continuation prompt, original identity, draft/pause/aborted/foreign-route safeguards and virtualized/unmounted marker tests pass. |
| R4 / AC4 | passed | Persisted ended-turn send intent, cooldown, same-boundary reload deduplication and URL-scoped authorization tests pass. |
| R5 / AC5 | passed | Pending card still blocks handoff; existing authorization choice/settlement regression suite passes. |
| R6 / AC6 | passed | PR #185 exact head 66b428a72927526847a4dfc726aea1adca1cf647: Test 39763730623 passed; merge dad0b3026d83c78634d36c7987ff6e641fe2d523: Test 39764106048 and Release 39764364645 passed. 520 tests: 513 pass, 0 fail, 7 skipped. Release v2.10.66 asset 665516250 SHA-256 841203c959c9866544dedf744d5a3ce67041d217d89c91d50b92a8bfd9c3cc9e matches source. Chrome installed/enabled 2.10.66; the original /c/6ad9e617-27bc-83e8-a0e9-6bc78d81f861 page reports runtime 2.10.66 after same-tab reload. |

Live scope: Chrome runtime 2.10.66 was observed in both original tabs. On original /c/6ad9e6d7-7ac0-83e8-a943-324953aa237b, task 3dd43a37-9f36-4b7a-adac-dfcc87584523 remained in Work round 10 with authorizationSeenAt=0, continuationCount=1 and authorizationContinuationURL equal to the original route. The actual user-message DOM contains the exact continuation prompt, the composer is empty and task state is generating. This proves a real no-card same-conversation continuation, not merely persisted click intent. Nested matching renderer nodes are one message, not multiple sends. No new live authorization grant is claimed.
