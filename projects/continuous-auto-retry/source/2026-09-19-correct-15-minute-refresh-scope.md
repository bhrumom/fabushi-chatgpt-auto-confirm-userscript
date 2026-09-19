# 2026-09-19 — Correct scope of the 15-minute refresh request

Authoritative user wording:
- “页面需要15分钟内没有变化才刷新，现在3分钟太短了，改为15分钟。”

Scope correction:
- This request changes the generic page/conversation no-visible-change stall refresh from 3 minutes to 15 minutes.
- It does NOT change explicit error recovery for `连接已中断。正在等待完整回复。`.
- The previously merged CAR-012/v2.9.47 interpretation that changed connection-interruption recovery from 10 seconds to 15 minutes was not requested and conflicts with earlier requirements to recover the interrupted conversation promptly through three attempts and then append `继续完成所有`.
- Restore the dedicated connection-interruption refresh cadence to 10 seconds while keeping generic stall refresh at 15 minutes and ambiguous-send recovery at 3 minutes.
- Because v2.9.47 was briefly present on canonical main, increment to v2.9.48 so any client that observed the incorrect 2.9.47 metadata can update to the corrected behavior.
