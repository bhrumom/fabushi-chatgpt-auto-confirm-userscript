# Steps-only hourly rest — v2.10.78

Status: active
Owner: standalone userscript runner
Last updated: 2026-10-24

## Context and goal
The supplied Chrome screenshot shows thinking/tool work summaries without a reply body. The user requests one hour of rest before continuing in a new session, repeating the rest whenever the new session has the same symptom until a real reply appears.

## Requirements and acceptance criteria
- R1: Detect work activity structurally (tertiary assistant-message nodes), separately from primary reply content. Require exact route and current owned user boundary. Older, hidden, foreign and newer manual turns do not qualify.
- R2: Allow two minutes after work activity first appears without a reply, so ordinary initial tool work is not immediately abandoned. Activity updates do not restart this window. Suppress other recovery paths during observation.
- R3: Persist a fixed one-hour deadline on the task; scheduler, reload and workspace reconstruction honor it. During rest no automatic send, navigation or refresh for this task. Other tasks remain runnable.
- R4: At expiry recheck the owned reply. If a real body appeared, clear this policy and resume normal inspection. Otherwise preserve goal, round, attachments and work trace and queue a fresh session once. Override historical no-card prompts, but never pending authorization, settlement, blockers, ambiguous send, drafts or manual pause.
- R5: Subsequent sessions independently repeat R1–R4 without a retry cap. Work steps never count as final evidence. Clear observation on real reply or loss of ownership.
- R6: Show remaining rest time and log recovery; bump to 2.10.78; source/bundle parity and exact-head GitHub Actions before merge/release.

## Architecture and interfaces
Use the existing task state owner and taskDeferredUntil scheduler. Persist stepsOnlySince, stepsOnlyBoundary and stepsOnlyRestUntil in normal task snapshots. No independent timers. Inspection checks after route/turn/card/blocker checks and before generic Stop/stall recovery. Read current-bound activity and primary semantic roots only. Expiry uses queueInterruptedFreshRetry with a narrowly scoped historical-card bypass; pending-card checks stay active.

## Failure modes and constraints
Late real output is rechecked before handoff. Reload preserves the deadline, pause remains manual, a fresh session resets observation identity. Missing recognized activity uses existing recovery. Verification runs on GitHub Actions. Local bundle regeneration is deterministic source concatenation only.

## Implementation and verification
Add DOM/fake-clock regressions for step updates, grace, deadline, reconstruction, single expiry handoff, repeated sessions, real replies, old/manual/foreign activity, pending cards, drafts and pause. Run full Test on PR and main and existing successful-main Release. Verify release asset identity. Live Chrome installation and actual hour-long cycle are separately reported.

## Release, rollback and provenance
Deliver through PR and existing Test → Release workflow. Previous version 2.10.77 is rollback. Requirement source: user request and Chrome screenshot dated 2026-10-24. Existing abnormal work-trace carry preserves continuity.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R6 | blocked | Implementation / exact-head CI pending. |
| Live Chrome hourly cycle | blocked | Screenshot shows symptom only. |
