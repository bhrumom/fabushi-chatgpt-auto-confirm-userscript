# Running-task model selection follows the Fabushi workbench — v2.10.35

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Date: 2026-10-08
Supersedes one limitation of: `docs/specs/per-task-model-selector-v2.10.31.md` R4 / AC-5 (the task model is no longer immutable after enqueue).
Related: `docs/specs/transient-model-reasoning-picker-v2.10.33.md`, `docs/specs/sticky-model-popup-outside-dismiss-v2.10.34.md`.

## Context and problem

The existing workbench model dropdown controls only `data.defaultModelPreset`, which is copied into `task.modelPreset` by `enqueue()`. Thus an active Work/Review/continuous task continues using the model selected at its creation even if the user later changes the dropdown in the Fabushi script UI. Its details still show the original model. The user now explicitly requires the *running task's next dispatched round* to use the model selected in the Fabushi task interface, rather than the original pinned model.

The workbench distinguishes `selected` (task shown in the panel) and `current` (scheduler task actually progressing); it supports multiple tasks per tab and recoverable tasks on other tabs. Updating unrelated tasks implicitly would be unsafe.

## Goal

Allow live per-task model changes in the existing Fabushi model selector, with each selected task owning its requested model. Persist changes and enforce them on every future new Work/Review conversation before Send. A model update must not alter or resend an already dispatched ChatGPT turn.

## Requirements

1. When an owned, resumable task is selected in the workbench, synchronize the existing `ChatGPT 模型` dropdown to `task.modelPreset`. A change in this dropdown must immediately update that task's `modelPreset`, persist it, and reflect it in the task detail UI.
2. If no editable task is selected (e.g. `＋ 新任务` or a completed task), the same dropdown controls `data.defaultModelPreset` for future tasks only. Viewing an existing task without changing its dropdown must never silently overwrite its model or change the new-task default.
3. Editing Task A's model never mutates Task B's model, regardless of which is currently running under the tab's scheduler; never mutate tasks owned by another tab. An explicitly selected running task is editable while `waiting`, `generating`, `reviewing`, `queued`, `sending`, `paused`, `blocked`, or `cancelled` as long as it has not completed.
4. The active ChatGPT conversation that was already sent retains its existing model. The new model takes effect at the next *not-yet-dispatched* conversation (Work or Review, including a queued/recovered prepared send); do not restart, cancel or send a duplicate turn merely because the model changed.
5. In `send()`, continue Chat-mode → model → reasoning → attachments → prompt → Send. After awaits and immediately before the final Send click, ensure the task's latest model still equals the model just verified. If the selector changes during preparation, defer safely and re-verify on the next dispatch attempt, keeping its prepared prompt/token and attachments; no Send with stale selection.
6. Whenever a model changes, invalidate transient `modelPresetConfirmedAt/Key` evidence for that task. Continue to require ChatGPT's actual model-radio selection proof (including GPT-6/5.6/5.5 and the existing safe menu recovery). Never mistake the workbench's own model dropdown for ChatGPT's picker.
7. Persistence and resume/rehydration must preserve the latest task model, including continuous Work/Review phase transitions, while `defaultModelPreset` and `reasoningPreset` remain independent. Preserve legacy tasks' GPT-5.6 Sol fallback, default new-task behavior, and API `enqueue_tasks` compatibility.
8. UI must clearly indicate whether the dropdown edits a specific task (next unsent conversation) or the default for new tasks. Selecting a different task or returning to `＋ 新任务` must render the correct value without synthetic change events, unnecessary scrolling or heavy sidebar redraw.
9. Regression tests cover running task changed from 5.6 → GPT-6 (and back / 5.5), next Work/Review send enforcement, task isolation, selection switching, default/new task mode, persistence, a mid-preflight selector change with no stale Send, and preservation of existing model/reasoning/attachment/transfer/review behavior.
10. Syntax and tests must run in GitHub Actions, never on Mac, bhrum2 or local containers. Update runtime/metadata/README and version assertions to v2.10.35; require PR exact-head green Test, canonical main green Test and exact-source Release/tag/asset evidence before calling published.

## Architecture and ownership

- `modelSelect` (Fabushi workbench) edits the **selected task's requested model** when a non-done task from the current tab is selected, and edits `data.defaultModelPreset` otherwise.
- `task.modelPreset` is the durable per-task requested model; later Work/Review rounds reference it directly. It is **not** a per-round snapshot until the `send` preflight begins.
- `send` owns the dispatch-only verification and last-moment version check. `task.modelPresetConfirmedKey` is transient observation, not durable authorization.
- A task's `phase`, `round`, `token`, `url`, prepared prompt and attachment state never change simply because its model was edited.
- `reasoningPreset` remains per-task and independent.

## Failure and race handling

- Model changed while ChatGPT is generating: existing conversation keeps generating; next new conversation applies newly requested model.
- Model changed while awaiting model/strength/attachment controls: the sender must not click Send with the stale confirmed model. It retains the unsent task and retries from its saved intent.
- Selecting another task: updates the dropdown display but does not rewrite either task; a subsequent change affects only the newly selected task.
- Selected task completed or not owned: dropdown reflects the default for new tasks, never mutates completed/foreign tasks.
- Unsupported model in ChatGPT: existing fail-closed picker recovery applies; do not Send.
- Multiple fast changes: latest task preset is authoritative at dispatch; UI changes must survive ordinary paint/save and recovery.

## Verification

GitHub Actions `Test` workflow runs syntax and full Node regression suite. Focused JSDOM tests simulate UI `change` events, selection switches, persistent snapshots and model preflight. No actual prompt is sent on the signed-in Mac.

## Definition of done / Spec compliance

| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R9 | blocked | Implementation and exact-head GitHub Actions validation pending |
| R10 | blocked | PR/main tests, release SHA and asset digest pending |

## Release and rollback

v2.10.35 is a backward-compatible per-task state update; no storage migration beyond preserving the already-supported `modelPreset` key. Rollback to v2.10.34 reverts the ability to change running tasks through the workbench. A failed or incomplete gate is not a published release.
