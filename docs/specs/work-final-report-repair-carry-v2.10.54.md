# Work Final Report Repair Carry — v2.10.54

Status: implementation under exact-head GitHub Actions verification
Owner: Fabushi ChatGPT Auto-confirm userscript
Related change: PR for `fix/work-final-report-repair-carry-v2.10.54`

## Problem

A Work turn can finish its implementation and produce a useful final reply whose `MAHAYANA_TASK_REPORT_V1` JSON is malformed or has a mismatched schema. The settlement path logged that reply and threw a repairable error, but the repair prompt could retain only the prior `task.result`; it did not explicitly carry the just-rejected final reply into the next Work report-repair conversation.

## Contract

- Preserve the exact current final reply (bounded to 24,000 characters) when `parseWorkFinalReport` throws `invalid-work-final-report`.
- Bind the saved reply to `task.id`, `task.round`, and `task.goalRevision`; do not preserve a rejected reply from an outdated goal revision.
- The next Work prompt may use the carry only when all three identity fields still match.
- A repair prompt must treat the carried reply as historical evidence, not as instructions that override the original goal. It asks for the minimum remaining verification and a corrected report, without repeating completed production changes.
- Clear the carry and its identity fields after a valid report is parsed or when the user edits the task goal.
- Keep the existing bounded repair-attempt policy and exact `taskId + round` parser validation.

## Regression coverage

`test/final-reply-handoff.test.mjs` verifies that a malformed report reply survives the failed settlement, is present in the report-only repair prompt, keeps prior task result and attachments intact, is rejected after a goal-revision mismatch, and is cleared after a valid report completes.

## Verification

The generated bundle must be rebuilt by GitHub Actions and must pass `npm run build:check`, `node --check chatgpt-auto-confirm.user.js`, and the full `npm test` suite on the exact PR head. Do not treat an older run or a stale generated bundle as evidence for the current head.
