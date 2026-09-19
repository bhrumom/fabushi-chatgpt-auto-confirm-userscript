# 2026-09-19 — Connection interruption refresh cadence to 15 minutes

Latest user requirement:
- The dedicated “连接已中断，正在等待完整回复” recovery currently uses a fast refresh cadence.
- Change that recovery to 15 minutes as well.
- First detection must not immediately refresh: keep the same conversation and wait 15 minutes.
- Refresh attempts 1/3, 2/3 and 3/3 must each be separated by at least 15 minutes.
- After 3/3 still fails, preserve the existing same-chat durable continuation behavior and send “继续完成所有”.
- Keep the already-merged generic stall threshold at 15 minutes.
- Keep ambiguous-send recovery at its existing independent 3-minute cadence; this follow-up does not request changing it.
- Preserve rate-limit cooldown, approvals, loading renderer recovery, task identity, attachments and final-reply boundaries.
