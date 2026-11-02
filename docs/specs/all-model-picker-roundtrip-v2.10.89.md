# Supported model round-trip confirmation

Status: active
Owner: standalone ChatGPT userscript
Date: 2026-11-02

## Context / user requirement
After the English picker repair, the user explicitly requires correct switching back from other supported models as well. v2.10.88 normalizes Thinking effortPro, but a compact model prefix such as Thinking effort5.6Pro or Thinking effort5.5Medium still prevents the same reasoning-value fast path and can invalidate model proof. Cover all supported models and real switch-back behavior before final live acceptance.

## Requirements and acceptance
- R1/AC1: Separate a known presentation prefix, an optional supported model marker, and an exact selected reasoning label. Handle GPT-6, GPT-5.6 Sol / compact 5.6, and GPT-5.5 / compact 5.5 with both spaced and concatenated known labels. Unknown/extended/loading labels must not infer ready model or reasoning state.
- R2/AC2: Switching from every supported model to every other supported model and back must verify the requested radio after each change. Keep target model and reasoning preset correct, do not reuse stale model proof across task/model/token/route/trigger changes, and do not repeatedly reopen a confirmed unchanged picker. Repeat checks for Pro and Medium, whose effort values alias.
- R3/AC3: Missing/disabled target or ignored model selection remains fail-closed. A retired model absent from the actual account must not be substituted or treated as selected. Existing generation, authorization, pause, safe dismissal and Send dedupe guards remain. No new usage-limit classification.
- R4/AC4: Full exact-head Actions, main Test, release bytes, installed version and original incognito task progression must be verified separately. Do not call automated model matrices proof that an unavailable account model was used live. The original selected GPT-6/Pro task must be restored after diagnosis.

## Architecture / implementation
Composer adapter parses a normalized picker value and extracts the optional model marker before reading the reasoning label. Model hints accept only full supported marker + exact known reasoning combinations. Initial/switch model confirmation still belongs to the existing checked-radio path; cached proofs remain bound to existing identity and connected-trigger rules. No task/storage migration, new scheduler or automatic fallback model.

## Verification and failure modes
Exercise the complete directed model-pair matrix with both Pro/Medium: original → alternate → original, then repeat same-intent checks without model/strength clicks. Assert exact selected radio, confirmation key, reasoning index, target click count and task model preference at every leg. Include compact labels, invalid suffixes, alias mismatch and missing/disabled/ignored selections, reusing prior negative regressions.

## Release / rollback / provenance
Build on english-picker-confirmation-v2.10.88.md. Publish v2.10.89 through the already authorized repair/release workflow, preserving original task state and prepared prompt. Revert source, bundle and version together to roll back. Record final requirement compliance in the acceptance artifact after live validation.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R4 | pending | Expanded matrix and final live acceptance pending. |
