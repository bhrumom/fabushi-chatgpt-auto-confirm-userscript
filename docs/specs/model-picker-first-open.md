# First model selection must wait for hydration

Status: active
Owner: canonical standalone userscript
Last updated: 2026-10-10

## Problem and goal
User observes burst clicks at the initial model selector suppressing the reasoning slider; later single opening succeeds. Version 2.10.40 still has an unpaced direct trigger click in openModelRadioList and reasoning recovery reopens after only 120ms. Remove first-open bursts and preserve an already-open hydration surface.

## Requirements
- R1: Every model trigger interaction, including initial radio-list opening, uses the paced single-click helper. Initial model menu and radio-list hydration also wait up to two seconds before reopening.
- R2: Before recovery reopens the reasoning menu, poll the already-open surface for up to two seconds. Activate a distinct Strength entry at most once per acquisition. Never toggle it repeatedly while it hydrates.
- R3: After selecting/verifying the model, dismiss the radio list once and leave the subsequent reasoning opening quiet while its slider mounts. Preserve exact selected model and reasoning-index verification before Send.
- R4: Keep bounded recovery for stuck overlays and fail closed on missing controls; no duplicate Send.
- R5: Test with real first model selection followed by delayed slider mounting. Record trigger timestamps, enforce minimum interval and assert no reopen before hydration settles. Inspect native Chrome in a newly opened page; do not send a task during menu-only manual reproduction.

## Architecture and implementation
Canonical userscript owns menu transitions. Use existing pacedModelPickerClick for all triggers and a bounded waitForReasoningSlider helper shared by initial acquisition and slider reappearance. Keep existing overlay dismissal compatibility.

## Verification and acceptance
Full Node regression, syntax/diff, exact-head GitHub Test; native Chrome single-open/repeated-open observations and installed version readback. Release and longer live behavior are separate gates.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1-R4 | passed | Initial raw trigger click removed; radio/menu hydration and reasoning acquisition poll up to two seconds; Strength activated once; existing model/radio/index/Send guards retained. Syntax and diff check passed. |
| R5 native reproduction | passed | New ChatGPT page on installed Mac: single trigger click showed Medium, 2 of 5 and Strength; rapid double click left the menu absent; another single click restored it. Selecting GPT-5.6 Sol returned to the Strength surface. No prompt sent. |
| R5 regression and installed update | passed | Runtime commit effe3994d476f136d280703f36d1486822f592ed: Actions 38018524852 passed (382 passed, 0 failed, 7 existing skips), including actual model then delayed strength acquisition. Native Fabushi management read back 2.10.41 enabled after import. |
