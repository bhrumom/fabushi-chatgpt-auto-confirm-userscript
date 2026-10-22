# Conversation authorization required before handoff — v2.10.66

Status: active
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
Card scanner records authorizationSeenURL/authorizationSeenAt on the unique bound route owner. Boundary guards queue authorizationRequiredContinuation without clearing dispatch. inspect sends through the existing composer only on the owned route. A route-scoped persisted continuation intent prevents repeated clicks for the same ended turn. Existing final-report contract remains unchanged.

## Constraints and failure modes
No local build/test; GitHub Actions is authoritative. Source concatenation may be performed as file generation. Unsendable or length-exhausted chats remain bound and visibly waiting; absence of a card never permits a fresh-chat escape. No backfill from generic history or earlier conversations. Old cards not observed by this version remain unknown. A successful card appearance does not prove successful authorization.

## Implementation and verification
Add shared guard and composer continuation, wire all bound-session transitions, update version and README, add focused DOM regressions and adapt existing handoff fixtures to explicitly include prior observed authorization. Verify cloud CI and publish through normal guarded release workflow. Rollback by reverting source, generated bundle, version and tests together.

## Provenance
User request 2026-10-22; AGENTS.md; spec-first-ai-development.md; connection-interruption-fresh-handoff-v2.10.25.md; work-execution-completion-gate-v2.10.62.md; tested-github-release-delivery.md.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R6 / AC1–AC6 | pending | Implementation and cloud verification pending. |
