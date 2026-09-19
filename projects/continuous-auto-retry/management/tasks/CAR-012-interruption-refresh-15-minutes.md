# CAR-012 — Connection interruption refresh cadence = 15 minutes

Status: complete
Started: 2026-09-19
Updated: 2026-09-19

Objective: replace the 10-second connection-interruption refresh cadence with a 15-minute first/subsequent cadence while retaining exactly three refresh attempts and the existing same-chat continuation after exhaustion.

Acceptance:
- I1: first detection of “连接已中断，正在等待完整回复” records the interruption and does not reload immediately.
- I2: first refresh is eligible only after 15 minutes of uninterrupted failure.
- I3: second and third refreshes each require another 15-minute interval.
- I4: after 3/3 still interrupted, existing durable pending continuation sends “继续完成所有” in the same conversation.
- I5: interruption state still survives transient loading/generating hydration and resets on conversation change, successful continuation or true final completion.
- I6: generic stalled refresh remains 15 minutes; ambiguous-send remains 3 minutes; rate-limit/approval/loading/final boundaries are unchanged.
- I7: current logs/docs no longer describe 10-second interruption recovery.
- I8: userscript version increments from 2.9.46 to 2.9.47 with stable update/download URLs.
- I9: deterministic regressions cover pre-15-minute wait, exact 15-minute eligibility, 1/3→2/3→3/3 and same-chat continuation.
- I10: exact-head CI passes, protected merge completes, and canonical main readback proves v2.9.47 / 15-minute interruption constant.

Branch: `fix/interruption-refresh-15m-2.9.47-20260919`
Delivery:
- PR #47 exact head `a1bef9405ae2489117425a3e9c3f90908e887a2f`.
- Exact-head Test run `35442566038`: SUCCESS.
- Squash merge `d3b15050cd6d09e07680804f41d8b9c9c4226175`.
- Post-merge main Test run `35442627151`: SUCCESS.
- Canonical main readback confirms `@version 2.9.47`, `CONNECTION_INTERRUPTED_REFRESH_COOLDOWN_MS = 15 * 60 * 1000`, generic stall = 15 minutes, ambiguous-send = 3 minutes.
- Evidence: `projects/continuous-auto-retry/evidence/CAR-012/README.md`.
- No additional live-site/E2E behavioral test was requested.
