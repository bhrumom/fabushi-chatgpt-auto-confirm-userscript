# 2026-09-19 — Connection interruption switches directly to a fresh chat

Latest user requirement:
- When ChatGPT shows “连接已中断，正在等待完整回复”, do not wait 15 minutes.
- Do not refresh the interrupted conversation three times.
- Do not append “继续完成所有” in the interrupted conversation.
- Immediately abandon the interrupted conversation as the active dispatch target, open a fresh ChatGPT conversation, and resend the current task message.
- Preserve the same task, phase, round, goal/next instruction, attachments, and automatic execution state.
- Use a new dispatch token/conversation identity so the fresh message can be bound safely.
- Keep generic 15-minute no-visible-change recovery, ambiguous-send recovery, rate-limit handling, approval handling, loading recovery, and true-final detection unchanged.
