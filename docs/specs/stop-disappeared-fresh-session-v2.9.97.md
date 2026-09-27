# Stop disappearance always hands current work to a fresh session — v2.9.97

Status: implementation-verified  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-27  
Related request: user explicitly replaced same-chat “继续完成所有” continuation with fresh-session handoff

## 1. Context / problem

Previous releases had several continuation modes. Some abnormal/end states sent the literal message `继续完成所有` in the same ChatGPT conversation; normal final-toolbar detection could also complete the current Work/Review response in place.

The required behavior is now simpler and different: once the current task has visibly entered generation (Stop control observed), the disappearance of that Stop control means the current generation slice is over. If no authorization card is pending, the script must capture the current task-scoped assistant work, abandon the old dispatch identity, open a fresh ChatGPT conversation in the same tab, and send a continuation prompt containing that work. It must not inject `继续完成所有` into the old conversation.

## 2. Goal

For every active Work or Review dispatch, use a verified Stop-visible → Stop-absent transition as the automatic handoff boundary. Carry the current visible assistant work into a fresh conversation and continue the same task/phase/round there.

## 3. Superseded behavior

This specification supersedes the automatic same-chat continuation requirements in:
- `ended-conversation-continue-v2.9.59.md`
- `interrupted-turn-content-same-chat-continuation.md`
- the Stop→toolbar completion precedence from `final-toolbar-stop-race.md` whenever this dispatch has already observed Stop.

Historical `继续完成所有` user turns remain readable for ownership/recovery compatibility, but the runtime must never automatically type or send that message.

## 4. Requirements

- R1: Persist that the current exact task dispatch has observed a visible Stop control, bound to the current canonical conversation URL, phase, round, token, and goal revision.
- R2: When that same dispatch is later inspected with Stop absent and no authorization card pending, immediately queue a fresh-session handoff. Do not wait for the final response toolbar, Copy button, an eight-second ended-state timer, or the fifteen-minute stalled-page timer.
- R3: Capture the current task-scoped visible assistant transcript before clearing the old URL/token, using the existing exact-route/ownership-safe transcript extractor and bounded carry storage.
- R4: The fresh-session prompt must preserve the current phase and round, current task/next instruction, previous Work result where applicable, original goal, attachments, and the captured assistant work so the new conversation continues from the actual work already performed.
- R5: The automatic path must never type, click Send for, or otherwise inject the literal `继续完成所有` into the old conversation.
- R6: A visible authorization card blocks the Stop-disappearance handoff. After the authorization card is resolved, if the same dispatch had already observed Stop and Stop is absent, the handoff may proceed.
- R7: A visible Stop control never triggers a click solely to force this handoff. While Stop remains visible, keep supervising the existing conversation.
- R8: A response toolbar/final candidate does not complete the task when the current dispatch has observed Stop and is now in the Stop-absent handoff state; the fresh-session transition wins first.
- R9: Route/task ownership, foreign-task isolation, paused/cancelled state, and ambiguous-send protections remain fail-closed. Rate-limit and hard blocker handling retain their dedicated behavior and are not used as evidence of normal Stop-disappearance completion.
- R10: Explicit conversation-length handoff remains a fresh-session path and may keep its specialized length-limit context.
- R11: Legacy pending same-chat continuation state must migrate into the fresh-session path; `sendContinuation()` must no longer mutate the composer or click the old conversation Send button.
- R12: Clearing a dispatch for a fresh session also clears its Stop-observed identity so the replacement conversation cannot immediately hand off before its own Stop has been observed.
- R13: Add regressions for (a) Stop seen then removed with assistant work, (b) final toolbar present at Stop disappearance, (c) authorization card blocks until resolved, (d) connection interruption with Stop visible does not click Stop or send, then hands off after Stop disappears, and (e) no automatic `继续完成所有` composer write/send remains.
- R14: Bump userscript metadata/runtime/README and version assertions to 2.9.97.
- R15: Deliver only after exact-head Test passes, then canonical-main Test and Release succeed and the v2.9.97 asset is readable.

## 5. Target flow

Current exact task conversation
→ Stop becomes visible
→ persist Stop-observed identity for this dispatch
→ continue supervising while Stop is visible
→ Stop disappears
→ if authorization card exists: stay for authorization
→ otherwise capture visible assistant work
→ persist old conversation in history
→ clear old URL/token/send identity
→ queue the same task, same phase/round
→ navigate to a fresh ChatGPT conversation in the same tab
→ send the generated continuation prompt containing current work + task context
→ wait until that fresh conversation shows Stop
→ repeat.

## 6. Safety / ownership

The handoff requires the exact canonical task route with no competing task owner. Carry extraction remains bounded and task-scoped. A fresh session is not started from a foreign route, a paused/cancelled task, or an ambiguous unbound send.

## 7. Verification

- Full repository GitHub Actions Test on the exact PR head.
- Regression proving Stop→absent + no authorization queues fresh even if final toolbar is already present.
- Regression proving current assistant content is included in `abnormalFreshCarry` and the next Work prompt.
- Regression proving authorization prevents the transition until removed.
- Regression proving no automatic old-chat Send click or `继续完成所有` composer fill occurs.
- Existing memory-pressure same-tab reload and manual workspace recovery tests remain green.
- Canonical-main Test and Release must succeed.

## 8. Acceptance criteria

- AC-1: Automatic same-chat `继续完成所有` sending is gone.
- AC-2: Stop disappearance after a previously observed Stop causes a fresh-session handoff on the next eligible inspection.
- AC-3: Current visible assistant work is carried into the new-session prompt.
- AC-4: Authorization cards pause the handoff until resolved.
- AC-5: Final toolbar presence does not override the Stop-disappearance handoff for a dispatch that observed Stop.
- AC-6: New session starts with a cleared old URL/token and a new prepared send identity, while phase/round/task/attachments remain unchanged.
- AC-7: Exact-head, canonical-main Test and Release v2.9.97 all pass.

## 9. Compliance record

Pre-merge implementation head `63832d1754123d10fe4cb27e73bddf2ea86ab3b9` passed GitHub Actions Test run `36298028332`: 254 tests, 247 passed, 0 failed, 7 skipped. Focused regressions passed for Stop→absent handoff with a final toolbar already mounted, authorization-card blocking/unblocking, connection-interruption fresh handoff, legacy continuation migration without touching the old composer/Send/Stop controls, current-work carry, and the v2.9.96 no-self-resurrection behavior. Memory-pressure same-tab recovery regressions also remained green.

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R4, R8, R12 / AC-2, AC-3, AC-5, AC-6 | passed | The runtime persists an exact dispatch Stop-observed identity, evaluates Stop disappearance before final classification, captures task-scoped visible assistant work, then clears the old dispatch and queues the same task/phase/round for a fresh conversation. The focused final-toolbar regression passed. |
| R5, R7, R11 / AC-1 | passed | `sendContinuation()` is now a legacy compatibility wrapper that never writes the old composer or clicks old Stop/Send controls. Source regression rejects `setInput(input, CONTINUATION_PROMPT)`; interruption tests prove zero old-chat sends/clicks. |
| R6 / AC-4 | passed | Authorization-card regression proves Stop disappearance retains the old route in approval state until the card is removed, then queues the fresh handoff. |
| R9-R10 | passed | Existing ownership/foreign/ambiguous/rate-limit/blocker tests and conversation-length fresh-handoff tests remained green in the full suite. |
| R13 | passed | Required Stop-removal, final-toolbar, authorization, interruption, and no-legacy-send regressions are present and passed. |
| R14 | passed | Userscript metadata/runtime, README, and version assertions are 2.9.97. |
| R15 / AC-7 | partial | Exact-head Test `36298028332` passed. Merge, canonical-main Test, Release workflow, and v2.9.97 asset readback remain to be completed after this compliance-only commit is re-tested. |
