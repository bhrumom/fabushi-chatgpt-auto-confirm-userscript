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
| CAR-008 | 连接中断计数跨刷新/加载保持并在三次后同会话续发 | E1-E7 | source regression + CI + userscript/host Releases | in-progress |
