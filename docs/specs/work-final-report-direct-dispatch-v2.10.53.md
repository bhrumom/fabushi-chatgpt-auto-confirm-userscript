# Work Final Report Direct Dispatch — v2.10.53

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Last updated: 2026-10-16
Related issue/task/PR: User request 2026-10-16; implementation branch codex/direct-work-report-dispatch

## 1. Context / problem

The current userscript runs continuous goals as a Work -> independent Review -> Work loop. After Work finishes, the script opens a second ChatGPT conversation for Review, waits for a Review JSON report, then opens another Work conversation. This extra conversation is the failure boundary the user wants removed: the automation can become stuck waiting for a Review final reply even though the Work conversation has already produced its final answer.

The existing Review output contract is already a useful machine-readable report: `MAHAYANA_TASK_REPORT_V1` with `{taskId,round,status,summary,next}`. The desired architecture is to move that final-report contract into the Work prompt itself. Work must execute the task, perform its own evidence/completion check, and make its final reply exactly that report. The userscript then parses the Work final reply directly and either marks the task complete or immediately queues the next Work round.

## 2. Goal

Eliminate the independent Review/acceptance conversation from the runtime lifecycle. Every new task and every subsequent round remains in the Work phase. The Work prompt contains the final report template and requires the executing model to output that template as its final reply. The script directly recognizes the Work report, stores `next` unchanged, and dispatches the next Work conversation without an intervening Review conversation.

## 3. Non-goals / out of scope

- No post-generation rewriting, filtering, or sanitization of `summary` or `next`.
- No second Review/planner conversation after a Work final reply.
- No change to authorization, Chat-mode enforcement, model/reasoning selection, attachment handling, task ownership, or existing abnormal-session recovery except where Review-specific branches must be generalized to the Work report.
- No removal of exact taskId/round identity fencing.
- No local/device build or test; verification remains GitHub Actions.

## 4. Requirements

- R1: `workPrompt()` must require actual execution first and a final `MAHAYANA_TASK_REPORT_V1` JSON reply containing the exact current `taskId` and `round`.
- R2: `status=complete` must contain evidence-based `summary` and an empty-string `next`.
- R3: `status=next` must contain factual `summary` and a directly executable `next` beginning with an immediate action; it must not be a session-routing instruction.
- R4: The parser must validate report shape and exact task identity. For the new contract, `next` is a string and is empty for `complete`.
- R5: `finish()` must parse the Work final report directly. For continuous goals, `complete` ends the task; `next` increments the round, keeps phase=`work`, stores `next` unchanged, clears the old conversation identity, and queues the next Work send.
- R6: A malformed Work final report must not create a Review conversation. It gets a bounded Work-phase repair/fresh-chat recovery while preserving the actual final reply as progress context.
- R7: Existing persisted `phase=review` tasks must migrate to `phase=work`. Active legacy Review conversations may continue to be inspected under the Work report contract; queued legacy Review records must never schedule a new Review prompt.
- R8: Review-specific final detection and connection-interruption recovery must be generalized to the Work report where they protect final-reply recognition, including marker-virtualized exact-route recovery.
- R9: Remove the unused Review planner prompt and Review-only UI/state labels from active runtime behavior. New tasks must never enter `phase=review` or `state=reviewing`.
- R10: Add regressions covering direct Work report parsing, complete/next lifecycle, malformed-report repair, marker-virtualized report recognition, legacy Review migration, and the absence of a planner/Review dispatch path.
- R11: The generated `chatgpt-auto-confirm.user.js` must remain byte-for-byte consistent with `src/manifest.json`; GitHub Actions Test is the verification authority.

## 5. Current state

Canonical main at the start of this change is `d28519e90f4a422b4cd8143d6ce5b5706e5f62fd`, runtime version `2.10.52`. The runtime has `workPrompt()`, `plannerPrompt()`, `parseReview()`, and a `finish()` branch that sends every continuous Work result into `phase=review` before a later Review result returns to Work. The UI and scheduler also retain `reviewing` state labels.

## 6. Target state

A task has one execution phase: `work`. A Work conversation is responsible for both execution and final self-verification. Its final reply is a machine-readable `MAHAYANA_TASK_REPORT_V1` report. The script recognizes that report on the exact task route, parses it without rewriting it, and immediately performs the existing state transition: `complete` -> done; `next` -> round+1, phase=work, queued, then dispatch `workPrompt()` in a new conversation. There is no independent Review conversation.

## 7. Architecture and ownership boundaries

- ChatGPT Work owns execution, evidence checking, and authoring the final report.
- The userscript owns only transport/state safety: exact task/round identity, DOM ownership, final-reply recognition, parsing, persistence, and dispatch.
- The userscript does not decide whether the task is actually complete beyond trusting the Work-authored report after exact identity/schema validation; it does not rewrite report prose.
- Existing authorization, task ownership, pause, cooldown, and send de-duplication remain authoritative.

## 8. Interfaces / contracts / schemas / data flow

Fixed report schema:

`{"taskId":"<current task id>","round":<current round>,"status":"complete|next","summary":"<evidence>","next":"<empty for complete; direct actions for next>"}`

Flow:

1. Queue task with `phase=work`.
2. Send `workPrompt()` containing current execution instruction and final-report contract.
3. Inspect the bound conversation.
4. When a stable final reply is observed, parse the exact current report.
5. `complete`: persist/log and finish.
6. `next`: persist `next) unchanged, increment round, clear old conversation identity, and queue a new Work prompt.
7. If parsing fails, bounded Work-phase repair/fresh-chat recovery retries without creating a Review phase.

## 9. Constraints and non-functional requirements

- Preserve exact taskId/round fencing and fail closed on foreign reports.
- Preserve existing final-reply stability and marker-virtualization safety gates.
- Do not introduce a new broad DOM scan merely to find the report.
- Do not build/test on Mac, Windows, or bhrum2.
- Do not weaken existing CI gates.
- Keep generated artifact synchronized by the repository's existing build/check contract.

## 10. Failure modes and edge cases

- Wrapped JSON or a response containing quoted historical reports must select the exact current taskId+round.
- A complete report with a non-empty `next` is invalid and is repairable.
- A next report without `next` is invalid and is repairable.
- A report for another task/round never completes the current task.
- If the Work marker is virtualized, exact-route plus the existing safe recovered transcript path may prove the current report; foreign task markers still fail closed.
- A connection-interrupted banner must not force a fresh chat if the same Work conversation already contains a stable valid current report.
- Persisted old `phase=review` records are normalized to `work` and never receive a new Review prompt.
- A malformed final report must not be treated as task completion and must not silently discard the malformed reply.

## 11. Implementation strategy

1. Add this Spec before runtime changes.
2. Generalize the existing report parser from Review semantics to Work/final-report semantics.
3. Put the report contract into `workPrompt()` and remove `plannerPrompt()` dispatch.
4. Rewrite `finish()` around direct Work report parsing and direct next-round Work queueing.
5. Generalize report-aware final detection and connection-interruption recovery.
6. Add legacy phase/state migration and remove active Review state labels.
7. Update focused regressions and documentation.
8. Materialize the generated userscript through the repository's existing CI/build contract and verify exact-HEAD GitHub Actions.

## 12. Verification / test strategy

GitHub Actions Test must verify generated-source freshness, JavaScript syntax, and the complete Node/JSDOM regression suite. Focused tests must prove:

- Work prompt contains the exact final report contract and current identity.
- Work final `complete` ends continuous tasks.
- Work final `next` stores `next) verbatim and queues round+1 Work directly.
- malformed reports are repaired in Work phase without Review/planner dispatch.
- exact taskId/round report wins over quoted historical reports.
- marker-virtualized Work reports can finish through the existing safe exact-route recovery.
- persisted Review-phase tasks migrate to Work.
- no runtime path calls `plannerPrompt()` or transitions Work -> Review.

## 13. Acceptance criteria / Definition of Done

- AC-1: No new task can enter `phase=review`; continuous Work final replies directly drive complete/next state transitions.
- AC-2: `workPrompt()` contains and enforces the final report template; final human-readable fields are required to be evidence/action oriented rather than session-routing prose.
- AC-3: Report parsing remains exact-task/exact-round and does not mutate report text.
- AC-4: Malformed Work reports recover without opening a Review conversation.
- AC-5: Legacy Review records are migrated safely to Work.
- AC-6: Focused and full GitHub Actions Test pass; generated bundle is current.
- AC-7: Current main/PR-head evidence is recorded before claiming delivery.

## 14. Release / migration / rollback

Runtime version increments from `2.10.52` to `2.10.53`. Existing queued `phase=review` tasks are migrated in-place to `phase=work`; no user goal or attachment is deleted. Active legacy Review routes are not resent; they are inspected as Work/report conversations after migration. If rollback is needed, revert the implementation commit(s) and generated artifact to the previous tested main.

## 15. Observability / evidence

Log messages must identify direct Work report completion or next-round queueing without claiming a separate Review phase. Existing task history/session URLs remain display evidence. CI run IDs, PR head, generated-bundle freshness, syntax, and full test results are the delivery evidence.

## 16. References / provenance

- Current canonical main: `d28519e90f4a422b4cd8143d6ce5b5706e5f62fd`.
- `docs/specs/review-work-executable-handoff-v2.10.30.md` (superseded by this architecture for the userscript runtime; its report schema is retained).
- `src/runtime/send-and-navigation.inc.js`.
- `src/runtime/reply-and-approval.inc.js`.
- `src/runtime/review-and-settlement.inc.js`.
- `src/runtime/workspace-ownership.inc.js`.
- `test/final-reply-handoff.test.mjs`.
- User request dated 2026-10-16.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1–R11 | pending | Implementation and exact-HEAD GitHub Actions verification pending. |
| AC-1–AC-7 | pending | Implementation and exact-HEAD GitHub Actions verification pending. |
