# CAR-003 — Strict final-completion boundary

## Objective

修复授权卡/工具调用期间 Stop 按钮消失导致的误判：已绑定会话只有在当前 assistant turn 出现最终回复操作栏且 Stop 消失并稳定后才允许完成；其余 Stop 消失状态一律保留原会话等待，不触发 no-final fresh retry。

## Source

`source/2026-09-18-strict-final-completion-boundary.md`

## Acceptance

- A1: `Copy/复制回复 + Share/评价/Like/Dislike` 属于同一最新 assistant turn，且 Stop 不存在，稳定至少 4 秒后才进入 complete。
- A2: `data-is-streaming=false`、`aria-busy=false`、`data-complete=true` 等静态 marker 单独存在时不得完成。
- A3: Stop 消失但没有最终操作栏时，超过旧 15 秒和 5 分钟阈值仍保持原会话 waiting；不得返回 `no-final-reply`。
- A4: 授权卡存在时保持 approval 并走“允许本次会话”；授权卡扫描瞬时漏检也不得因此新建会话。
- A5: 3 分钟停滞恢复只刷新同一 conversation URL，不清除 token/轮次/附件。
- A6: 版本递增至 2.9.39；通过受保护主线合并后 canonical main 回读一致，并发布 GitHub Release v2.9.39。
- A7: 本轮用户未要求额外产品行为/E2E 测试；不得把未请求的行为测试设为发布门禁。仓库自身自动 CI 若因 PR/主线规则运行，按实际结果记录。

## Status

IN_PROGRESS — branch `fix/strict-final-completion-2.9.39-20260918`.

## Evidence

待记录：implementation commit / PR / exact-head status / merge SHA / canonical main / Release v2.9.39。
