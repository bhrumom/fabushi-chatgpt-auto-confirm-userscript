# 2026-09-19 — Extend recovery refresh thresholds to 15 minutes

User requirement:
- ChatGPT 自动确认脚本当前普通页面连续约 3 分钟没有变化就刷新，时间太短。
- 普通“页面/会话没有可见变化”的自动刷新必须改为连续 15 分钟无变化后才触发。
- 若刷新后仍持续无变化，后续普通停滞刷新也保持 15 分钟间隔。
- 用户进一步明确：连接中断原先 10 秒/三次刷新的专用恢复也必须改为 15 分钟。
- 对“连接已中断，正在等待完整回复”的首次检测也不能立即刷新；先保持原会话，连续 15 分钟仍未恢复后才执行第 1/3 次刷新。
- 之后第 2/3、3/3 次刷新之间同样至少间隔 15 分钟；第 3 次刷新后仍存在时，保留现有行为，在原会话续发“继续完成所有”，不新建会话。
- 限流 cooldown、授权处理和其它与本需求无关的恢复策略保持现有行为。

Implementation constraints:
- Base on current live source v2.9.45; do not regress recent interruption/loading-recovery fixes.
- Increment userscript version to v2.9.46 so updateURL consumers can observe the change.
- Update user-facing logs/comments and deterministic regression tests together with timing constants.
- Preserve the exact three-refresh interruption budget and same-chat continuation semantics.
