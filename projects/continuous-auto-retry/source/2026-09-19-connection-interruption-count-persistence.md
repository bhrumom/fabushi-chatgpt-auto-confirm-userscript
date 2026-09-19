# 2026-09-19 — Connection interruption count persistence

Latest live-site evidence:
- After rate-limit cooldown the task re-opens its recorded conversation, shows loading/generating, then the live assistant area displays `连接已中断。正在等待完整回复`.
- The existing recovery does not visibly advance the interruption count in this renderer path, so it never reaches the required three-refresh escalation.

Required behavior:
1. Detect the connection-interrupted notice when it is rendered as the current owned assistant turn, not only as page chrome.
2. Exclude user quotations, Fabushi logs, blockquotes/code and longer assistant prose that merely discusses the phrase.
3. Persist the same conversation's interruption refresh count across reload/hydration/loading/generating scans. A transient disappearance of the banner immediately after refresh must not reset the count.
4. Use a short dedicated interruption retry cadence instead of the unrelated 3-minute generic stall cadence.
5. After exactly three refreshes, if the same conversation again shows the interruption notice, append `继续完成所有` in that same conversation.
6. Reset the interruption budget only when the conversation identity changes, a same-chat continuation is actually sent, or the task reaches a true final reply.
7. Release the userscript and synchronize the Fabushi Chrome host bundle.
