# Ended conversation continuation while waiting — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related incident: live v2.9.58 conversation is visibly finished after tool calls but task remains “等待响应”

## 1. Context / problem

The userscript currently distinguishes a true final reply from an unfinished response using Stop/streaming/loading/approval/final-toolbar evidence. A bound task that has no final natural-language reply can nevertheless reach a real idle/end state: generation has stopped, the composer is usable again, no approval/tool/loading state remains, but no final reply toolbar is present.

That state is already tracked as `abnormalNoFinalEligible`, but v2.9.58 waits 30 minutes before sending `继续完成所有`. During those 30 minutes the task remains “等待响应”, and the generic 15-minute stalled-conversation watchdog may refresh the page first. This is the live failure.

The waiting-response loop must actively detect that the conversation itself has ended. When an owned bound conversation has clearly returned to an idle composer without a final reply, the task must continue in the same conversation instead of waiting for the 15-minute refresh loop.

## 2. Goal

Detect an ended-without-final-reply state during ordinary `waiting` supervision and automatically send `继续完成所有` in the same bound conversation after a short stability guard.

Publish the verified behavior as userscript v2.9.59.

## 3. Non-goals

- Do not treat temporary Stop disappearance as an ended conversation.
- Do not continue while the page is loading, a tool/stream is active, approval is pending, a blocker/rate limit is present, or the composer is unavailable/disabled.
- Do not open a fresh chat when a valid bound conversation exists.
- Do not weaken v2.9.58 explicit-recovery static-final completion for a real natural-language final reply.
- Do not convert tool-call-only UI text such as “已调用工具” into a recovered final answer.
- Do not change the v2.9.57 unbound 90-second immediate fresh-resend behavior.

## 4. Requirements

- R1: During every `inspect()` pass, including tasks currently in `waiting`, evaluate whether the owned exact-route conversation is idle/ended without a final reply.
- R2: Ended-without-final is eligible only when the exact route is owned, no final reply is established, no Stop is visible, no streaming marker is active, no approval card exists, no raw page-loading signal exists, no blocker/rate limit exists, the original send is no longer ambiguous, and an enabled composer is available.
- R3: The ended state must remain unchanged for at least 8 seconds before continuation is sent.
- R4: Once the 8-second ended-state stability gate is met, send `继续完成所有` in the same conversation immediately; do not wait 30 minutes and do not enter the 15-minute stalled refresh first.
- R5: Existing continuation cooldown and duplicate-send protection remain in force after a continuation was actually sent.
- R6: A loading/spinner state must reset/end the ended-state timer and must never trigger continuation merely because Stop is absent.
- R7: A normal final reply still wins and completes without continuation.
- R8: A v2.9.58 explicit manual-recovery static natural-language final candidate still wins and completes through its static-final stability gate rather than receiving `继续完成所有`.
- R9: Recovery ownership must be able to inspect an exact-route explicitly recovered conversation even when the Fabushi marker is virtualized and the latest assistant content is tool-call-only or empty; this is necessary to detect an ended conversation with no natural final reply.
- R10: Recovery static-final candidates require natural assistant message content, not tool-call-only container text.
- R11: Add a regression proving an ordinary owned `waiting` conversation with a usable composer and no final toolbar sends `继续完成所有` after the 8-second ended-state gate.
- R12: Add a regression proving a manually recovered marker-virtualized tool-only/empty-final conversation is owned for end detection and continues after the same gate.
- R13: Preserve regressions proving loading/spinner, Stop, streaming, approval and final-toolbar states do not spuriously continue.
- R14: Bump metadata/runtime/version assertions to 2.9.59.
- R15: Merge only after exact-head GitHub Actions Test passes, then verify canonical-main Test and Release v2.9.59.

## 5. Target behavior

Bound task is “等待响应”
→ inspect exact conversation every scheduler pass
→ generation/tool execution ends
→ Stop absent + no streaming/loading/approval/blocker/rate-limit + composer enabled
→ no real final reply exists
→ state remains unchanged for 8 seconds
→ send `继续完成所有` in the same conversation
→ task remains waiting for the continued response
→ repeat only subject to existing continuation cooldown until a real final reply is produced.

A real final reply or a valid explicit-recovery static natural-language final candidate completes instead and never receives the continuation.

## 6. Verification

- Full repository Test workflow on exact PR head.
- New ordinary waiting-ended continuation regression passes.
- New marker-virtualized manual-recovery ended continuation regression passes.
- Existing final-reply and loading/Stop/streaming/approval negative regressions remain green.
- Existing v2.9.57 immediate ambiguous resend regression remains green.
- Canonical-main Test succeeds.
- Release workflow publishes v2.9.59.

## 7. Acceptance criteria

- AC-1: “等待响应” actively checks whether the conversation has ended.
- AC-2: An ended bound conversation without a final reply continues in the same chat after about 8 seconds, not after 30 minutes or 15-minute refreshes.
- AC-3: Loading/tool/approval/generation transitions do not trigger false continuation.
- AC-4: Natural final replies continue to finish normally.
- AC-5: No duplicate fresh chat is introduced for a bound conversation.
- AC-6: Exact-head Test, canonical-main Test and Release workflow all pass.
- AC-7: Canonical main and GitHub Release report v2.9.59.

## 8. Delivery evidence

- Implementation PR: #73.
- Final exact-head SHA: `aababe7afe3049e568d7787bf1f3948650d3b45e`.
- Exact-head Test run: `35725709798`, conclusion `success`; full suite `174/174 PASS`, `0 FAIL`.
- Squash merge / canonical source SHA: `5b9293c9f7f5275e3330640667bf86f37072467e`.
- Canonical-main Test run: `35726148851`, conclusion `success`.
- Release workflow run: `35726198674`, conclusion `success`.
- GitHub Release: `v2.9.59`, published 2026-09-22T12:16:33Z from `5b9293c9f7f5275e3330640667bf86f37072467e`.
- Release asset: `chatgpt-auto-confirm.user.js`, 280263 bytes, SHA-256 `a7889e144c46d390ade60602b3f04e9577d1db3ece010621f16a66bf8495656c`.
- Canonical main readback reports metadata `@version 2.9.59` and runtime `VERSION = '2.9.59'`.

## 9. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R4 | passed | `inspect()` now checks ended-without-final on every supervision pass, including `waiting`; exact ownership, no active/loading/blocking state, enabled composer and an 8-second stability gate are required before same-chat `继续完成所有` is sent. |
| R5-R8 | passed | Existing continuation cooldown/duplicate-send guards remain; loading resets eligibility; normal final replies and explicit-recovery natural static finals still win before continuation. |
| R9-R10 | passed | Explicit recovered exact-route tool-only/empty assistant edges can be owned for ended detection, while static-final recovery requires natural assistant reply content. |
| R11-R13 | passed | New regressions cover ordinary waiting-ended continuation and manual recovered tool-only continuation; the full suite preserved loading/Stop/streaming/approval/final guards. |
| R14 | passed | Metadata/runtime/version assertions report 2.9.59. |
| R15 | passed | Exact-head Test 35725709798 passed before merge; canonical-main Test 35726148851 and Release 35726198674 both succeeded. |
| AC-1-AC-2 | passed | Waiting supervision actively detects the ended state and continues after about 8 seconds, before 15-minute stall refresh. |
| AC-3-AC-5 | passed | Active/loading/approval/final states remain guarded and bound conversations continue in-place without a fresh chat. |
| AC-6 | passed | Exact-head, canonical-main and Release workflows all succeeded. |
| AC-7 | passed | Canonical main and GitHub Release both report v2.9.59. |
