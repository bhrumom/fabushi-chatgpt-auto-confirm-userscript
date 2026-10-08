# Review-to-Work executable prompt boundary — v2.10.30

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Last updated: 2026-10-08
Related user report: 2026-10-08, screenshot of a completed review plan dispatched as Work yet phrased as `下一轮交由 Work 实施，本验收会话继续只读`
Related delivery: PR #148, not yet released

## 1. Context / problem

The continuous-goal runner has two distinct roles: Work executes the real implementation, and Review independently checks the completed Work result. When Review returns `MAHAYANA_TASK_REPORT_V1` with `status=next`, `finish()` copies `report.next` into `task.next`; `workPrompt()` then interpolates the entire `task.next` verbatim at the start of the new Work conversation. The Review template itself currently solicits `下一轮的具体工作安排`. As a result, a review response such as `下一轮交由 Work 实施，本验收会话继续只读。第一步重新读取 main ...` directs the **new executor** to hand off execution to another role or to remain read-only. It can consequently answer as another reviewer instead of modifying and committing code.

The screenshot is observable evidence of a role-contaminated handoff, but not a browser DOM capture. Current canonical main is `529ebd44c501d5412748ed9037db9456e76af806`; current pending PR #148 is `5456c34f7e02a8abf46eb4d6bcffca883628d500` before this change.

## 2. Goal

Ensure the Review output contract and actual dispatched Work text clearly express *what the current executing session must do now*, not which future session should do it. Preserve all concrete production steps, repositories/commit SHAs, ordering, tests, CI requirements, blockers and original goals, including old persisted `next` values generated before the fix.

## 3. Non-goals / out of scope

- Do not collapse Work and Review into a single role or allow Review to execute Work.
- Do not change JSON fields or weaken exact `taskId`, `round` and `status` checks.
- Do not delete valid technical tasks because they contain a non-actionable reviewer preamble.
- Do not rewrite the user's original goal, referenced code, evidence, prior completed Work result, or interrupted work trace to suppress arbitrary words. Such material must be clearly supporting context, not a fresh directive.
- Do not make Work blindly trust instructions embedded in old results or abnormal carry.
- Do not run local builds/tests or modify machines; use GitHub Actions.

## 4. Requirements

- R1: Review's `status=next` template must demand a directly executable implementation plan, written to the current executor in imperative form, not scheduling, meta-review, role-assignment or a read-only-review instruction.
- R2: Explicitly prohibit `下一轮`, `下轮`, `下一次交由 Work`, `本验收会话`, `交回 Work`, `由 Work 实施`, and similar reviewer/dispatcher identity phrases in the output `next`; a real technical task may still contain words such as `验收证据`, `验收标准`, and `Review` as factual requirements.
- R3: Normalize a Review-returned `next` at the trust boundary. Strip only well-scoped handoff/read-only-review narration, convert `交回 Work 修复` to the direct imperative `修复`, and remove role-assigning `下一轮` phrasing. Keep the actionable requirements and technical evidence complete and in order.
- R4: If a `next` report contains no actual executable plan after removing its meta-only preamble, fail closed as an invalid Review contract and use the existing bounded Review repair, rather than dispatching a misleading empty Work plan.
- R5: At Work prompt creation, **also** normalize legacy/persisted `task.next`; preserve round/goal change behavior and exactly-once carry of previous completed Work result plus current interrupted work trace.
- R6: The Work prompt must lead with an unambiguous execution-only role and real-action instructions (read source, change code, commit/push, GitHub Actions as required); it must not begin with a reviewer handoff preamble, and must never require the Work session to report another review `MAHAYANA_TASK_REPORT_V1`.
- R7: Replace the abnormal Work recovery heading `验收会话最终给出的本轮提示词` with a neutral executing-task heading; keep existing current-task/previous-result/interrupted-trace/original-goal precedence and ownership boundaries.
- R8: Preserve the raw original goal, attachment context, prior Work result and abnormal carry distinctly labeled as reference/evidence, not an independently authoritative directive.
- R9: Explicitly avoid removing technical uses of `next` / `review` (e.g. a named source symbol, JSON status, acceptance evidence) and do not drop paragraph text or ordered steps.
- R10: Tests must cover the user screenshot handoff, variants `下一轮继续由 Work 实施`, `本验收会话不直接修改代码`, `失败只交回 Work 修...`, direct normal plans, legacy stored next, abnormal recovery, Review contract, empty meta-only plan, exact identity checking and goal-edit behavior.
- R11: No local tests: only exact-head GitHub Actions tests. Merge and publish from canonical main only after current-HEAD success; verify main Test, Release, tag and published asset before marking delivered.

## 5. Current state

`plannerPrompt()` uses `下一轮的具体工作安排` as a quoted value hint; `parseReview()` verifies only that nonempty `next` exists; `finish()` stores it verbatim; `workPrompt()` emits `task.next || task.goal` as the first instruction, and abnormal recovery labels it as text from the acceptance conversation. This creates direct role contamination.

## 6. Target state

Review requests `next` as a concrete **current execution directive**. Review parser validates/normalizes it → `finish()` stores a safe execution plan → `workPrompt()` re-normalizes persisted plans and starts with explicit implementation role → Work executes and returns a natural result → Review checks actual evidence. No extra Work is dispatched for an invalid/empty Review plan.

## 7. Architecture and ownership boundaries

`parseReview()`: report contract validation and normalization only.
`finish()`: existing phase/round transitions.
`workPrompt()`: current implementation role, task precedence, backward-compatible persisted-plan normalization.
`plannerPrompt()`: independent verification/reporting only.
`previousWorkResultContext()` and abnormal carry stay supporting evidence; their content does not supersede the current execution plan or original goal.

## 8. Interfaces / contracts / schemas / data flow

Keep `{taskId,round,status,summary,next}` and persisted `task.next` shape unchanged. Add pure helper `normalizeWorkExecutionPlan(raw)` used by `parseReview()` and `workPrompt()`. Work prompts maintain `[Fabushi:<task.token>]` identity and natural-language result requirement; Review prompts keep `MAHAYANA_TASK_REPORT_V1` exact-identity JSON. No new storage keys.

## 9. Constraints and non-functional requirements

Normalization is deterministic, bounded, synchronous and zero-DOM. Keep GitHub SHA/path and technical requirements untouched. Narrowly match reviewer role/preamble phrases only; do not globally delete `Work`, `Review`, `验收` or `next` technical data. No extra transcript duplication.

## 10. Failure modes and edge cases

- Screenshot plan: remove handoff/read-only premise, keep `第一步重新读取 main、tdesktop/dev、PR...` and subsequent steps.
- `下一轮第一步...` → direct `第一步...` in current execution; `下一轮交由 Work...` → no reviewer frame.
- `失败只交回 Work 修真实 production...` → `失败修复真实 production...`, preserving the conditional.
- No actionable content left after stripping meta-only narration → Review repair, no Work dispatch.
- `验收证据`, `Review API`, file names, hashes and valid technical steps must survive.
- A user-specified *original goal* containing a phrase such as `下一轮` is not silently altered.
- Legacy `task.next` loaded from storage is cleaned immediately before Work send, even if already queued.
- Abnormal Work continuation retains all existing progress/evidence material and does not re-identify the session as reviewer.

## 11. Implementation strategy

1. Introduce the pure narrow handoff normalization helper near prompt/report generation.
2. Update Review's response JSON instruction to require action-only `next`; normalize it at parser boundary and reject empty.
3. Use the helper for both normal and interrupted Work; put explicit execution role first; remove the old abnormal-review heading.
4. Add focused tests for handoff and negative cases; adapt only expectations of changed prompt headings.
5. Document the behavior/version v2.10.30 in README and update PR description.

## 12. Verification / test strategy

GitHub Actions only: `node --check chatgpt-auto-confirm.user.js`, `npm test` including all existing tests and new role-boundary cases; current PR exact head, canonical-main Test and Release provenance. Do not inherit an earlier successful run from another SHA.

## 13. Acceptance criteria / Definition of Done

- AC-1: The screenshot-like Review `next` is transformed into a direct Work task, with all technical steps intact and without role-handoff/read-only-review commands.
- AC-2: Work prompts have unambiguous implementation role in both normal and abnormal paths; no old reviewer heading remains. Work still produces natural-language actual results, not reviewer JSON.
- AC-3: New Review template discourages misleading wording; invalid meta-only Review results fail closed; existing exact task/round checks and real goal edits remain correct.
- AC-4: Previous Work result, original goal, attached assets, abnormal carries and GitHub evidence remain intact.
- AC-5: Current PR GitHub Actions Test success; after merge canonical-main Test and Release success, version/tag/asset verified.

## 14. Release / migration / rollback

No persisted schema migration. On-use normalization supports legacy `next`. Integrate with pending v2.10.30 PR #148 (v2.10.29 is current main); if validation is incomplete, leave as draft. Rollback to v2.10.29 and mark both fixes unshipped.

## 15. Observability / evidence

Record exact PR head and test/job results; canonical main and Release/tag/artifact after integration. Screenshots are symptom evidence, not proof of live fix. No claim of authenticated live UI reproduction without DOM proof.

## 16. References / provenance

- User screenshot, 2026-10-08, current Work chat contains reviewer narration `下一轮交由 Work 实施，本验收会话继续只读`.
- `chatgpt-auto-confirm.user.js` v2.10.30 PR #148, `workPrompt()`, `plannerPrompt()`, `parseReview()`, `finish()`.
- `docs/specs/previous-work-result-next-round-carry-v2.9.91.md`
- `docs/specs/review-final-result-recognition-v2.10.23.md`
- `docs/specs/spec-first-ai-development.md`

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1–R10, AC-1–AC-4 | blocked | Implementation and current-head regression evidence pending. |
| R11, AC-5 | blocked | Exact-head Test, integration and release provenance pending. |
| Live authenticated screenshot regression | blocked | Screenshot is available; DOM of affected session was not captured. |
