# CAR-005 — Same-chat abnormal continuation

## Objective

将已绑定 ChatGPT 会话的异常中断恢复从“新开会话重发”改为“原会话持续续写”，直到得到真正最终回复；只有确认最终回复后才允许进入下一轮新会话。

## Source

source/2026-09-19-same-chat-abnormal-continuation.md

## Acceptance

- B1: “消息错误/发送超时，请重试”属于当前最新回复时，在原 conversation URL 发送“继续完成所有”，不清除 URL/token/phase/round。
- B2: “连接已中断。正在等待完整回复。”持续满 30 分钟后，在原会话发送“继续完成所有”；30 分钟前允许按既有恢复机制刷新原 URL，但不得新开会话。
- B3: 已绑定会话连续 30 分钟仍无最终回复时，在原会话续发；续发后仍异常可继续续发，直到最终回复出现。
- B4: 续发 user turn 继续归属于原 Fabushi task；旧错误卡不能覆盖更新的最终回复。
- B5: 最终完成边界仍为当前最新 assistant turn 的最终回复操作栏 + Stop 不存在 + 稳定窗口；只有 finish() 后持续目标才能新开下一轮。
- B6: 版本递增至 2.9.40；PR 自动 CI 通过，合并后 canonical main 回读一致并发布 GitHub Release v2.9.40。

## Status

IN_PROGRESS — branch fix/same-chat-abnormal-continuation-2.9.40-20260919.

## Evidence

待补：implementation commit / PR / exact-head CI / merge SHA / canonical main / Release v2.9.40 / asset digest。
