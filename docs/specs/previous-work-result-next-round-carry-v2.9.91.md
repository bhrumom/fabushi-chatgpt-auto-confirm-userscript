# Carry the previous Work result into the next round — v2.9.91

Status: active  
Owner: Fabushi ChatGPT Auto-confirm userscript  
Last updated: 2026-09-27  
Related issue/task/PR: user report that next-round Work prompts omit completed Work output

## 1. Context / problem

The task runner stores each completed Work assistant response in `task.result` and gives it to the independent planner/reviewer. If the reviewer returns `next`, the runner retains that result while moving to a new Work round, but `workPrompt()` only includes the reviewer's `task.next` and original goal. Therefore the next Work conversation cannot see the previous round's completed findings or progress. When an abnormal fresh-chat recovery occurs during a later Work round, its prompt carries the interrupted response but likewise omits the completed result from the preceding round.

## 2. Goal

Include the immediately previous completed Work result in each later-round Work prompt, including abnormal fresh-chat recovery, so the next conversation can continue from verified progress.

## 3. Non-goals / out of scope

- Do not change final-reply recognition or when Work results are stored.
- Do not send Work output directly to ChatGPT without the existing task prompt flow.
- Do not change planner/reviewer decisions, task identity, attachment upload, or session ownership.
- Do not include a stale result in round 1 or after a goal edit that clears the result.

## 4. Requirements

- R1: For Work rounds greater than 1, include the immediately previous completed Work response from `task.result` in the prompt.
- R2: Keep the current reviewer `task.next` (or initial task goal when absent) and original goal authoritative; prior Work output is context/progress, not instructions that override them.
- R3: In abnormal fresh-chat recovery, include both previous-round completed Work output and the current interrupted response, preserving the current recovery instruction and original goal.
- R4: Do not add previous-result context to round 1, empty-result prompts, review prompts, or a new semantic goal after its result was cleared.
- R5: Keep carry size bounded by the existing 24,000-character `task.result` limit and do not duplicate the result in prompts.

## 5. Current state

`finish()` stores a completed Work reply in `task.result` (capped at 24,000 characters). A planner `next` transition increments `round`, sets `phase='work'`, and preserves `task.result`. The normal and abnormal branches of `workPrompt()` do not currently interpolate it.

## 6. Target state

When building a later-round Work prompt, the script labels `task.result` as the preceding completed Work round and includes it once. The existing current-round instruction, original goal, and any interrupted current assistant response remain visible and retain their existing roles.

## 7. Architecture and ownership boundaries

The userscript task runner owns prompt assembly and persisted task state. The Fabushi Chrome extension remains the host that injects the stable remote userscript; no extension changes are needed.

## 8. Interfaces / contracts / schemas / data flow

No schema or external interface changes. Reuse `task.result` and `workPrompt()`. The value is already bounded and persisted by the existing task lifecycle.

## 9. Constraints and non-functional requirements

- Avoid extra DOM scans or storage reads; assemble from the in-memory task record.
- Preserve prompt precedence: current `next`/goal first, progress context as supporting evidence.
- Do not add duplicated or unbounded transcripts.

## 10. Failure modes and edge cases

- Empty prior result: omit the section cleanly.
- Round 1: omit prior-round context even if a stale result field exists.
- Abnormal recovery in a later round: include prior completed output and current interrupted output separately.
- Goal edit: the existing goal-edit flow clears `task.result`; therefore no prior-goal work may leak into the new target.

## 11. Implementation strategy

Add a small prompt-context helper gated on `phase='work'`, `round > 1`, and non-empty `task.result`. Use it in both ordinary and abnormal recovery Work prompt assembly. Extend prompt tests for ordinary round transition, round-1 omission, empty-result omission, and simultaneous previous-result/current-interruption carry.

## 12. Verification / test strategy

Run focused workbench tests, the full `npm test` suite, `node --check chatgpt-auto-confirm.user.js`, and `git diff --check`. Require exact-HEAD GitHub CI and the repository's successful release workflow before publishing v2.9.91.

## 13. Acceptance criteria / Definition of Done

- AC-1: A later-round normal Work prompt includes the preceding completed Work result and current `next` instruction.
- AC-2: An abnormal recovery prompt includes both preceding completed result and current interrupted assistant response.
- AC-3: Round 1 and empty result do not create an empty or stale previous-result section.
- AC-4: Tests and exact-HEAD CI pass, and v2.9.91 is published from the canonical userscript source.

## 14. Release / migration / rollback

No migration. Publish userscript v2.9.91 using the validated release workflow. Fabushi extension v0.6.23 consumes the stable userscript URL; no host extension release is required.

## 15. Observability / evidence

Prompt-contract tests prove the prior result and current interruption are distinct and present. Release evidence records exact commit, CI status, release asset and stable-source version.

## 16. References / provenance

- `AGENTS.md`
- `docs/specs/spec-first-ai-development.md`
- `docs/specs/SPEC_TEMPLATE.md`
- User report dated 2026-09-27 that next-round sessions lack previous Work output.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R5 / AC-1-AC-3 | passed | `previousWorkResultContext()` gates on later Work rounds and a non-empty bounded `task.result`; `test/workbench.test.mjs` verifies normal and abnormal carry, exactly-once inclusion, and round-one/empty omission. |
| AC-4 | pending | Exact-HEAD CI and v2.9.91 release not yet complete. |
