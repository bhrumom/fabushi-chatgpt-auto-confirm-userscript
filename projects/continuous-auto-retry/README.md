# Continuous Auto Retry

目标：ChatGPT 自动确认 userscript 在自动运行开启时不得停留在“需要处理”；任何本可进入 blocked 的可恢复错误都应清理旧派发/会话身份，进入新的 ChatGPT 会话原样重发并继续运行。

当前阶段：v2.9.37 实现与 PR 验证。权威状态见 `PROJECT.yaml`、`management/tasks/CAR-001-never-stop-on-blocked.md` 与 `evidence/CAR-001/README.md`。
