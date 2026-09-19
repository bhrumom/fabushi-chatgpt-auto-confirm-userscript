# CAR-008 evidence — persistent connection-interruption escalation

- PR #40 final head: `4fdf8640d8c098b89cd57911d22760b65942500f`.
- Exact-head Test run `35427319201`: SUCCESS.
- Squash merge/release target: `35685614b562ec4f0778a88cae4fea323181d338`.
- Main Test run `35427353343`: SUCCESS.
- Userscript Release: `v2.9.43`, asset `chatgpt-auto-confirm.user.js`, 256512 bytes, `sha256:88ef4daae534d2ad605f25a4433a5bc3e2e687db0d89f1aae1bbf4e75c9d4998`.
- Canonical source blob: `7792ae5d0432ae0b3bc3f8504d7c70ecdc94e6ec`.
- Paired host: PR #7 / source `0624c0a523dfc34f6d81c89a1aedc979e21a5152` / workflow `35427522662` / Release `v0.6.17`.
- Host package: `fabushi-chrome-0.6.17.zip`, 134778 bytes, `sha256:e2f67044894f00996b2c4267d2d5e1f7c55726918372f8e8dafb87a355148b14`.
- Host bundled userscript content SHA: `7792ae5d0432ae0b3bc3f8504d7c70ecdc94e6ec` (byte-identical to canonical v2.9.43).
- Behavior covered by regression: standalone live assistant interruption detection, false-positive exclusions, persistent count through hydration/loading/generating, 10-second retry cadence, 1/3→2/3→3/3 logs, and same-chat `继续完成所有` after the third persistent refresh.
