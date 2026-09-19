# CAR-008 — Persistent connection-interruption escalation

Status: complete
Started: 2026-09-19
Updated: 2026-09-19

Objective: make the three-refresh interruption budget observable and persistent when ChatGPT renders `连接已中断。正在等待完整回复` inside the live assistant turn after reload.

Acceptance:
- E1: current owned assistant turn with standalone Chinese/English interruption status is detected; page-level status remains supported.
- E2: user text, Fabushi logs, blockquote/code and long assistant discussion do not trigger.
- E3: interruption refresh attempts survive transient no-banner loading/generating scans on the same conversation URL.
- E4: interruption retries use a dedicated short cooldown rather than the 3-minute stalled-page cooldown.
- E5: first/second/third persistent detections perform refreshes and log the count; the next persistent detection sends `继续完成所有` in the same chat without opening a fresh chat.
- E6: budget resets on conversation change, actual continuation send, or true final completion; existing approval/rate-limit/final-toolbar rules remain authoritative.
- E7: userscript version increments, exact-head/main CI pass, Release is published, and the Chrome host bundles the exact released source in a new release.

Branch: `fix/interruption-count-persistence-2.9.43-20260919`
Delivery:
- PR #40 final head `4fdf8640d8c098b89cd57911d22760b65942500f`.
- Exact-head Test workflow `35427319201`: syntax + regression SUCCESS.
- Squash merge/release target `35685614b562ec4f0778a88cae4fea323181d338`.
- Post-merge main Test workflow `35427353343`: SUCCESS.
- Release `v2.9.43`, non-draft/non-prerelease; asset `chatgpt-auto-confirm.user.js`, 256512 bytes, sha256 `88ef4daae534d2ad605f25a4433a5bc3e2e687db0d89f1aae1bbf4e75c9d4998`.
- Paired Fabushi Chrome host PR #7 / source `0624c0a523dfc34f6d81c89a1aedc979e21a5152` / workflow `35427522662` / Release `v0.6.17`.
- Host package `fabushi-chrome-0.6.17.zip`, 134778 bytes, sha256 `e2f67044894f00996b2c4267d2d5e1f7c55726918372f8e8dafb87a355148b14`.
- Host bundled userscript blob is byte-identical to canonical v2.9.43 blob `7792ae5d0432ae0b3bc3f8504d7c70ecdc94e6ec`.
