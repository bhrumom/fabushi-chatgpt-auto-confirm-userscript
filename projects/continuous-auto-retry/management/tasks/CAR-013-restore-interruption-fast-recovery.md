# CAR-013 — Restore explicit interruption recovery after scope correction

Status: in-progress
Started: 2026-09-19
Updated: 2026-09-19

Objective: undo the unintended CAR-012 connection-interruption 15-minute cadence while preserving the requested 15-minute generic stall refresh.

Acceptance:
- J1: `STALLED_REFRESH_MS` remains 15 minutes.
- J2: `AMBIGUOUS_SEND_REFRESH_MS` remains 3 minutes.
- J3: `CONNECTION_INTERRUPTED_REFRESH_COOLDOWN_MS` is restored to 10 seconds.
- J4: first connection-interruption detection may immediately perform refresh attempt 1/3; attempts 2/3 and 3/3 respect the 10-second dedicated cooldown.
- J5: after 3/3 still interrupted, the existing durable same-chat continuation path remains unchanged and actually sends `继续完成所有`.
- J6: CAR-012 is marked cancelled/superseded because its source interpretation was not the user's request.
- J7: userscript version advances to 2.9.48 so clients that observed the incorrect 2.9.47 can receive the corrected source.
- J8: exact-head/main CI pass, Release v2.9.48 is published, and the Fabushi Chrome host bundles the exact v2.9.48 source in a new release.

Branch: `fix/restore-interruption-fast-recovery-2.9.48-20260919`
PR/CI/Release/evidence: pending.
