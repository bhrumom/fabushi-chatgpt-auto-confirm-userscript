# Recovery lock and final response boundary

Status: active
Owner: standalone userscript
Last updated: 2026-10-10

## Context and goal
Live Chrome shows an empty current workspace beside recoverable iOS tasks. A second screenshot shows readable final Android output while the log says no final reply and starts a fresh handoff. Investigation found two reproducible gaps: explicit recovery tickets are consumed after failed lock acquisition, and a final assistant message replacing the thinking message loses the recorded assistant boundary after marker virtualization.

## Requirements and boundaries
- R1: A valid explicit workspace recovery must never consume its ticket or allocate an unrelated empty workspace while its owner lock is unavailable. Retry automatically with bounded polling; never steal a held lock.
- R2: Record the latest user boundary only during a task-owned Stop observation, scoped to the existing phase/round/token/URL generation identity.
- R3: After marker virtualization, a final response can replace the observed thinking message when the same recorded latest user boundary remains mounted. Require response-local final evidence, no Stop or approval, exact route and no competing owner/marker.
- R4: A newer user boundary, absent generation identity, unrelated route or foreign task must remain unowned. With no mounted user boundary retain the existing identical-assistant requirement.
- R6: On a restored canonical conversation with an empty session workspace and no ticket, automatically bind only one resumable task whose current URL exactly matches and whose owner heartbeat is stale with auto-resume enabled (or expired but explicit persisted auto-resume is true). Never infer from historical URLs or a fresh / page, and never override existing session tasks.
- R5: Preserve paused state, attachments, phase, round and send token. Never manually resend a task during acceptance.

## Architecture and implementation
The userscript bootstrap owns lock/ticket lifetime. Lock contention uses a specific retryable error and automatic delayed bootstrap; ordinary duplicate tabs retain independent identities. Final inspection uses a persisted user boundary from a positively owned generating turn, not arbitrary route-only assistant text.

## Verification and acceptance
Use real bootstrap under lock contention past the existing five-second deadline, release it, and assert the original owner/ticket are preserved and auto-start succeeds. Exercise thinking-to-final replacement with virtualized marker, changed user boundary and absent generation identity; run existing full regression. Live installed acceptance remains separate from repository CI.

## Rollback and observability
Rollback source to 2.10.39. Show recovery-waiting startup status rather than an empty workbench; no prompt contents in diagnostic logs.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1 | passed | Real bootstrap held owner lock beyond 5-second deadline, retained the original ticket and serialized tasks, then automatically reclaimed original owner after release. |
| R2-R4 | passed | Owned Stop observation followed by thinking-to-final node replacement and marker removal recognizes final; changed user boundary and absent generation identity reject it. Existing negative regressions pass. |
| R5 | passed | Bootstrap contention test preserves paused state, round and send token; no task prompt is clicked in this acceptance. |
| R6 | passed | Six bootstrap scenarios cover unique route, ambiguous task, paused task, live owner, populated session and historical-only route. |
| Full regression | passed | 393 total, 386 passed, 0 failed, 7 existing skips; syntax and diff checks passed. |
| Exact-head CI | passed | Runtime commit 11f7accdb5ebfbf32e6f0a2ef5a4bc4286041916, Test run 38016353518, job 114107367355: syntax and regression steps succeeded. |
| Release | blocked | Draft PR #160 is not merged; no main release claimed. |
| Installed automatic recovery | passed | Imported the same 2.10.40 source into installed extension dhkifbfnclknmafelblbhikfecdieoea. Original iOS tab changed from current tasks 0 to 1 with no Restore/Start click. Preserved Work round 3 and interrupted reply/reference transcript; automatically dispatched once at 10:20:45 and observed generating at 10:20:49 on https://chatgpt.com/c/6ac9a0f8-0294-83e8-94b3-919d05ad59d8, supervisor scanning. |
| Installed final-response incident | blocked | Regression covers reproducible ownership gap; original Android screenshot is historical after subsequent handoffs. Live final settlement on the new runtime and prolonged memory/hang endurance have not yet been observed. |
