# WBS

| Task | Action | Acceptance | Verification | Status |
|---|---|---|---|---|
| CAR-001 | 不再停留 blocked，自动 fresh-session resend | R1-R5 | PR regression | done (PR #30) |
| CAR-002 | 发布 v2.9.37 | main + CI + Release | GitHub live evidence | done |
| CAR-003 | Stop 消失只作为中间状态；仅最终回复操作栏可完成当前会话 | A1-A5 | source diff + regression CI | done (PR #33) |
| CAR-004 | 发布 v2.9.39 独立 userscript | A6-A7 | canonical main + GitHub Release | done |
| CAR-005 | 已绑定异常会话持续在原会话发送“继续完成所有”，直到最终回复 | B1-B6 | source regression + CI + Release | done (PR #34 / v2.9.40) |
| CAR-006 | 三次连接中断刷新后同会话续发、第四次限流 fresh-session、修正伪 loading | C1-C6 | source regression + CI + Release | done (PR #36 / v2.9.41) |
| CAR-007 | 对话长度上限触发 fresh-chat 上下文接力，直到真正最终回复 | D1-D7 | source regression + CI + userscript/host Releases | done (PR #38 / v2.9.42 / host v0.6.16) |
| CAR-008 | 连接中断计数跨刷新/加载保持并在三次后同会话续发 | E1-E7 | source regression + CI + userscript/host Releases | done (PR #40 / v2.9.43 / host v0.6.17) |
| CAR-009 | 连接中断 3/3 后持久化强制续发，Stop 存在时先停止再真正发送 | F1-F8 | source regression + CI + userscript/host Releases | done (PR #42 / v2.9.44 / host v0.6.18) |
| CAR-010 | 修复 same-route 加载恢复导致 scheduler 静默停止并保持 1/2->2/2 计数 | G1-G8 | source regression + CI + userscript/host Releases | in-progress |
| CAR-011 | 通用会话无变化刷新间隔由 3 分钟改为 15 分钟，显式错误恢复保持原节奏 | H1-H7 | source regression + CI + userscript/host Releases | in-progress |
| CAR-012 | 连接中断首次及后续 3 次刷新统一为 15 分钟，3/3 后仍原会话续发 | I1-I10 | source regression + CI + main readback | done (PR #47 / v2.9.47) |
| CAR-013 | 连接中断立即放弃旧会话并新开 ChatGPT 会话原样重发当前阶段消息 | J1-J11 | source regression + CI + main readback | done (PR #51 / v2.9.48) |
| CAR-014 | 流式回复保持生成态、最终回复阻止加载恢复刷新、验收 taskId/round 强绑定 | K1-K11 | source regression + CI + Release | in-progress |
| CAR-015 | fresh-chat 异常恢复先保存当前 assistant 实时回复，并按“本轮提示词 / 已完成工作 / 原始目标”三段接力 | L1-L10 | source regression + CI + Release | in-progress |
| CAR-016 | ChatGPT 虚拟化任务 user turn 时，异常 fresh-chat 仍从精确任务 URL 安全提取当前 assistant 工作内容 | M1-M9 | regression + CI + Release | in-progress |
