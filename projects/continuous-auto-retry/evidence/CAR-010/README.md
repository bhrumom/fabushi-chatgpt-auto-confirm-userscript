# CAR-010 evidence — loading recovery scheduler deadlock

- Functional PR #45 final head: `640b5974eff17fd5e1db6234afb3934b0d89bf16`.
- Exact-head Test run `35433402499`: SUCCESS.
- Squash merge/release target: `eb0b3fc5920b88ba5229d88e49383f6c8c2d5f66`.
- Main Test run `35433433244`: SUCCESS.
- Userscript Release `v2.9.45`: asset `chatgpt-auto-confirm.user.js`, 262601 bytes, `sha256:55572df2b59063b56a1f69707c29f6a3d2450364faef2bff2a5072b5c69be108`.
- Regression coverage: same-route recovery commits a real reload, async cancellation re-arms the scheduler, no-unload watchdog releases `navigating`, loading keeps route recovery counters, load completion resets them, and route recovery progresses 1/2 -> 2/2 -> document handoff.
- Host exact-v2.9.45 publication was superseded before release by CAR-011. Host PR #12 / Release `v0.6.19` bundles exact v2.9.46 blob `a97bb5848eca83508c9fcd03872ecd57af33dd05`, which contains all CAR-010 runtime changes.
- Host tag/package/release workflow `35442405134`: SUCCESS; package `fabushi-chrome-0.6.19.zip`, 136285 bytes, `sha256:8b666d832a200e774646181c3d22b85d8b13b4e90139b5a48100f62da9516f31`.
