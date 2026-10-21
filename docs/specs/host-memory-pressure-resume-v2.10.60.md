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
Pending implementation and verification; each R/AC will be recorded with evidence before final delivery.
