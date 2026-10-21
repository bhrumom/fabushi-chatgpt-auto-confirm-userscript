# Host memory pressure resume — Specification
Status: active
Owner: Fabushi standalone userscript
Last updated: 2026-10-21

## Context and goal
The reported Chrome tab uses 8.7 GB and exposes a 99% JS heap estimate. v2.9.99 explicitly disabled automatic host requests. Local cleanup cannot release the ChatGPT renderer. The current user explicitly requests host release and restoration; this supersedes v2.9.99 diagnostic-only requirements.

## Requirements
- R1: Two high-pressure samples at least 30 seconds apart request existing tab-memory-discard-resume; normal/unsupported samples reset the streak. Only a running auto-resumable workspace with one exact-route waiting/generating/reviewing task qualifies.
- R2: Preserve original tab-strip slot, exact conversation, task ID, phase, round, send token, attempted state and attachment metadata. Never create another task tab, fresh chat or send another prompt for memory recovery.
- R3: Refuse busy navigation, send/upload/loading/approval transitions, pending dispatch/attachments, visible approval cards, drafts, ambiguous ownership, paused workspace and failed durable writes. Persist and read back execution state and recovery ticket before host request; hold scheduler and approval actions while the host is deciding.
- R4: Use existing host route/checkpoint validation and cooldown. Chrome refuses active-tab discard: show this restriction, leave supervision intact, and retry after the tab becomes inactive. Do not steal focus. No unsafe direct reload fallback. Request timeout is bounded; retry after 60 seconds, successful request after 5 minutes. Persist a 5-minute automatic attempt cooldown across reload to prevent loops.
- R5: Diagnostics distinguish JS heap from total tab memory and report deferred/host outcomes. Keep bounded local cleanup and manual cleanup.
- R6: Build source modules, run regressions/full suite, publish tested canonical source and install in existing host script entry; verify original incident where tool access permits.

## Architecture / interfaces
Userscript samples and validates current task state, saves checkpoint, sends bounded diagnostics without task text to the existing content bridge. Host 0.7.2+ validates sender tab and durable ownership, discards then reloads the authoritative original tab ID with a recovery token. Existing task bootstrap resumes with unchanged send fences. Foreground Chrome discard is deferred until background.

## Verification / acceptance
AC1: Sustained pressure emits resume request; single spike and reset do not.
AC2: Protected states, failed storage and mismatched route send no request.
AC3: Request does not mutate execution identity; host refusal/timeout resumes scheduler, cooldown survives document replacement.
AC4: Host existing discard/resume tests and full userscript suite remain green. CI, release, installed version and live memory results recorded separately.

## Migration and rollback
No new permissions/schema required. Disable via existing workspace pause/autoResume. Previous release remains available for rollback. v2.9.99 is historical.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1 / AC1 | passed | Sustained-pressure and spike/reset regressions; bounded 30-second high-pressure timer. |
| R2 | passed | Request preserves execution identity; host memory-task-resume and task-recovery-adapter suites: 10 passed. Installed host 0.7.2 runner bytes match tested source. |
| R3 / AC2 | passed | Protected-state/storage matrix and scheduler fence regression; raw durable task readback before request. |
| R4 / AC3 | passed | Active-tab refusal retry, persisted success cooldown, simulated host-timeout handling and scheduler fence regressions. Existing background-clock tests cover deadline delivery. |
| R5 | passed | JS-heap status and host outcome messages; manual and local cleanup regressions. |
| R6 / AC4 local and installation | passed | Final suite: 457 tests, 450 passed, 7 existing skips, 0 failures. Build consistency, syntax and diff checks pass. Existing Chrome host entry reads enabled 2.10.60; original tab workbench displays new memory policy and original task. |
| AC4 natural high-pressure discard | blocked | During update, original task independently handed off via its ordinary abnormal-session policy from /c/6ad81323-6b0c-83e8-90d5-4a13d1014cca to /c/6ad815d5-6ea8-83e8-8d7d-356682e6459d. New runtime heap reads 666.3 MB, so no fresh natural high-pressure trigger is available. This decrease is not claimed as proof of new automatic discard. |
| R6 CI and publication | blocked | PR #178 created; exact-head CI and publication tracked in final delivery evidence. |
