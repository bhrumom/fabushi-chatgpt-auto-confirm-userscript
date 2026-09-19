# CAR-011 evidence — 15-minute generic stalled refresh

- Functional PR #46 final head: `d228a5d5de88c07af887c49e307c9a490043926e`.
- Exact-head Test run `35442187674`: SUCCESS.
- An earlier PR run `35442139807` failed only because legacy regressions still expected the old 3-minute cadence; those tests were updated to the new requirement before the successful exact-head run.
- Squash merge/release target: `4b02a2bde7a47705d473915c1f86421ce9d23e07`.
- Main Test run `35442218242`: SUCCESS.
- Userscript Release `v2.9.46`: asset `chatgpt-auto-confirm.user.js`, 262636 bytes, `sha256:d64b3df7334c622db7a96ecca1aeeb9356cc3d30f5bf7b7254d9a479b398a540`.
- Canonical v2.9.46 source blob: `a97bb5848eca83508c9fcd03872ecd57af33dd05`.
- Behavior regression proves generic stalled refresh does not repeat before 15 minutes and is allowed at 15 minutes; source assertions keep `AMBIGUOUS_SEND_REFRESH_MS = 3 * 60 * 1000`.
- Host PR #12 exact-head `0bdde2bd2f60a8409e603c0a3db7de1f0e556963`; workflow `35442363295` SUCCESS.
- Host merge/release source `4dbd229880786ce717cc7ecfe57cd39d7e34ccd0`; main workflow `35442384253` SUCCESS; tag/package/release workflow `35442405134` SUCCESS.
- Host Release `v0.6.19`: package `fabushi-chrome-0.6.19.zip`, 136285 bytes, `sha256:8b666d832a200e774646181c3d22b85d8b13b4e90139b5a48100f62da9516f31`.
- Host bundled userscript blob: `a97bb5848eca83508c9fcd03872ecd57af33dd05` (byte-identical to canonical v2.9.46).
