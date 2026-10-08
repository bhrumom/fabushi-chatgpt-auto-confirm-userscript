# Per-task ChatGPT model selector and pre-send verification — v2.10.31

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Last updated: 2026-10-08
Related user request: add a model selector beside the existing reasoning selector, default to GPT-5.6 Sol, switch the live ChatGPT composer model accordingly, and verify the selected model before Send

## 1. Context / problem

The Fabushi workbench currently stores and enforces a per-task ChatGPT reasoning preset (即时 / 中 / 高 / 极高 / Pro), but it does not expose a separate model choice. On the user's signed-in ChatGPT UI, the model picker visibly offers at least `GPT-6`, `GPT-5.6 Sol`, and `GPT-5.5`. The selected model is reflected in the composer model trigger and the popup marks the active choice.

As a result, a task configured for a reasoning level can still be sent under whatever model the ChatGPT page happens to have selected. This is unsafe for reproducibility: the user wants Fabushi to default new tasks to GPT-5.6 Sol, allow choosing another supported model in the workbench, actively switch ChatGPT's composer model, and fail closed unless the target model is confirmed before Send.

Mac inspection on 2026-10-08 confirmed the visible product labels `GPT-6`, `GPT-5.6 Sol`, and `GPT-5.5`; the user also supplied screenshots showing the current model menu and the selected-model checkmark. Because the available browser-control path did not expose a stable raw page-DOM dump for the authenticated tab, implementation must rely on the same visible semantic menu/trigger signals already used by the reasoning selector rather than an invented CSS class.

## 2. Goal

Add a per-task model selector next to the reasoning selector, default it to GPT-5.6 Sol, persist the choice with the task, and enforce this dispatch order before every new Send:

1. verify Chat mode (not Work mode);
2. verify/switch the requested ChatGPT model;
3. verify/switch the requested reasoning preset;
4. upload attachments;
5. fill and Send the prompt.

No task may be sent if the requested model cannot be found or confirmed.

## 3. Non-goals / out of scope

- Do not change ChatGPT subscription/entitlement or expose models not visible to the current account.
- Do not bypass unavailable-model UI.
- Do not infer a model from colors, pixels, menu order, or unrelated transcript text.
- Do not change existing conversation inspection/finality logic.
- Do not change Review/Work role semantics introduced in v2.10.30.
- Do not run builds/tests on Mac; verification is GitHub Actions only.
- Do not use the Mac for repository builds or persistent local checkout changes.

## 4. Requirements

- R1: Define supported workbench model presets with stable internal keys and visible labels for at least `GPT-5.6 Sol`, `GPT-6`, and `GPT-5.5`.
- R2: New tasks default to `GPT-5.6 Sol`; the workbench default model is persisted independently from the reasoning default.
- R3: Add a model `<select>` beside the existing reasoning selector in the Fabushi workbench. The reasoning selector keeps its existing default `极高`.
- R4: Each task stores its selected model; subsequent Work/Review rounds for that task preserve the same model unless the user creates a new task with another default.
- R5: Before Send, inspect the existing composer model/reasoning trigger. If its closed visible label already identifies the target model (for example `GPT-5.6 Sol` or the product's compact `5.6` form), accept it without mutating the UI.
- R6: If the current model differs, open the model menu and find a visible interactive option by exact supported product label/aliases. Do not use broad substring matching that could select a different version.
- R7: Activate only the target option, then re-read the composer trigger until the target model is confirmed. A click alone is never sufficient proof.
- R8: If the target option is absent, disabled, menu hydration is ambiguous, or the post-click trigger cannot confirm the model, fail closed using the existing send-UI/reasoning-picker recovery path; never click Send.
- R9: Model enforcement runs after `ensureChatMode()` and before `ensureTaskReasoningPreset()`, because changing model may change/reset the reasoning surface. Reasoning is therefore always the final model-dependent setting verified before attachment/send.
- R10: Keep model detection scoped to the composer model picker/menu. Ignore transcript references such as “GPT-5.6” in user/assistant messages.
- R11: Persist the default model in the lean workbench snapshot and the selected model in each task. Legacy tasks without the field normalize to GPT-5.6 Sol.
- R12: Expose task details showing both model and reasoning preset so the user can confirm the queued task configuration.
- R13: Preserve host/API compatibility: callers that omit model use GPT-5.6 Sol; callers may pass a supported model key/label and it is normalized safely.
- R14: Add focused regressions for default model, already-selected 5.6, switching 5.6 -> GPT-6, switching another model -> 5.6, absent/disabled target, post-click mismatch, transcript false positives, per-task persistence, UI selector presence, and pre-Send ordering.
- R15: Bump userscript/runtime/README/version assertions to 2.10.31.
- R16: Deliver only after exact-head GitHub Actions Test succeeds, then merge and verify canonical-main Test plus Release/tag/asset provenance.

## 5. Current state

The workbench has `REASONING_PRESETS`, `defaultReasoningPreset`, per-task `reasoningPreset`, `reasoningPickerTrigger()`, `ensureTaskReasoningPreset()`, and a reasoning `<select>`. Dispatch currently calls `ensureChatMode()` followed immediately by `ensureTaskReasoningPreset()`. The reasoning picker trigger is also the semantic entrypoint for ChatGPT's model/reasoning menu.

## 6. Target state

The task record contains both `modelPreset` and `reasoningPreset`. The workbench composer shows model and reasoning controls side by side. On dispatch, the script proves the current ChatGPT composer model equals the task model, switches if necessary, then proves the reasoning level, and only then uploads/fills/sends.

## 7. Architecture and ownership boundaries

- Workbench/task state owns the user's requested model.
- `ensureTaskModelPreset()` owns ChatGPT model UI observation/activation.
- `ensureTaskReasoningPreset()` remains the reasoning owner.
- `send()` owns ordering and Send gating.
- No host, extension, backend, or external model API is involved.

## 8. Interfaces / contracts / schemas / data flow

Add:
- `MODEL_PRESETS`
- `DEFAULT_MODEL_PRESET`
- `normalizeModelPreset(value)`
- `modelPresetLabel(value)`
- `taskModelPreset(task)`
- `modelMenuOption(target)`
- `modelTriggerMatches(trigger, target)`
- `ensureTaskModelPreset(task, signal)`

Task field: `modelPreset` (stable string key preferred; legacy/missing -> GPT-5.6 Sol).
Workbench field: `defaultModelPreset`.
No storage version bump is required if fields are backward-compatible additions.

## 9. Constraints and non-functional requirements

Use bounded DOM scans, exact supported labels, existing `visible`/`enabled` helpers, and the existing picker recovery/fail-closed behavior. Avoid opening/closing the model menu unnecessarily when the trigger already proves the target. Do not add persistent diagnostic history.

## 10. Failure modes and edge cases

- Trigger says `GPT-5.6 Sol` or compact `5.6`: accept 5.6.
- Trigger says `GPT-6`, target is 5.6: open menu, select 5.6, verify trigger changed.
- Target option missing because account lacks model: do not Send.
- Target visible but disabled: do not Send.
- Click is ignored: do not Send.
- Menu contains transcript/sidebar text “GPT-5.6”: ignore because only interactive menu scope is searched.
- Model switch changes reasoning slider: model first, then re-verify reasoning.
- Legacy task: default to 5.6.
- Review round: same task model remains in force.

## 11. Implementation strategy

1. Add model preset normalization/state near reasoning preset definitions.
2. Reuse the existing composer picker trigger and add exact model trigger/menu helpers.
3. Implement model enforcement and insert it into `send()` before reasoning enforcement.
4. Extend task/default persistence and workbench UI.
5. Extend test harness and focused model-selection regressions.
6. Update README/version assertions.

## 12. Verification / test strategy

GitHub Actions only:
- syntax check;
- full `npm test`;
- focused model tests in `test/workbench.test.mjs`;
- exact PR-head Test;
- after merge, canonical-main Test;
- automatic Release v2.10.31 and asset provenance.

## 13. Acceptance criteria / Definition of Done

- AC-1: Workbench visibly offers model selection beside reasoning and defaults new tasks to GPT-5.6 Sol / 极高.
- AC-2: Selecting GPT-6 or GPT-5.5 results in ChatGPT's composer model being switched and verified before Send.
- AC-3: Selecting/defaulting GPT-5.6 Sol recognizes an already-selected 5.6 trigger without unnecessary mutation and can switch back to 5.6 from another model.
- AC-4: Any unconfirmed/unavailable target blocks Send.
- AC-5: Task model persists across Work/Review rounds and reload.
- AC-6: Exact-head/main/release evidence is green and published v2.10.31 matches canonical source.

## 14. Release / migration / rollback

Backward-compatible field addition. Legacy tasks/defaults resolve to GPT-5.6 Sol. Release as v2.10.31. Rollback to v2.10.30 if model enforcement proves incompatible with a new ChatGPT renderer.

## 15. Observability / evidence

Record PR head, Test run/job, canonical main SHA, main Test, Release run, tag and asset digest. Mac visual/accessibility observation establishes product labels, while automated DOM fixtures establish the selector contract; a later authenticated live send can provide additional production evidence but is not substituted for CI.

## 16. References / provenance

- User screenshots and explicit request, 2026-10-08.
- Live Mac visible model menu labels: GPT-6, GPT-5.6 Sol, GPT-5.5.
- `chatgpt-auto-confirm.user.js`: `REASONING_PRESETS`, `reasoningPickerTrigger()`, `ensureTaskReasoningPreset()`, `send()`, `enqueue()`, workbench controls.
- `docs/specs/per-task-reasoning-preset-v2.10.7.md`
- `docs/specs/force-chat-mode-before-send-v2.10.29.md`

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1–R15 / AC-1–AC-5 | blocked | Implementation and exact-head tests pending. |
| R16 / AC-6 | blocked | PR/main/release evidence pending. |
