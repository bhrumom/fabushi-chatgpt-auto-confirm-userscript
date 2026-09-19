# CAR-010 — Loading recovery scheduler deadlock

Status: complete
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
- G8: v2.9.45 exact-head/main CI pass and Release published; before a host bundle of v2.9.45 was released, the user requested CAR-011/v2.9.46, so the host requirement was superseded by v0.6.19 bundling exact v2.9.46, which contains the v2.9.45 loading-recovery fix.

Branch: `fix/loading-recovery-scheduler-deadlock-2.9.45-20260919`
Delivery:
- PR #45 final head `640b5974eff17fd5e1db6234afb3934b0d89bf16`.
- Exact-head Test workflow `35433402499`: SUCCESS.
- Squash merge/release source `eb0b3fc5920b88ba5229d88e49383f6c8c2d5f66`.
- Post-merge main Test workflow `35433433244`: SUCCESS.
- Release `v2.9.45`; asset `chatgpt-auto-confirm.user.js`, 262601 bytes, sha256 `55572df2b59063b56a1f69707c29f6a3d2450364faef2bff2a5072b5c69be108`.
- Host exact-v2.9.45 bundle was superseded before publication by CAR-011. Fabushi Chrome PR #12 / v0.6.19 bundles exact v2.9.46 blob `a97bb5848eca83508c9fcd03872ecd57af33dd05`, which includes all CAR-010 runtime changes.
- Host v0.6.19 tag/package/release workflow `35442405134`: SUCCESS; package sha256 `8b666d832a200e774646181c3d22b85d8b13b4e90139b5a48100f62da9516f31`.
