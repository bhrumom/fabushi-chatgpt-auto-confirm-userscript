# History-throttle acknowledgement and continuation-send reliability — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related incident: live v2.9.61 screenshot shows history-only “请求过于频繁” popup still open and “继续完成所有” typed in the composer but not sent.

## 1. Context / problem

Two live failures remain in v2.9.61.

First, the history-only frequency popup is correctly separated from true request-wide throttling, but the actual ChatGPT popup button is labeled “明白了”. The acknowledgement matcher only accepts “明白”, “知道了”, “Got it”, “OK”, etc. The popup also may not expose a standard `role=dialog` / modal class. Therefore the generic dialog scanner can miss it or fail to identify its action, leaving the popup open and blocking interaction.

Second, ended-conversation detection is now reaching the continuation path: the live page visibly contains “继续完成所有” in the composer. However `sendContinuation()` only recognizes a narrow set of Send button selectors and only waits 300 ms after populating the composer. Current ChatGPT can render the blue up-arrow control with labels such as “发送”, “Send”, or “Send message”, and React may enable/render that control asynchronously after the input event. When the button is not found, the function leaves the continuation text in the composer and returns to waiting, so the task still appears stuck.

## 2. Goal

Reliably acknowledge the history-only request-frequency popup and reliably commit an already-prepared continuation message to the current ChatGPT conversation.

Publish as userscript v2.9.62.

## 3. Non-goals

- Do not dismiss connector authorization cards.
- Do not treat genuine request-wide rate limits as harmless.
- Do not click arbitrary modal buttons that are unrelated to the known history-access restriction text.
- Do not press Send when the composer contains a user draft other than the exact continuation prompt.
- Do not open a fresh chat for a bound ended conversation.
- Do not weaken reply/final ownership rules.

## 4. Requirements

- R1: Recognize acknowledgement labels including `明白了` in addition to `明白`, `知道了`, `Got it`, `OK` and existing equivalents.
- R2: Locate the history-only request-frequency popup by its text semantics even when it has no standard dialog/modal role or class.
- R3: The semantic popup finder must only activate an acknowledgement button inside an ancestor that contains both the request-frequency/history-restriction text and the acknowledgement action.
- R4: Acknowledging this popup must continue normal supervision without rate-limit cooldown.
- R5: Genuine request-wide throttling remains handled by `restForRateLimit()`.
- R6: Expand Send control recognition to current ChatGPT labels including exact `发送`, `Send`, `Send message`, and existing send labels.
- R7: After writing `继续完成所有`, wait up to 3 seconds for ChatGPT/React to expose or enable the current Send control.
- R8: During that wait, never select voice/microphone or other unrelated controls; accepted controls must match explicit Send semantics or the canonical send-button test id.
- R9: Use the existing pointerdown+click activation path for the continuation Send control.
- R10: If the Send control still cannot be found after the wait, leave the exact continuation prompt intact, keep the task resumable/waiting, log a recoverable send-UI wait, and retry on later supervision without creating a fresh chat.
- R11: Do not increment `continuationCount` or `continuationSentAt` unless the Send action is actually issued.
- R12: Add regression coverage for the exact screenshot popup copy with a `明白了` button and no dialog role/class.
- R13: Add regression coverage where the continuation Send button appears/enables asynchronously after the composer input event; the continuation must be sent exactly once.
- R14: Add regression coverage for a current blue-arrow-style Send button labeled `发送` or `Send message`.
- R15: Preserve all v2.9.61 route-owned ended-detection, user-draft, newer-user-turn, stale-loader, authorization-card and genuine-rate-limit regressions.
- R16: Bump metadata/runtime/version assertions to 2.9.62.
- R17: Merge only after exact-head GitHub Actions Test passes, then verify canonical-main Test and Release v2.9.62.

## 5. Target behavior

History-only popup appears
→ detect text “请求过于频繁 … 暂时限制访问对话记录”
→ find `明白了` inside the same popup container
→ click it
→ continue current task immediately
→ no cooldown.

Ended bound conversation is detected
→ write `继续完成所有`
→ React renders/enables blue Send control
→ scanner waits for it
→ pointerdown + click Send
→ increment continuation counters
→ continue waiting for the new response.

If the Send control is temporarily absent, keep the prompt and retry later rather than silently claiming it was sent or refreshing the page.

## 6. Verification

- Exact-head full Test workflow.
- Semantic no-role popup + `明白了` regression passes.
- Dynamic Send-button appearance/enabling regression passes.
- Exact `发送` / `Send message` Send-control regression passes.
- Genuine rate-limit and authorization regressions remain green.
- v2.9.61 ended-detection regressions remain green.
- Canonical-main Test succeeds.
- Release workflow publishes v2.9.62.

## 7. Acceptance criteria

- AC-1: The live history-only frequency popup is dismissed by clicking `明白了`.
- AC-2: The popup does not pause or cooldown the current task.
- AC-3: A visible `继续完成所有` continuation does not remain unsent merely because the Send control uses the current ChatGPT label/async render path.
- AC-4: Continuation sends exactly once and stays in the same bound conversation.
- AC-5: No user draft is overwritten and no unrelated control is clicked.
- AC-6: Exact-head Test, canonical-main Test and Release workflow all pass.
- AC-7: Canonical main and GitHub Release report v2.9.62.

## 8. Delivery evidence

- Implementation PR: #79.
- Final exact-head SHA: `35108e8fedf646e4fc73f57c2986f665af06843a`.
- Exact-head Test run: `35740145215`, conclusion `success`; full suite `182/182 PASS`, `0 FAIL`.
- Squash merge / canonical source SHA: `30fb39e6a47830c9b34facacdf70d52786548672`.
- Canonical-main Test run: `35740251265`, conclusion `success`.
- Release workflow run: `35740322953`, conclusion `success`.
- GitHub Release: `v2.9.62`, published 2026-09-22T14:26:34Z from `30fb39e6a47830c9b34facacdf70d52786548672`.
- Release asset: `chatgpt-auto-confirm.user.js`, 289621 bytes, SHA-256 `4ede5c13bb1eea82ed7e92976ca1960164fca4a8512be8eae4f2a4a835f88080`.
- Canonical main readback reports metadata `@version 2.9.62` and runtime `VERSION = '2.9.62'`.

## 9. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R5 | passed | History-only request-frequency popup recognition now includes `明白了`, semantic popup discovery works without dialog roles/classes, and genuine request-wide throttling remains separate. |
| R6-R11 | passed | Continuation send-control recognition covers current Chinese/English labels, waits up to 3 seconds for async React rendering/enabling, uses pointerdown+click activation, and does not increment continuation counters before the Send action is issued. |
| R12-R15 | passed | New regressions cover the exact screenshot popup copy/no-role `明白了` action, asynchronously rendered `Send message`, and `aria-label=发送`; previous route-owned ended detection, draft, authorization and rate-limit guards remain green. |
| R16 | passed | Metadata/runtime/version assertions report 2.9.62. |
| R17 | passed | Exact-head Test 35740145215 passed before merge; canonical-main Test 35740251265 and Release 35740322953 succeeded. |
| AC-1-AC-5 | passed | The popup is dismissed without cooldown and continuation text is committed through the current Send control without leaving an unsent composer or touching unrelated controls. |
| AC-6-AC-7 | passed | Exact-head, canonical-main and Release workflows succeeded and canonical main/Release report v2.9.62. |
