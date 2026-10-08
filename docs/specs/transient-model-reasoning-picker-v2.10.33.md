# Transient model / reasoning picker reopening — v2.10.33

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Date: 2026-10-08

## Reported failure

The signed-in ChatGPT composer exposes one button for the model/reasoning picker. Its overlay can switch asynchronously between the reasoning-strength slider view and model radio list; the `强度` / `Medium` view may briefly disappear, leaving only the `GPT-6`, `GPT-5.6 Sol`, `GPT-5.5` list. When the required strength control is absent, the user has to click the same picker button again, sometimes repeatedly, to make it appear. On v2.10.32, `ensureTaskReasoningPreset()` reads the slider once immediately after opening and immediately fails when it is absent, even if the model menu was just changing. `openModelRadioList()` similarly assumes the first-level `选择模型` row remains stable throughout the transition.

User screenshot (2026-10-08 14:01) shows the model-list state beneath an `极高` trigger after the transient state. The 2026-10-08 authenticated Mac inspection confirmed the actual accessible structures:
- top button `选择 ChatGPT 模型`
- first-level menu `选择 ChatGPT 模型`, menuitems `强度` and `选择模型`, with `[data-reasoning-slider=true]` and `[role=slider]` in the strength state
- model submenu `menuitemradio` rows for GPT-6, GPT-5.6 Sol, GPT-5.5 (last has retirement annotation), selected via `aria-checked=true`
- pressing Escape on the expanded picker can close the model menu; clicking the trigger alone while the model submenu is open may leave that submenu visible, so a single toggle is insufficient.

## Goal

Boundedly retry and actively reacquire the desired menu surface (model radio list or reasoning slider), including clicking the composer trigger again when the view disappears or the other view is showing. Never proceed to Send without confirmed target model and target reasoning preset.

## Requirements

1. Keep the dispatch order Chat mode → verified model → verified reasoning → attachments → prompt → Send.
2. Preserve the model radio `aria-checked=true` as authoritative proof, including after switching; do not approve based solely on the first-level `5.6` text.
3. Reacquire the model list after temporary disappearance, allowing a delayed `选择模型` entry or a delayed radio list. In bounded attempts, close/reopen the picker through the same composer button and retry the submenu, without clicking the wrong model or submitting the prompt.
4. Reacquire the reasoning slider when `reasoningSliderState()` initially returns null; if a model radio overlay is visible, dismiss it and reopen the strength view. If no strength control appears, retry the trigger in a bounded loop rather than declaring permanent unavailability.
5. During slider adjustment, if the current slider is replaced by a model overlay or disappears, reopen the strength view and re-read the authoritative current slider value, then continue with a bounded number of steps. Do not blindly replay previous arrows.
6. Re-select only the `强度` first-level menuitem when that entry is visible and the slider is genuinely absent. Never interpret a model radio list as a strength slider.
7. Treat evidence from the currently connected, visible picker only: reject sidebar/transcript buttons, stale detached DOM and Fabushi workbench controls.
8. Re-check task ownership, abort signal, and current menu state between retries. Retain the exact prepared task; no duplicate Send.
9. Use fixed small retry budgets, adequate hydration waits, and the existing `waitForReasoningPicker()` recovery path when unavailable. No infinite spinning or unbounded clicks.
10. Preserve legacy closed-trigger fast paths when there is unambiguous `data-selected-reasoning-effort` evidence, but never use weak text as proof of unconfirmed model.
11. GitHub Actions only for syntax and regression tests; no local Mac build/test. Capture current exact HEAD, CI and publication evidence.
12. Bump userscript runtime, metadata, README and version regressions to v2.10.33.

## Regression matrix

- R-A: Delayed hydration of first-level `选择模型` recovers without premature missing-model failure.
- R-B: First model submenu becomes unavailable, subsequent click on the same picker allows `menuitemradio` visibility; model selection succeeds only after `aria-checked=true`.
- R-C: Strength slider absent when opening picker, initial menu is radios or another state; subsequent trigger click exposes slider and target is verified.
- R-D: Slider vanishes during arrow adjustment; control is reacquired, current index is re-read and remaining change completes exactly.
- R-E: Permanently missing radio or slider remains fail-closed with no task Send and existing navigation recovery unchanged.
- R-F: Prior tests for Work/Chat mode, default GPT-5.6 Sol, 5-level reasoning, transfer, attachments, and Review contract remain green.

## Definition of done

Only GitHub Actions Test on the final PR exact HEAD, a green canonical-main Test after merge, and release/tag asset SHA evidence justify calling v2.10.33 published. Mac menu inspection is observation only; no live task Send should be performed on the user's active session.
