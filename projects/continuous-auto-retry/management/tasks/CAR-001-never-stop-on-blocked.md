# CAR-001 — Never stop on blocked

Objective: autoResume 开启时，任何会进入 `blocked`/“需要处理”的运行时任务自动清理旧派发身份并进入新会话原样重发；历史 blocked 任务升级后自动恢复。

Source: `source/README.md`.

Acceptance: R1-R5 in `docs/02-需求与成功指标.md`.

Branch: `codex/continuous-auto-retry-20260918`.
PR: #30.
Status: in-progress, exact-head CI pending.
Implementation: v2.9.37 `queueBlockedFreshRetry`, blocked state interceptor, persisted blocked migration, review repair fresh retry, regression coverage.
Evidence: `evidence/CAR-001/README.md`.
Started/updated: 2026-09-18.
