# CAR-010 — Loading recovery scheduler deadlock

Status: in-progress
Started: 2026-09-19
Updated: 2026-09-19

Objective: eliminate the silent scheduler stop after a same-route loading recovery and make the loading-recovery budget progress across reloads.

Acceptance:
- G1: same-route `recovery=true` commits a real reload; ordinary same-route navigation remains a no-op.
- G2: denied/stale/same-route-noop navigation branches re-arm scheduler after `navigating` clears.
- G3: committed navigation has a bounded watchdog that re-arms scheduler if no unload/navigation occurs.
- G4: inspection of a still-loading owned route does not reset `routeRecoveryAttempts` or `workspaceDocumentRecoveryAttempts`.
- G5: when loading truly clears, recovery counters and renderer exhaustion state reset.
- G6: deterministic regression reproduces the former 15:19 deadlock and proves scheduler continues after same-route recovery.
- G7: deterministic regression proves failed loading can progress 1/2 -> 2/2 -> document recovery instead of repeating 1/2.
- G8: v2.9.45 exact-head/main CI pass, Release published, and Chrome host bundles exact source in the pending next host release.

Branch: `fix/loading-recovery-scheduler-deadlock-2.9.45-20260919`
PR/CI/Release/evidence: pending.
