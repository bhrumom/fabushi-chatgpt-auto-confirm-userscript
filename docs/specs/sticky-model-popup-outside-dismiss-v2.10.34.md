# Outside-dismiss recovery for sticky ChatGPT model menu — v2.10.34

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Date: 2026-10-08

## Live reproduction
On the signed-in Mac Chrome tab, the second-level menu contains GPT-6 / GPT-5.6 Sol / GPT-5.5 `menuitemradio` entries. Clicking the composer model trigger while this menu is visible does not reliably close it. Even a keyboard Escape followed by hover outside and trigger click can leave the same radio menu visible. **Clicking the inert chat-page heading outside the menu closes the overlay; clicking the composer trigger afterwards reveals first-level `强度` and `选择模型` again.** No chat prompt was sent.

## Contract
1. Preserve task model selection default GPT-5.6 Sol, mandatory radio `aria-checked=true` proof, Chat-before-model-before-reasoning-before-Send order and reasoning slider verification.
2. Before reopening an already-expanded sticky model submenu, dismiss using a *safe inert element outside the popup*, not the Send button, transcript, navigation, workbench or composer. Prefer the heading inside the active ChatGPT main content; only click when visible, connected, distinct from the trigger and outside the menu. Use pointerdown/mousedown/mouseup/click to imitate outside interaction where supported, then verify the radio popup was actually dismissed.
3. Do not rely on synthetic Escape or pointerleave alone. Keep them as non-destructive preliminary tactics; if popup remains, use safe outside dismissal. Never treat trigger `aria-expanded=false` alone as proof when radio options are still visible.
4. Reopen the same enabled composer trigger only after observing closure; wait boundedly for first-level menu / actual reasoning slider, with cancellation checks. If outside dismissal cannot be performed safely or fails, fail closed and retain the task rather than Send.
5. Preserve the exact 5.6/5.5 explicit hint versus unlabeled-ready GPT-6 hint contract. Hints must not replace radio proof.
6. Include focused simulated sticky-menu regression where Escape/trigger clicks alone fail but outside pointerdown closes and strength menu returns; include negative test where no safe outside target is available and Send stays blocked.
7. No builds or tests on Mac; use exact-head GitHub Actions and release provenance for verification. Publish as v2.10.34 only after green PR, main Test and Release.

## Implementation scope
`chatgpt-auto-confirm.user.js` menu dismissal/reopen helper; focused `test/workbench.test.mjs` regression; README/version metadata. Use no arbitrary element for dismissal.

## Acceptance
AC1: Sticky radio overlay is closed by safe outside interaction and strength slider becomes available again.
AC2: Wrong/stale/unsafe dismiss target fails closed; no Send.
AC3: Model radio and strength verification remain mandatory.
AC4: GitHub Actions Test on PR exact HEAD, main, and v2.10.34 published artifact all succeed.
