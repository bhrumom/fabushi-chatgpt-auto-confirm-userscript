# CAR-011 — Generic stalled-page refresh cadence = 15 minutes

Status: complete
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
- H7: userscript v2.9.46 and paired Fabushi Chrome host release pass CI and publish with evidence.

Branch: `fix/stalled-refresh-15m-2.9.46-20260919`
Delivery:
- PR #46 final head `d228a5d5de88c07af887c49e307c9a490043926e`.
- Exact-head Test workflow `35442187674`: SUCCESS after updating legacy 3-minute regression expectations.
- Squash merge/release source `4b02a2bde7a47705d473915c1f86421ce9d23e07`.
- Post-merge main Test workflow `35442218242`: SUCCESS.
- Release `v2.9.46`; asset `chatgpt-auto-confirm.user.js`, 262636 bytes, sha256 `d64b3df7334c622db7a96ecca1aeeb9356cc3d30f5bf7b7254d9a479b398a540`.
- Fabushi Chrome PR #12 final head `0bdde2bd2f60a8409e603c0a3db7de1f0e556963`; exact-head workflow `35442363295` SUCCESS.
- Host merge/release source `4dbd229880786ce717cc7ecfe57cd39d7e34ccd0`; main workflow `35442384253` SUCCESS; tag/package/release workflow `35442405134` SUCCESS.
- Host Release `v0.6.19`; asset `fabushi-chrome-0.6.19.zip`, 136285 bytes, sha256 `8b666d832a200e774646181c3d22b85d8b13b4e90139b5a48100f62da9516f31`.
- Host bundled userscript blob is byte-identical to canonical v2.9.46 blob `a97bb5848eca83508c9fcd03872ecd57af33dd05`.
