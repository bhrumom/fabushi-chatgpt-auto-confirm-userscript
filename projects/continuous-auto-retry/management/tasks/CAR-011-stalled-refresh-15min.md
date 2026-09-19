# CAR-011 — 15-minute recovery refresh cadence

Status: in-progress
Started: 2026-09-19
Updated: 2026-09-19

Objective: make both ordinary no-visible-change recovery and explicit connection-interruption recovery wait 15 minutes before refreshing, while preserving the existing three-refresh interruption budget and same-chat continuation after exhaustion.

Acceptance:
- H1: ordinary stalled-conversation threshold is exactly 15 minutes (900000 ms).
- H2: ordinary stalled refresh cooldown remains aligned to the same 15-minute threshold.
- H3: unbound ambiguous-send page recovery that shares the ordinary stall cadence also waits 15 minutes.
- H4: first detection of “连接已中断，正在等待完整回复” does not reload immediately; the first refresh is eligible only after 15 minutes of uninterrupted failure.
- H5: interruption refreshes 2/3 and 3/3 each require another 15-minute interval.
- H6: after the third interruption refresh still fails, the existing durable pending continuation path sends “继续完成所有” in the same conversation.
- H7: user-facing logs/comments consistently describe 15-minute recovery; the old 3-minute and 10-second recovery wording is removed from current behavior.
- H8: rate-limit cooldown, approvals, continuation safety, task identity and attachment behavior remain unchanged.
- H9: deterministic regression proves no ordinary or interruption refresh before 15 minutes and eligibility at/after 15 minutes.
- H10: userscript version increments from 2.9.45 to 2.9.46 while stable update/download URLs remain unchanged.
- H11: exact-head CI passes, PR merges through repository governance, and canonical main readback shows v2.9.46 with the 15-minute constants.

Branch: `fix/stalled-refresh-15min-2.9.46-20260919`
PR/CI/main evidence: pending.
