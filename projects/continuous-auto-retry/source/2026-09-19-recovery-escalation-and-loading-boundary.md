# 2026-09-19 — Recovery escalation and loading boundary

Latest requirement:

1. If the page still shows “连接已中断。正在等待完整回复。” after three recovery refreshes of the same bound conversation, stop refreshing and send “继续完成所有” in that same conversation immediately.
2. If ChatGPT request-frequency/rate-limit recovery happens more than three distinct cooldown episodes for the same task, clear the current conversation dispatch and open a fresh chat to resend the current Work/Review prompt with the same task/attachments.
3. A bound conversation may only be classified as actively generating/loading from the conversation state when the Stop control is present. If Stop is absent, no approval card is present, and no verified final toolbar exists, treat persistent state as an abnormal stop rather than a loading spinner false positive; send “继续完成所有” in the same conversation after a short safety grace.
4. Explicit retryable message errors remain immediate same-chat continuation signals.
5. Release a new userscript version and provide CI/main/Release evidence.
