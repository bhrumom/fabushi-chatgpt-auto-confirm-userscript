# CAR-008 — Persistent connection-interruption escalation

Status: in-progress
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
PR/CI/Release/evidence: pending.
