# 2026-09-19 — Extend no-change refresh threshold to 15 minutes

User requirement:
- ChatGPT 自动确认脚本当前页面连续约 3 分钟没有变化就刷新，时间太短。
- 普通“页面/会话没有可见变化”的自动刷新必须改为连续 15 分钟无变化后才触发。
- 若刷新后仍持续无变化，后续普通停滞刷新也保持 15 分钟间隔。
- 与普通停滞不同的显式故障恢复（例如“连接已中断”的专用恢复、限流 cooldown）保持各自现有策略，不因本需求被放大到 15 分钟。

Implementation constraints:
- Base on current live source v2.9.45; do not regress recent interruption/loading-recovery fixes.
- Increment userscript version so updateURL consumers can observe the change.
- Update user-facing log text and deterministic regression tests together with the timing constant.
