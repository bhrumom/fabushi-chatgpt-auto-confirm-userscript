# CAR-013 evidence — connection interruption -> immediate fresh chat resend

- Requirement: when the owned ChatGPT conversation shows “连接已中断，正在等待完整回复”, immediately abandon the old conversation as the active dispatch target and resend the current phase message in a fresh ChatGPT conversation.
- Implementation PR: #51.
- Final PR exact head: `b99fc339066dfc4c97492094e1d41e76f97d6b01`.
- Exact-head Test run `35447029840`: SUCCESS; userscript syntax and complete regression suite passed.
- Squash merge: `446698b4523beaf20a67c1889099fe75f7bc473b`.
- Post-merge main Test run `35447062729`: SUCCESS.
- Canonical main readback: userscript `@version 2.9.48`, runtime `VERSION = '2.9.48'`.
- Canonical main includes `queueInterruptedFreshRetry` and one-shot `connectionInterruptedFreshDispatch`.
- Canonical main no longer contains `refreshInterruptedConversation`, `CONNECTION_INTERRUPTED_REFRESH_COOLDOWN_MS`, `queuePendingContinuation`, or `attemptPendingContinuation`.
- Generic stalled recovery remains `STALLED_REFRESH_MS = 15 * 60 * 1000`; ambiguous-send recovery remains `AMBIGUOUS_SEND_REFRESH_MS = 3 * 60 * 1000`.
- Regression coverage proves immediate requeue, no old-chat continuation send, old URL history preservation, task/phase/round/goal-or-next/attachments preservation, new token/new conversation binding, repeated interruption recovery, and legacy pending-state migration.
- No additional live-site/E2E behavioral test was requested for this change.
