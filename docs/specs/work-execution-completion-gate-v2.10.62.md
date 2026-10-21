# Work execution-completion gate — v2.10.62

Status: released
Owner: Fabushi ChatGPT Auto-confirm userscript
Last updated: 2026-10-21
Related issue/task/PR: User request 2026-10-21; implementation branch fix/work-prompt-execution-completion-gate-v2.10.62

## 1. Context / problem

The Work prompt already asks the model to execute the task and check real evidence, then emit MAHAYANA_TASK_REPORT_V1. However, the execution gate is not explicit enough: a model can still mistake the required final-report template for permission to stop after analysis, a plan, recommendations, or a partial implementation. Since status=complete ends the task, this creates a premature-completion risk.

## 2. Goal

Strengthen workPrompt() so the report template is only a per-round control/reporting contract, never a shortcut around execution. The task may be terminally complete only after every in-scope user requirement and acceptance criterion has actually been fulfilled and supported by evidence. If work remains, Work must continue and return status=next with an immediate executable action.

## 3. Non-goals / out of scope

- Do not change the MAHAYANA_TASK_REPORT_V1 schema, taskId/round identity fencing, report parser, or complete/next scheduler transitions.
- Do not reopen the removed Review/planner conversation.
- Do not alter authorization, model selection, attachment handling, task ownership, or recovery behavior.
- Do not widen a task beyond its explicit scope. For a read-only audit, completion means every requested inspection and evidence record is actually complete; it does not authorize source modifications.
- Do not repeat already completed production changes during a report-repair round.
- Do not run builds or tests on Mac, Windows, bhrum2, or a local/container runtime. GitHub Actions is the build/test authority.

## 4. Requirements

- R1: workPrompt() must explicitly state that the final-report template is not permission to stop and that analysis, planning, recommendations, code snippets, or claims without delivery do not count as completion.
- R2: status=complete is allowed only when every requirement and acceptance criterion has been fulfilled according to the original scope, with concrete, verifiable evidence. For code/config/data work, required changes must be applied to the correct target and committed to the cloud; exact-head GitHub Actions checks must pass when applicable; merge, release, deployment, or other delivery steps must be completed when the task asks for them.
- R3: If any actionable work or verification remains, the model must continue executing it in the current round. It must not emit status=complete merely because the final response is due, the context is long, or a report can be written.
- R4: Scope is authoritative. Read-only tasks must complete all requested reads, comparisons, caller/owner/production-wiring checks, and evidence recording without modifying protected files. Implementation tasks must implement rather than substitute a plan.
- R5: When a blocker occurs, continue independent work, do not wait idle, and do not repeatedly retry the same blocked action without a meaningful state change. Any unresolved requirement forces status=next with evidence and a concrete next action; a blocker must never be described as completion.
- R6: On a final-report repair round, reuse identity-matched carried evidence, do not repeat completed production changes, perform any remaining necessary verification, and keep the same strict completion gate.
- R7: Keep the report schema and exact identity checks unchanged. status=complete requires an evidence-based summary and next=""; status=next must contain an immediate, concrete action that continues the work rather than session-routing prose.
- R8: Add focused regression assertions for the new prompt requirements and verify the generated bundle, JavaScript syntax, and full test suite through GitHub Actions.

## 5. Initial state at specification time

Canonical main is 2186156cf1f2693450961b03be5a3929d7059b03, runtime version 2.10.61. workPrompt() says to execute and check evidence, but does not establish a sufficiently explicit hard completion gate or define how to keep moving when some items are blocked.

## 6. Target state

The prompt distinguishes a non-terminal per-round report from terminal completion. It requires an internal requirement-by-requirement closure check, actual delivery and evidence, continued execution for every remaining actionable item, and status=next whenever anything remains unresolved. The original task's scope and permission boundaries remain authoritative.

## 7. Architecture and ownership boundaries

- The Work model owns execution, scope-respecting implementation, evidence collection, and authorship of the final report.
- The userscript owns task identity, final-reply detection, report parsing, persistence, and next-round dispatch.
- The prompt must not claim the userscript independently verifies all semantic task requirements; the report is model-authored, and tests verify the prompt contract.
- Existing scheduler and safety guards remain authoritative.

## 8. Interfaces / contracts / schemas / data flow

Unchanged report contract:
{"taskId":"<current task id>","round":<current round>,"status":"complete|next","summary":"verified evidence and any remaining gaps","next":"empty for complete; immediate executable action for next"}

status=complete is terminal only after the completion gate passes. status=next records verified progress and an executable continuation action, which the existing scheduler sends in a subsequent Work round.

## 9. Constraints and non-functional requirements

- Preserve taskId and round exactly.
- Preserve current Work-only lifecycle and report-repair identity fencing.
- Respect read-only, repository, device, cloud-commit, and deployment constraints in the original task.
- Do not claim a build, test, commit, merge, release, or deployment unless its real evidence exists.
- GitHub Actions exact-head runs are the authority for build/test acceptance.

## 10. Failure modes and edge cases

- Analysis or a proposed patch is presented without actual requested changes.
- Some checklist items remain unimplemented or lack required evidence.
- CI is queued, in progress, or failing when a task requires passing CI.
- A required merge, release, or deployment is still pending.
- A task is explicitly read-only and must not be changed despite the general implementation gate.
- A report repair carries a malformed prior report but the underlying implementation is already complete.
- An external blocker prevents one action while other independent requirements remain executable.
- The model reaches a context or response boundary before all requirements are complete.

## 11. Implementation strategy

1. Add this Spec before runtime changes.
2. Strengthen the completion gate in src/runtime/send-and-navigation.inc.js workPrompt().
3. Add focused prompt-contract regressions in test/final-reply-handoff.test.mjs.
4. Increment the runtime version to 2.10.62 and update README release notes.
5. Regenerate chatgpt-auto-confirm.user.js on GitHub Actions, then verify exact-head build parity, syntax, and the complete test suite.
6. Review every requirement/AC against the final diff and Actions evidence; merge through the repository's normal GitHub process and verify canonical main/release when available.

## 12. Verification / test strategy

Use GitHub Actions only. Test must prove the generated bundle matches src/manifest.json, the generated userscript passes node --check, and the complete Node/JSDOM suite passes. Focused tests must prove:
- The prompt calls the report template non-terminal and forbids analysis-only completion.
- The prompt requires requirement-by-requirement implementation/evidence before status=complete.
- Any remaining work or blocker requires status=next and a concrete continuation action.
- Explicit read-only scope remains respected.
- Report-repair context does not require repeating already completed changes.
- Existing taskId/round and complete/next behavior remains unchanged.

## 13. Acceptance criteria / Definition of Done

- AC-1: workPrompt() contains the hard execution-completion gate.
- AC-2: The gate requires all in-scope requirements and acceptance criteria to be delivered and evidenced before status=complete.
- AC-3: Remaining actionable work and unresolved blockers force status=next; independent work continues and repeated blocked actions are avoided without state change.
- AC-4: Read-only tasks remain read-only, and report-repair rounds do not repeat completed production changes.
- AC-5: Focused tests, generated bundle parity, syntax check, and the full GitHub Actions Test pass on the final implementation revision.
- AC-6: The exact PR head, merge result, canonical-main Test, and release evidence are checked and accurately reported.

## 14. Release / migration / rollback

Increment the userscript version from 2.10.61 to 2.10.62. The report schema and persisted task data do not change. If rollback is required, revert the prompt/source, tests, version, README, and generated bundle together to the previous tested main.

## 15. Observability / evidence

Record exact branch/commit, PR head, workflow run/job results, merge SHA, canonical-main Test, and release tag/asset digest. Do not treat queued/pending Actions or a PR-only result as canonical-main acceptance.

## 16. References / provenance

- docs/specs/work-final-report-direct-dispatch-v2.10.53.md
- docs/specs/work-final-report-repair-carry-v2.10.54.md
- projects/continuous-auto-retry/management/tasks/CAR-001-never-stop-on-blocked.md
- AGENTS.md
- User request, 2026-10-21

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R8 | implemented and verified | `workPrompt()` and focused regression coverage are present; exact PR-head Test run 39588857223 on `19a68529190b48baad510f648dc2036e90745adf` passed generated bundle parity, `node --check`, and the full Node/JSDOM suite (493 tests: 486 passed, 0 failed, 7 skipped). Canonical-main Test run 39589115791 on merge commit `1fec56158f5d50abbb3071a9d5300227af7aea45` also passed. |
| AC-1 | passed | Strict execution-completion gate is present in the generated userscript and source prompt. |
| AC-2 | passed | Prompt explicitly requires every in-scope requirement and acceptance criterion to be implemented and evidenced before `status=complete`. |
| AC-3 | passed | Prompt requires `status=next` with an immediate action while actionable work or unresolved blockers remain. |
| AC-4 | passed | Read-only scope and report-repair non-duplication are preserved by prompt and regression assertions. |
| AC-5 | passed | Exact PR-head run 39588857223 on `19a68529190b48baad510f648dc2036e90745adf` and canonical-main run 39589115791 on `1fec56158f5d50abbb3071a9d5300227af7aea45` both passed bundle parity, syntax, and all regression tests. |
| AC-6 | passed | PR #180 merged to main at `1fec56158f5d50abbb3071a9d5300227af7aea45`; canonical-main Test run 39589115791 passed; Release run 39589305774 passed; public release `v2.10.62` (release ID 419455907) published with asset `chatgpt-auto-confirm.user.js` (asset ID 662221369, SHA-256 `f1347da6a6c0b9953bad4c7b7e060999edd6450451eb3ac5c78bc276eb2a51be`). |
