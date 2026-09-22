# Route-owned ended detection without a mounted task marker — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related incident: marker-virtualized bound conversation can remain waiting unless the user manually pauses/resumes after upgrade

## 1. Context / problem

v2.9.60 fixes stale global loaders, old observation clocks, and preservation of explicit manual recovery. It still has one dependency that does not satisfy the product requirement “等待响应的时候，也要检查会话是不是已经结束了” in every case.

For an ordinary persisted waiting task after script/page startup, `latestTurn(task)` requires the current Fabushi marker (or a recorded continuation) to own the turn. If ChatGPT has virtualized the marker-bearing user message and the current assistant edge is tool-only/no-final, strict recovered-final fallback intentionally refuses ownership. As a result, the ended-without-final detector cannot start unless the user manually pauses/resumes first to enable explicit recovery.

The task URL itself is already a durable task boundary. When the exact saved conversation is open, no other task owns that URL, no foreign Fabushi marker is visible, the original task marker is absent rather than contradicted by a newer mounted user turn, the composer is empty and enabled, and all activity/blocker signals are absent, the script can safely detect “conversation ended without final” and send a continuation in the same chat. This is not final-reply attribution and must not be used to complete a task.

A second live UI case must be handled in the same release: ChatGPT may show a “请求过于频繁” popup whose text says that only access to previous conversation/history records is temporarily restricted. This popup does not block the current conversation, a new conversation, or current-generation progress. It must therefore be acknowledged with its explicit “明白 / 知道了 / Got it / OK” action and ignored by the real request-rate-limit cooldown detector.

## 2. Goal

Allow ordinary `waiting` supervision to detect and continue an ended exact-route conversation even when the task marker was virtualized, without requiring a manual pause/resume.

Publish as userscript v2.9.61.

## 3. Non-goals

- Do not use route-only ownership to accept a final reply as task output.
- Do not route-only continue if the task marker is still mounted but is not the latest user turn.
- Do not continue if another task owns the same URL or a foreign Fabushi marker is visible.
- Do not clear or overwrite a user draft in the composer.
- Do not continue while Stop/streaming/loading/approval/blocker/rate-limit is active.
- Do not open a fresh chat for this condition.

## 4. Requirements

- R1: Add a recovery-only “route-owned ended detection” predicate separate from reply ownership.
- R2: Route-owned ended detection is allowed only when the current canonical URL equals the task's current canonical URL.
- R3: It must reject if another task records the same canonical URL.
- R4: It must reject if a visible foreign Fabushi task marker exists.
- R5: It must reject if this task's own marker is still mounted but `latestTurn(task)` is unowned, because that is evidence of a newer user turn.
- R6: It may proceed when this task's marker is absent/virtualized and no conflicting task evidence exists.
- R7: The composer must be enabled and empty; a non-empty draft blocks automatic continuation.
- R8: Stop, assistant streaming/busy state, conversation-scoped loading, approval, blocker, rate-limit and ambiguous send state block ended detection.
- R9: The latest mounted user-boundary fingerprint participates in the ended-state progress signature so a DOM/user-boundary change resets the 8-second stability timer.
- R10: After 8 stable seconds, send `继续完成所有` in the same bound conversation.
- R11: A normal owned final reply or explicit-recovery static final still completes normally and is never replaced by route-only continuation.
- R12: The 15-minute generic stalled refresh must not race an active route-owned ended candidate.
- R13: Add a regression proving a marker-virtualized exact-route tool-only conversation continues automatically on startup without manual pause/resume.
- R14: Add a regression proving a non-empty composer draft blocks route-only continuation.
- R15: Add a regression proving a still-mounted task marker followed by a newer user turn blocks route-only continuation.
- R16: Preserve v2.9.60 stale-loader, resume-reset and explicit-recovery persistence regressions.
- R17: Bump metadata/runtime/version assertions to 2.9.61.
- R18: Merge only after exact-head GitHub Actions Test passes, then verify canonical-main Test and Release v2.9.61.
- R19: Detect the specific request-frequency popup whose message explicitly says that access to previous conversation/history records is temporarily restricted.
- R20: For that history-only restriction popup, click an explicit acknowledgement action such as `明白`, `知道了`, `Got it` or `OK`, then continue normal supervision immediately.
- R21: The history-only restriction popup must not trigger `restForRateLimit()`, task cooldown, pausing, page refresh, cancellation, or fresh-chat suppression.
- R22: A genuine request rate-limit notice such as “请稍等几分钟后再重试” that is not scoped only to history access must continue to trigger the existing cooldown behavior.
- R23: Add regression coverage proving the history-only popup is acknowledged and ignored by `rateLimitNotice()`, while the existing genuine-rate-limit regression remains green.

## 5. Target behavior

Persisted task is `waiting`
→ exact saved `/c/<id>` is open
→ marker-bearing task user turn has been virtualized
→ no competing task owns the route
→ no foreign marker
→ composer is empty + enabled
→ no Stop/streaming/loading/approval/blocker/rate-limit
→ user boundary + page state stay stable for 8 seconds
→ send `继续完成所有` in the same conversation
→ continue supervision.

No manual pause/resume is required.

If this task's marker is still visible but a newer user turn exists, the route-only fallback stays disabled.

## 6. Verification

- Full repository Test workflow on exact PR head.
- New startup marker-virtualized ended-route continuation regression passes.
- New composer-draft guard regression passes.
- New mounted-marker/newer-user rejection regression passes.
- Existing v2.9.60 and final/streaming/approval/cross-task guards remain green.
- Canonical-main Test succeeds.
- Release workflow publishes v2.9.61.
- History-only request-frequency popup regression proves the `明白` action is clicked and no cooldown is reported.
- Existing genuine request-rate-limit regression remains green.

## 7. Acceptance criteria

- AC-1: Waiting-state end detection works after reload even if the original task marker is virtualized.
- AC-2: User does not need to pause/resume to re-enable ended detection.
- AC-3: Route-only logic never completes a task based on assistant text.
- AC-4: User drafts and newer-user-turn evidence are protected.
- AC-5: No duplicate fresh chat is introduced.
- AC-6: Exact-head Test, canonical-main Test and Release workflow all pass.
- AC-7: Canonical main and GitHub Release report v2.9.61.
- AC-8: A history-only “请求过于频繁” popup is acknowledged and dismissed without interrupting current/new conversation progress.
- AC-9: Genuine request-wide rate limits still enter the existing cooldown path.

## 8. Delivery evidence

- Implementation PR: #77.
- Final exact-head SHA: `d1f553b0aca958713349a91f407765f34a5bf84d`.
- Exact-head Test run: `35737758907`, conclusion `success`; full suite `180/180 PASS`, `0 FAIL`.
- Squash merge / canonical source SHA: `5fccb9fe2aa373fd96ebbdd475abce7c854a631f`.
- Canonical-main Test run: `35737960692`, conclusion `success`.
- Release workflow run: `35738026859`, conclusion `success`.
- GitHub Release: `v2.9.61`, published 2026-09-22T14:06:51Z from `5fccb9fe2aa373fd96ebbdd475abce7c854a631f`.
- Release asset: `chatgpt-auto-confirm.user.js`, 286303 bytes, SHA-256 `c5e99b7bf5df52c9e3dcb97b6cd7e362a4df1afa79ec8909563ef44ea343b6c1`.
- Canonical main readback reports metadata `@version 2.9.61` and runtime `VERSION = '2.9.61'`.

## 9. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R6 | passed | Waiting supervision has a route-owned ended-detection predicate separate from reply ownership. Exact URL, competing URL owner, visible foreign marker and still-mounted-own-marker contradiction checks remain fail-closed. |
| R7-R12 | passed | Route-only continuation requires an empty enabled composer, no Stop/streaming/loading/approval/blocker/rate-limit/ambiguous-send state, an 8-second stable signature including user-boundary/activity evidence, and cannot race the 15-minute stalled refresh. It never attributes assistant text as a final result. |
| R13-R16 | passed | Regressions cover marker-virtualized startup continuation without manual recovery, user-draft protection, newer-user-turn rejection, stale-loader handling, resume observation reset and explicit-recovery persistence. |
| R17 | passed | Metadata/runtime/version assertions report 2.9.61. |
| R18 | passed | Exact-head Test 35737758907 passed before merge; canonical-main Test 35737960692 and Release 35738026859 succeeded. |
| R19-R23 | passed | History-only “请求过于频繁” dialogs are recognized separately from true request-wide throttling, their explicit “明白/知道了/Got it/OK” action is activated, and `rateLimitNotice()` ignores them. Existing genuine request-limit regression remains green. |
| AC-1-AC-5 | passed | Waiting-state end detection survives marker virtualization without a manual pause/resume while keeping route-only logic continuation-only and protecting user drafts/newer user turns. |
| AC-6-AC-7 | passed | Exact-head, canonical-main and Release workflows succeeded and canonical main/Release report v2.9.61. |
| AC-8-AC-9 | passed | History-only frequency popup handling continues current/new conversations without cooldown while genuine request-wide rate limits retain existing cooldown behavior. |
