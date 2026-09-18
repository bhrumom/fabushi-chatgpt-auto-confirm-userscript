# 2026-09-18 — Strict final-completion boundary

## Source requirement

用户在真实 ChatGPT 页面复现：出现 GitHub 等工具授权卡时，composer 旁的“停止回答”按钮会暂时消失；旧逻辑把“Stop 消失”当作会话结束信号，约 15 秒后走 no-final-reply fresh retry，导致当前会话尚未结束就新开会话并重复派发。

用户明确要求：

1. Stop 消失本身不是会话结束信号，因为授权、工具调用、renderer 过渡等多种正常状态都会让 Stop 暂时消失。
2. 只有当前任务最后一个 assistant turn 已出现最终回复操作栏（至少包含“复制回复/Copy”与同一回复的分享、评价、点赞或点踩之一），并且 Stop 已消失，稳定后才能判定为正常完成。
3. 没有最终回复操作栏时，无论 Stop 是否存在，都不能把当前会话判定完成，也不能仅因 Stop 消失而新开会话重发。
4. 授权卡继续按现有结构识别并自动选择“允许本次会话”。即使授权卡短暂未被 DOM 扫描识别，也必须 fail closed：留在原会话等待，而不是重发。
5. 对长时间无可见进展的已绑定会话，继续使用既有每 3 分钟刷新同一 URL 的恢复机制；保留 task URL、token、轮次与附件，不重发。
6. 发布新的独立 userscript 版本。由于 v2.9.38 已提供稳定 @updateURL/@downloadURL，新版本发布以 source canonical main + GitHub Release 为准，不要求为了油猴更新而同步 Marketplace 目录。

## Incident evidence

用户截图显示当前 ChatGPT 仍停在 GitHub 授权卡，但 Fabushi 日志已经记录“会话停止生成后没有新的最终回复或授权卡；插件已关闭当前会话目标，正在新开 Work/规划会话原样重发”，证明异常 fresh retry 与真实授权中状态发生冲突。
