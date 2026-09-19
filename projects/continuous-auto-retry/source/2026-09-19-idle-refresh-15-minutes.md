# 2026-09-19 — Idle page refresh cadence to 15 minutes

User requirement:
- A page/conversation should be refreshed only after 15 minutes with no visible progress/change; the current 3-minute idle refresh is too aggressive.

Scope:
- Change only the generic bound-conversation stall detector/reload cadence from 3 minutes to 15 minutes.
- Keep explicit recovery paths independent: connection-interruption recovery remains its short dedicated cadence; rate-limit cooldown remains 5 minutes; loading renderer recovery keeps its existing bounded hydration/recovery timing; unbound ambiguous-send confirmation/recovery remains on its existing 3-minute cadence.
- Update user-facing logs/docs so they no longer claim generic stalled conversations refresh every 3 minutes.
- Add regression proving no generic stalled refresh before 15 minutes and refresh at/after 15 minutes.
