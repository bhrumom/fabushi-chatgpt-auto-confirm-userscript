# Ambiguous send confirmation visibility
Status: active
Owner: canonical userscript
Last updated: 2026-10-12

## Context and goal
The user sees "正在发送" and "扫描 0 次" on the ChatGPT home page after resuming an unacknowledged send. In the reported live trace, resume at 16:41:19 began the existing 90-second confirmation window; at 16:42:51 the existing bounded recovery ran. Version 2.10.49 later continued Work and Review. The missing status makes a guarded wait indistinguishable from a stopped runner.

## Requirements
R1: Distinguish prepared-but-not-clicked sends from attempted sends awaiting acknowledgement; show confirmation remaining time and expired-window recovery status in the workbench heading and diagnostic notice.
R2: Resume logs must explain that an unbound attempted send receives a new 90-second confirmation window, excluding paused time. Show original send identity is retained; do not imply a final-reply scan when the current send has no route.
R3: Repaint confirmation status on ordinary supervision ticks without new timers, faster polling, repeated activity logs, additional storage writes, or changing timeout/adoption/resend/approval rules.
R4: Paused tasks show paused status; marker/unique-route acknowledgement continues normally; no duplicate Send during the confirmation window; original token, attachments, phase and round remain unchanged.

## Scope and ownership
Canonical userscript UI/supervision only. No recharge, provider access, target Android implementation, or modification of target conversation instructions. The exhausted-workspace banner alone is not new proof that the click failed.

## Strategy and contracts
Derived confirmation-status helpers; existing 90-second deadline remains authoritative. Add UI paint to the current unacknowledged-send wait branch. Use existing task state and clocks, no persistence migration. Bump metadata/runtime to 2.10.50 and regenerate by source concatenation.

## Verification and acceptance
AC1: Initial/remaining/expired attempted-send status and paused state have fixture coverage.
AC2: Real pause/resume -> tick path displays the new confirmation window, keeps intent/phase/round, performs zero extra Sends, and schedules another tick.
AC3: Full GitHub Actions regression, syntax and generated-source checks pass; install and inspect the same Chrome task.
No local tests/builds; source concatenation permitted. Roll back by reinstalling 2.10.49.

## Compliance
R1-R4 / AC1-AC3: pending implementation, Actions and live acceptance.
