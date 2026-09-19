# CAR-006 — Recovery escalation and loading boundary

Status: in-progress
Started: 2026-09-19
Updated: 2026-09-19

Objective: make connection interruption, repeated rate limits, and Stop/loading ambiguity converge automatically without misclassifying an abnormal stop as page loading.

Acceptance:
- C1: 3 same-conversation connection-interruption refreshes, then next detection sends “继续完成所有” in the same chat.
- C2: >3 distinct rate-limit cooldown episodes queues a fresh-session resend, preserving current task goal/phase/round/attachments.
- C3: owned conversation with no Stop/card/final is not kept indefinitely in loading due decorative/spurious loading indicators; after a short stable grace it sends same-chat continuation.
- C4: real generating state with Stop remains generating; approval card remains approval; verified final toolbar remains authoritative completion.
- C5: retryable message error remains immediate same-chat continuation.
- C6: version increments from 2.9.40, exact-head CI passes, merge/main CI passes, Release and asset digest recorded.

Branch/PR/commit/evidence: pending.
