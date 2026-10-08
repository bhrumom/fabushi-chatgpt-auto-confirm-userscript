# Live nested ChatGPT model menu correction — v2.10.32

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Last updated: 2026-10-08

## Problem

v2.10.31 assumed the target model rows were visible immediately after clicking the composer button named `选择 ChatGPT 模型`. Live inspection on the signed-in Mac shows the current ChatGPT UI is nested:

1. Composer button: accessible name `选择 ChatGPT 模型`, visible text `思考强度`.
2. First popup: menu `选择 ChatGPT 模型` with menuitem `强度` and menuitem `选择模型`.
3. The `选择模型` row is the visible `Medium / 中` row from the screenshot. When GPT-5.6 Sol is selected, its visible text becomes `5.6\n中`.
4. Clicking that row opens the actual model list.
5. The model list exposes `role=menuitemradio` rows:
   - `GPT-6`
   - `GPT-5.6 Sol`
   - `GPT-5.5 将于 10月14日下线`
6. Selection is authoritative through `aria-checked=true`. After switching to GPT-5.6 Sol and reopening the model submenu, `GPT-5.6 Sol` has `aria-checked=true` and GPT-6 has false.

Therefore v2.10.31 can fail to find a requested model because it searches the first popup for model rows instead of entering `选择模型`.

## Goal

Make model enforcement follow the live two-level menu and verify the actual checked radio before Send.

## Requirements

- R1: Click the existing composer model/reasoning trigger.
- R2: If the actual model radio list is already open, use it directly.
- R3: Otherwise find the visible first-level `role=menuitem` whose accessible label/name is `选择模型`; click it to enter the model list.
- R4: Treat the first-level row's visible text (for example `5.6\n中`) as a useful fast hint only, not final proof.
- R5: In the model list, match supported models by exact model-label prefix while tolerating product suffixes such as GPT-5.5 retirement text.
- R6: The authoritative already-selected check is target model radio `aria-checked=true`.
- R7: If another model is selected, click the target radio, wait for the UI to return to the first popup, reopen `选择模型`, and require `aria-checked=true` on the target before Send.
- R8: Missing first-level `选择模型`, missing target radio, disabled target, or failed post-click recheck must fail closed.
- R9: Do not interpret transcript/sidebar mentions as model state.
- R10: Preserve dispatch order: Chat mode -> model -> reasoning -> attachments -> prompt -> Send.
- R11: Preserve GPT-5.6 Sol as the workbench default.
- R12: Update fixtures to reproduce the live nested menu, including `menuitemradio` and `aria-checked`.
- R13: Bump userscript/README/version assertions to 2.10.32.
- R14: GitHub Actions only; do not build/test on Mac.

## Live evidence captured 2026-10-08

Before model submenu:
- trigger: button `选择 ChatGPT 模型`
- first popup: menu `选择 ChatGPT 模型`
- first popup entries: `menuitem 强度`, `menuitem 选择模型`
- `选择模型` visible text before switching: `中`
- after selecting 5.6: `选择模型` visible text: `5.6\n中`

Model submenu before switch:
- `GPT-6` aria-checked=true
- `GPT-5.6 Sol` aria-checked=false
- `GPT-5.5 将于 10月14日下线` aria-checked=false

Model submenu after switch:
- `GPT-6` aria-checked=false
- `GPT-5.6 Sol` aria-checked=true

## Acceptance criteria

- AC1: Default GPT-5.6 task on a page whose live model is GPT-6 enters the nested submenu, switches to GPT-5.6 Sol, reopens the submenu, verifies checked=true, then continues.
- AC2: Already-selected GPT-5.6 Sol is confirmed from aria-checked without changing model.
- AC3: GPT-6 and GPT-5.5 use the same nested flow.
- AC4: Direct first-level model-row assumptions are removed from live-path tests.
- AC5: Exact-head GitHub Actions Test passes; after merge canonical-main Test and release succeed.
