# Missing reasoning picker active refresh — v2.10.15

Status: implementation
Last updated: 2026-09-30

## Problem

When ChatGPT partially hydrates the composer but does not mount the model/reasoning selector, the userscript logs:

`未找到 ChatGPT 模型/思考强度选择器；保留本轮发送意图，等待页面恢复，不会重复发送。`

The generic send-UI recovery waits 45 seconds and then uses the ordinary renderer-recovery budget. That budget is capped, so after exhaustion the task can remain in a permanent no-action wait even though a page refresh could restore the selector.

## Required behavior

- Never silently send with an unverified model/reasoning preset.
- Missing model/reasoning UI remains a recoverable pre-send renderer condition.
- Wait and re-scan first; do not hot-loop reloads.
- If the selector is still absent for 60 seconds, refresh the same ChatGPT page and re-check.
- If it is still absent after the refreshed document loads, repeat the same 60-second wait-and-refresh cycle with no terminal retry cap.
- This dedicated recovery must not be blocked by the generic two-attempt renderer-recovery exhaustion state.
- Preserve the exact task, phase, round, goal/next, attachments, prepared send intent, and do not click Send during recovery.
- Once the selector appears, clear the dedicated missing-picker recovery counters and continue normal preset verification.
- Apply the same active recovery to a reasoning menu whose slider fails to mount or disappears during adjustment.
- All verification runs in GitHub Actions only.

## Acceptance

A fixture with no reasoning picker must remain unsent, arm a missing-picker timer, and after the interval create a same-page recovery navigation even when generic renderer recovery is already exhausted. Existing five-position preset enforcement and all unrelated regressions must remain green.
