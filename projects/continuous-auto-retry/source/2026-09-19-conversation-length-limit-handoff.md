# 2026-09-19 — Conversation length-limit handoff

Latest user requirement:

When ChatGPT shows the live response “你已达到此对话的长度上限，你可以开始新聊天以继续对话。” (or the equivalent English conversation-length-limit notice), this is not a completed Work/Review result.

The automation must:
1. Detect the length-limit notice only on the current owned conversation, without self-triggering from Fabushi logs or a user's quoted text.
2. Capture the current page's latest assistant reply as continuation context.
3. Close only the current conversation dispatch identity and open a fresh ChatGPT conversation for the same task and same phase/round.
4. Send the original task context plus the captured previous reply, explicitly instructing the new conversation to continue from where the prior conversation stopped instead of restarting.
5. Preserve attachments and task identity/goal. For Review phase, preserve the Work result and continue the same review contract.
6. If the next conversation also hits the length limit, repeat the handoff again. Continue until a true final reply is received under the existing final-toolbar completion rule.
7. Publish a new userscript version and synchronize the Fabushi Chrome host's bundled userscript release.
