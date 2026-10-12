# Work final ownership after send adoption and pause navigation recovery
Status: active
Date: 2026-10-12
Owner: canonical userscript

Problem: live Work routes have natural text and final response toolbar, but marker-virtualized sends adopted by tick lack a recovered final identity. Work is then incorrectly fresh-handoffed. Pausing during send confirmation leaves navigating=true; Continue schedules nothing because schedule suppresses navigation, while this send path has no commit watchdog.

R1: Successful guarded adoption of an unbound attempted send snapshots exact URL/token/phase/round/goal revision and current visible user boundary using existing recovered identity helper. Also arm identity after ordinary send confirmation. No broad arbitrary route ownership.
R2: A resumed pending send with an already-bound route and existing owned final proof clears attempted and inspects the original reply without another Send.
R3: Pausing the currently executing task clears its transient navigation latch/timer and settles pending host navigation requests, while retaining send intent/token/URL/ticket. The task remains paused and other tasks remain unchanged. Resume can schedule again; busy guard prevents overlapping execution.
R4: Current reply toolbar finishes Work through normal stability gate -> Review. Foreign routes/tasks/newer user boundaries and nonfinal responses remain fail-closed.
R5: Release 2.10.49 with matching metadata/runtime/assertions. Preserve previous Review interruption and host reload fixes.

Tests: real adoption -> final inspection with missing marker; negative newer user; pause after send navigating latch -> resume scheduler timer; bound pending final clears attempted with no Send; full regression and exact-head Actions. Keep user-paused Android task paused through installation. No migration/build/secret work is performed in the target conversations.

Acceptance: normal Work completion stops repeated fresh-handoffs; Continue re-arms task supervision; no duplicate send/new arbitrary ownership. Native installation and progress are separate from fixture/CI acceptance.

Compliance pending checks.

| Requirement | Status | Evidence |
| --- | --- | --- |
| R1 | passed | Real adoption helper arms boundary; markerless final fixture transitions Work to Review. |
| R2 | passed | Resumed bound attempted-send fixture clears attempted and records final with zero Sends. |
| R3 | passed | Pause with navigating=true clears latch; Continue arms timer, preserves token/attempted. |
| R4 | passed | Newer-user negative fixture rejects ownership; full prior ownership suite remains green. |
| R5 | passed | Metadata/runtime/version assertions use 2.10.49; generated build and full regression pass. |

Local full regression: 423 total, 416 pass, 7 skipped, 0 failure.
Live acceptance: pending installed update; intentionally paused tasks must stay paused. Current original incident routes already changed during the repeated legacy handoff loop, so do not claim exact original-task completion from fixtures.
