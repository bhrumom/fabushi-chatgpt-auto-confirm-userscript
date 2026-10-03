# Force Chat mode before Fabushi dispatch — v2.10.29

Status: active
Owner: Fabushi ChatGPT auto-confirm
Last updated: 2026-10-03
Related issue/task/PR: user-reported Work-mode misdispatch; PR #147

## 1. Context / problem

ChatGPT now exposes a top-level Chat / Work mode switch on the new-conversation surface. A live Chinese UI observation on 2026-10-03 showed the localized pair `聊天` / `工作`, with `工作` selected while the normal model/reasoning picker and composer were still available. The current userscript validates the model/reasoning tier before Send, but it does not validate Chat-vs-Work mode. As a result, a Fabushi task can navigate to the new-conversation page and send its prepared prompt into ChatGPT Work.

This is a dispatch safety bug: Fabushi orchestration expects ordinary Chat conversations, while Work has different product semantics and can change how the request is executed.

## 2. Goal

Before every new Fabushi dispatch, make the userscript recognize the Chat / Work selector in both Chinese and English, switch to Chat when Work is selected, and refuse to Send until Chat mode is structurally verified.

## 3. Non-goals / out of scope

- Do not automate or use ChatGPT Work.
- Do not change model/reasoning tier semantics.
- Do not change authorization-card behavior, recovery policy, task scheduling, attachment behavior, or completion detection except where the new pre-Send Chat-mode guard must run.
- Do not alter existing-conversation inspection; this guard applies to new dispatch on the root composer before Send.
- Do not rely on CSS color/pixel comparison as the primary mode identity.

## 4. Requirements

- R1: Recognize the mode controls using exact localized labels for Chinese and English: Chat = `聊天` / `Chat`; Work = `工作` / `Work`. Also accept the corresponding `聊天模式` / `工作模式` and `Chat mode` / `Work mode` accessible labels.
- R2: Scope mode detection to a nearby Chat+Work interactive pair (`button`, `role=tab`, or `role=radio`) so unrelated page text cannot be mistaken for the mode switch.
- R3: Determine selection from semantic state where available, including `aria-selected`, `aria-pressed`, `aria-checked`, `aria-current`, common selected/active data attributes, and tab focus semantics.
- R4: Run Chat-mode enforcement before model/reasoning enforcement, attachment upload, composer replacement, or Send.
- R5: If Work is selected, activate the Chat control and wait for the mode selector to report Chat selected before continuing.
- R6: If the Chat/Work pair is present but the selected mode cannot be verified, fail closed: do not Send, keep the prepared dispatch intent, and use the existing bounded send-UI recovery path.
- R7: If activation is attempted but Work remains selected, fail closed and never click Send.
- R8: If the paired mode selector is temporarily absent but the page has clear Work evidence such as a visible/accessible `ChatGPT Work` composer hint, fail closed and wait/recover instead of assuming Chat.
- R9: If no Chat/Work selector and no Work-specific evidence exist, preserve compatibility with Chat-only/account variants and allow the existing model/reasoning guard to decide readiness.
- R10: Chinese and English mode surfaces must behave identically.
- R11: Preserve the single prepared prompt/token and existing no-duplicate-Send invariants while mode switching or waiting.
- R12: Ship as userscript version `2.10.29`; verification/build/test runs are GitHub Actions or htch-runtime only, never local.

## 5. Current state

`send()` navigates to `/`, confirms the composer is empty of old turns, then calls `ensureTaskReasoningPreset()`. No Chat/Work-mode check exists before the reasoning picker or Send.

## 6. Target state

`send()` navigates to `/`, confirms the root composer state, then calls `ensureChatMode()`. Only after that succeeds may it call `ensureTaskReasoningPreset()`, upload attachments, write the prompt, and click Send.

## 7. Architecture and ownership boundaries

- Userscript runtime owns DOM observation and Chat-mode activation.
- No host/browser-extension or external controller action is part of this behavior.
- The mode guard is a pre-dispatch UI contract adjacent to the existing reasoning-tier guard.
- Existing generic send-UI recovery remains the owner of a stuck/unverifiable composer surface.

## 8. Interfaces / contracts / schemas / data flow

Proposed runtime helpers:
- `chatWorkModeControls()`: return the nearest visible localized Chat+Work interactive pair or null.
- `modeControlSelection(node)`: return selected / unselected / unknown from semantic attributes.
- `chatWorkModeState()`: classify `chat`, `work`, `ambiguous`, or `absent`.
- `workModeEvidence()`: detect clear Work-only composer/page evidence when the paired selector is unavailable.
- `ensureChatMode(task, signal)`: switch Work -> Chat, verify the result, or fail closed through `waitForSendUI()`.

No persisted schema change is required.

## 9. Constraints and non-functional requirements

- Prefer semantic DOM state over styling.
- Exact localized matching only; do not use broad substring matching for generic words such as `work` or `chat`.
- Never send solely because the Chat button was clicked; when the pair exposes semantic selected-state, observe Chat selected before proceeding.
- Preserve accessibility and localization support for both Chinese and English.
- No local build/test execution.

## 10. Failure modes and edge cases

- Work is selected and Chat click succeeds: continue only after Chat is selected.
- Work is selected and Chat click is ignored: do not Send.
- Selector exists but neither side exposes verifiable selection: do not Send.
- Selector disappears during switching: wait/recover; do not Send in that scan.
- Selector is absent because the account does not expose Work: allow normal dispatch only when no Work-specific evidence exists.
- Work composer hint exists before selector hydration: do not Send.
- Existing task conversation inspection remains unchanged.

## 11. Implementation strategy

1. Add localized mode-label and semantic selection helpers near the existing composer/reasoning helpers.
2. Implement nearest-pair detection and Work-specific evidence.
3. Add `ensureChatMode()` using the existing `activateControl`, `delay`, `check`, and `waitForSendUI` infrastructure.
4. Call it in `send()` immediately before `ensureTaskReasoningPreset()`.
5. Expose focused helpers to the test harness.
6. Add Chinese and English regression fixtures plus fail-closed Send coverage.
7. Bump userscript/README version to v2.10.29.

## 12. Verification / test strategy

GitHub Actions only:
- `node --check chatgpt-auto-confirm.user.js`
- full `npm test`
- focused regressions in `test/workbench.test.mjs` for:
  - Chinese Work -> Chat switch;
  - English Work -> Chat switch;
  - already-selected Chat does not need a mode change;
  - selector present but ambiguous fails closed;
  - Work remains selected after attempted activation -> Send is never clicked;
  - selector absent + explicit ChatGPT Work evidence -> Send is never clicked;
  - selector absent + no Work evidence preserves chat-only compatibility;
  - mode guard executes before reasoning enforcement.

## 13. Acceptance criteria / Definition of Done

- AC-1: A Chinese `工作`-selected root surface is switched to `聊天` before reasoning/model enforcement and Send.
- AC-2: An English `Work`-selected root surface is switched to `Chat` before reasoning/model enforcement and Send.
- AC-3: If Chat selection cannot be verified while the pair is present, the userscript does not Send.
- AC-4: If Work remains selected after activation, the userscript does not Send.
- AC-5: If the selector is absent but clear ChatGPT Work evidence exists, the userscript does not Send.
- AC-6: Accounts/surfaces with no selector and no Work evidence preserve existing dispatch compatibility.
- AC-7: Existing model-tier, attachments, authorization, recovery, scheduling, and completion regressions remain green.
- AC-8: Exact PR-head GitHub Actions Test workflow succeeds.

## 14. Release / migration / rollback

No data migration. Release as v2.10.29 after PR-head verification and canonical-main verification. Rollback is a normal userscript release rollback to v2.10.28 if the new guard prevents valid Chat dispatches.

## 15. Observability / evidence

Task log should explicitly say when Work was detected and Chat was selected, or when mode verification blocked dispatch. CI run IDs and final release evidence will be recorded in the compliance table.

## 16. References / provenance

- User-provided 2026-10-03 live screenshot: Chinese `聊天` / `工作` segmented selector with Work selected and a `使用 ChatGPT Work` composer hint.
- Canonical main before this change: `1cb2512e0a920839f6f30d98dadac90d35b46f91`.
- Existing pre-Send reasoning guard: `ensureTaskReasoningPreset()` in `chatgpt-auto-confirm.user.js`.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R12 | passed | PR #147 implements localized Chat/Work recognition, semantic selection verification, Work->Chat switching before reasoning/attachments/Send, fail-closed ambiguous/Work-only evidence handling, and preserves Chat-only compatibility. Exact-head Test run `37088170317` passed syntax and the full regression suite on head `6e204d876f0b435b5451d30be9a60b39dc9bea5b`. |
| AC-1-AC-8 | passed | Chinese/English switching, ambiguous selection, stuck-Work no-Send, Work-evidence-only blocking, Chat-only compatibility, and existing regressions all passed in exact-head Test run `37088170317`. |
