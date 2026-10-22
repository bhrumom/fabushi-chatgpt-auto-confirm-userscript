# GPT-6 picker completion and inactive views — Specification

Status: active
Owner: standalone ChatGPT auto-confirm userscript
Last updated: 2026-10-22

## 1. Context / problem
The user reports normal GPT-6 selection repeatedly stalls in the model popup while GPT-5.6 works. Live DOM confirms GPT-6 aria-checked=true. Task logs report missing reasoning slider. Synthetic Escape/trigger close can leave the radio popup open. Safe outside dismissal only searches main headings, but the current ChatGPT renderer has headings outside main. Native click on the page heading closed the popup and the original task advanced to a new conversation. The popup retains multiple animated views, including disabled inactive strength controls; these must not establish active state. Usage notices alone do not establish failure of model selection.
## 2. Goal
Complete model selection, reliably close its popup and reacquire the active reasoning control so GPT-6 tasks proceed.
## 3. Non-goals / out of scope
No automatic model substitution, quota handling, pause-on-banner behavior or unrelated task changes.
## 4. Requirements
- R1: Preserve authoritative model radio selection proof, model-before-reasoning-before-Send ordering and chosen GPT-6.
- R2: Model close must attempt safe outside dismissal when Escape and paced trigger toggling leave the radio popup present, even if aria-expanded is false.
- R3: Safe outside targets include inert page headings outside main. Exclude links, buttons, dialogs, menus, composer, nav, sidebar, header, transcript and workbench. Fail closed if none exists.
- R4: Picker options, submenu entries and strength sliders ignore inactive or aria-hidden animated view descendants. Disabled slider controls never count as usable sliders. Do not treat inactive disabled controls as account unavailability.
- R5: Verify popup closure before reporting model success; retain existing bounded retry for transient rendering and no duplicate Send. No new pause behavior.
- R6: Preserve GPT-5.6 and older renderer compatibility.
## 5. Current state
closeModelPickerMenu lacks the existing outside-dismiss fallback; fallback target is main-only; model/reasoning scans ignore inactive-view ancestors.
## 6. Target state
Selected GPT-6 closes via safe heading fallback and reasoning reacquires its active view without radio-menu loops.
## 7. Architecture and ownership boundaries
composer-and-model owns scoped picker visibility, closing and preflight; existing task/send state unchanged.
## 8. Interfaces / contracts / schemas / data flow
Picker-local visibility helper and boolean close confirmation. No durable schema change.
## 9. Constraints and non-functional requirements
Bounded scans, existing safe heading dismissal, no new timer. Local source editing and generated-source synchronization allowed for this fix; executable builds/tests remain GitHub Actions only, superseding the older local-checkout restriction for this task.
## 10. Failure modes and edge cases
Sticky radio portal with aria-expanded=false; no safe heading; animated hidden radio list; disabled inactive strength; explicit selected model; ignored close; older renderer.
## 11. Implementation strategy
Spec, scoped picker visibility, verified outside close and safe heading fallback, behavioral regressions, version bump, CI, merge and installed update.
## 12. Verification / test strategy
Exact-head GitHub Actions full suite and bundle check; main Test and Release; current Chrome installed version and original task progression.
## 13. Acceptance criteria / Definition of Done
- AC-1: Selected GPT-6 sticky popup closes through heading outside main; target is not reselected and active strength is acquired.
- AC-2: Inactive radios/strength do not block active view; unsafe targets excluded and failed close cannot authorize model success.
- AC-3: Existing model/reasoning/GPT-5.6 regression suite passes.
- AC-4: Exact-head CI and release provenance pass; installed runtime verified.
## 14. Release / migration / rollback
v2.10.64; no migration; normal revert release if needed.
## 15. Observability / evidence
CI/release URLs, asset digest and installed/live state below.
## 16. References / provenance
AGENTS.md; per-task-model-selector-v2.10.31.md; sticky-model-popup-outside-dismiss-v2.10.34.md; user clarification and native Chrome DOM/task log on 2026-10-22.
## 17. Spec compliance record
Pending verification.
