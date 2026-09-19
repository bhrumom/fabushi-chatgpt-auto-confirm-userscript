# CAR-011 — Generic stalled-page refresh cadence = 15 minutes

Status: in-progress
Started: 2026-09-19
Updated: 2026-09-19

Objective: increase only the generic bound-conversation no-visible-change refresh threshold/cooldown from 3 minutes to 15 minutes, without slowing explicit error/recovery flows.

Acceptance:
- H1: `STALLED_REFRESH_MS` is 15 minutes and `STALLED_REFRESH_COOLDOWN_MS` follows it.
- H2: a bound conversation with unchanged progress does not enter generic stalled refresh before 15 minutes.
- H3: at 15 minutes of unchanged progress, generic stalled recovery may refresh the same conversation; subsequent generic stalled refreshes remain at least 15 minutes apart.
- H4: user-facing generic-stall logs/docs say 15 minutes, not 3 minutes.
- H5: `AMBIGUOUS_SEND_REFRESH_MS` is explicitly decoupled and remains 3 minutes.
- H6: connection-interruption short recovery, rate-limit cooldown, loading route recovery, approvals and final-reply boundaries remain unchanged.
- H7: included in the pending v2.9.45 userscript + paired host release with CI/release evidence.

Branch: `fix/loading-recovery-scheduler-deadlock-2.9.45-r2-20260919`
PR/CI/Release/evidence: pending.
