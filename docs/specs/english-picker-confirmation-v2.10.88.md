# English composer picker confirmation

Status: active
Owner: standalone ChatGPT userscript
Date: 2026-11-02

## Problem and evidence
The user reports repeated model selection before dispatch in an English incognito ChatGPT tab. Native inspection shows the closed composer trigger has textContent `Thinking effortPro`, aria-label `Select ChatGPT model`, aria-expanded=false, data-composer-navigation-target=reasoning and data-selected-reasoning-effort=medium. Opening it natively exposes Pro at slider index 4. Runtime read-only diagnosis shows closedComposerModelHint returns null even though reasoningSliderState reads index 4. The model confirmation cache requires a recognized closed model hint, so retries invalidate the same verified model. Reasoning confirmation also ignores the explicit Pro text and requires reopening the slider each time. English first-level strength is labelled `Power`, which the existing recovery label list omits.

## Requirements and acceptance
- R1/AC1: Parse known `Thinking effort` / `思考强度` presentation prefixes separately from the exact selected value, including concatenated and whitespace-separated markup. The English `Thinking effortPro` value yields the same ready GPT-6 hint as Pro. Do not infer a model from a blank, generic, loading, unknown or extended arbitrary label.
- R2/AC2: Reuse existing same-task/token/revision/route/connected-trigger authoritative radio proof when the corrected ready closed hint matches. Task/model/route/trigger changes or an open model popup invalidate reuse. No trust in persisted confirmation timestamps alone and no bypass of radio verification on initial dispatch.
- R3/AC3: When the enabled closed composer explicitly displays exactly Pro or Medium (localized 中) and effort=medium, accept only the matching reasoning preset. Never confuse the two through the shared medium effort attribute. Empty/generic/unrecognized text or a conflicting effort must continue to use verified slider logic. An open menu cannot take this fast path. Recognize Power alongside Strength/强度 in bounded slider recovery.
- R4/AC4: Preserve pause/ownership, generation/approval, task identity, prepared prompt, selected model/preset, Send dedupe and safe dismissal. Do not add usage-limit detection or change workspace-banner handling. Test repeated preflight without repeated model/slider clicks, plus negative identity and label cases. Validate parity, syntax and full regressions in Actions, then normal release/update and original-task observation.

## Architecture / plan
The composer adapter owns a normalized selected-label helper. Existing model hints and model proof reuse consume it; reasoning preflight uses exact closed Pro/Medium labels only when the semantic effort agrees. All initial model radio and final Send guards remain unchanged. No new timer, state schema, fallback model or storage migration. Rollback reverts source, bundle, tests and version together.

## Verification / provenance
Related specs: model-picker-close-v2.10.64.md, transient-model-reasoning-picker-v2.10.33.md and live-nested-model-menu-v2.10.32.md. The new exact-label reasoning confirmation supersedes only the old prohibition on inferring Pro/Medium from the ambiguous medium effort alone; that prohibition remains. The task was temporarily paused during diagnosis to stop repeated menu operations, and must be restored after update without duplicate dispatch.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R4 | pending | Implementation and Actions pending. |
