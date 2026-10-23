# GitHub delivery prompt-only contract — v2.10.77

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-23
Supersedes: runtime-enforcement portions of `editable-prompt-composition-github-delivery-v2.10.76.md`
Related: `work-final-report-direct-dispatch-v2.10.53.md`; `editable-prompt-composition-github-delivery-v2.10.76.md`

## Problem and user requirement

The GitHub commit/push/remote-readback requirement is an instruction sent to ChatGPT as part of the task prompt. It is not a browser-userscript synchronization primitive.

v2.10.76 incorrectly duplicated that prompt requirement in the page runner: after ChatGPT produced an otherwise valid `MAHAYANA_TASK_REPORT_V1`, the userscript parsed `githubDelivery`, forced the task into `waiting`, displayed “等待 GitHub 提交与远端核验证据”, and could automatically send up to three GitHub-evidence correction prompts. This turns model instructions into a local blocking state and can leave an otherwise resumable continuous goal stuck indefinitely.

The user explicitly requires that the GitHub requirement remain in the prompt sent to ChatGPT, while the userscript itself must not wait on GitHub merely because that prompt contains GitHub delivery requirements.

## Requirements and acceptance

- **R1 / AC1 — Prompt requirement remains.** Newly prepared Work prompts still contain the GitHub commit/push/remote-readback instruction and the `githubDelivery` example in the final-report protocol. The prompt-composition UI still shows that section in the exact preview.
- **R2 / AC2 — No local GitHub delivery state.** `prepareTaskPrompt()` snapshots the exact prompt but does not create `githubDeliveryRequired`, `githubDeliveryPending`, retry counters, response boundaries, or any equivalent page-runner gate.
- **R3 / AC3 — Final reports settle normally.** Once an otherwise valid `MAHAYANA_TASK_REPORT_V1` is recognized, `finish()` follows the existing report status and safety gates. Missing, malformed, or absent `githubDelivery` must not itself change the task to `waiting`, retain the same round for GitHub evidence, or block `status=next` / `status=complete`.
- **R4 / AC4 — No automatic GitHub evidence reminder loop.** The userscript must not automatically compose/send “提交并推送到 GitHub / 回读核验” correction messages after a final report. The special status text “等待 GitHub 提交与远端核验证据” is removed.
- **R5 / AC5 — Legacy stuck tasks self-recover.** Persisted v2.10.76 fields such as `githubDeliveryPending=true` or `githubDeliveryRequired=true` are behaviorally inert after upgrade. They must not recreate the special waiting UI or reminder loop; an already visible valid final report can settle under the ordinary report logic.
- **R6 / AC6 — Real asynchronous safety gates stay intact.** Authorization cards and settlement, active Stop/generation, send confirmation, attachment upload, ownership, rate-limit/blocker handling, navigation fencing, and other existing machine-observable gates are unchanged.
- **R7 / AC7 — Actions-only verification.** Build parity, syntax, and the full regression suite run in GitHub Actions. Regression coverage must prove that the prompt still contains the GitHub instruction while the runner has no local GitHub-delivery wait gate, and that both `next` and `complete` reports without `githubDelivery` advance normally.

## Architecture / plan

1. Keep `githubDeliveryInstruction(task)` and the prompt/report example as prompt text only.
2. Remove page-runner delivery-evidence parsing/state initialization from prompt preparation.
3. Remove the `finish()` interception and the `continuePendingGithubDelivery()` sender/call site.
4. Remove the special GitHub waiting status projection. Do not couple ordinary `waiting` semantics to GitHub text.
5. Preserve legacy fields as ignored input for compatibility; no migration is required for correctness because no runtime branch reads them after this change.
6. Add focused regression tests for prompt presence, no runner gate, `next` settlement, `complete` settlement, and legacy pending-field inertness.
7. Bump the userscript version to 2.10.77 and regenerate the bundled userscript from the source manifest. Verification remains GitHub Actions only.

## Compliance

| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1 / AC1 | passed | `githubDeliveryInstruction(task)` and the final JSON example remain in `workPromptSections()`; focused regression asserts commit/push/readback and `githubDelivery` remain in the generated prompt. |
| R2 / AC2 | passed | `prepareTaskPrompt()` now only snapshots prompt configuration and the prepared prompt; it creates no GitHub-delivery runtime state. |
| R3 / AC3 | passed | `finish()` no longer intercepts reports for GitHub evidence; focused `next` and `complete` regressions settle normally without `githubDelivery`. |
| R4 / AC4 | passed | `continuePendingGithubDelivery()`, the special waiting status, and the automatic evidence-reminder path are absent from source and generated userscript. |
| R5 / AC5 | passed | Regression seeds all v2.10.76 GitHub pending fields and proves they are behaviorally inert while a valid `next` report advances the round. |
| R6 / AC6 | passed | Diff is limited to the GitHub-delivery prompt/runtime split, version metadata, focused tests and docs; existing authorization/send/attachment/ownership safety paths are unchanged. |
| R7 / AC7 | passed | GitHub Actions run `39906604429` on exact head `a3329092d46ef865d6b2f29214d9b8f29473b217`: generated userscript check success, syntax check success, full regression success. |
