# CAR-006 — Recovery escalation and loading boundary

Status: complete
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

Delivery:
- PR #36
- Exact-head standard CI: run 35411328349 on `6e9729f32ec8933957e5c1e2b6ea00c73c9c9027` — success.
- Squash merge / release target: `84d0d8e7c6703ad399e3f0da0639942f41c8f738`.
- Post-merge main CI: run 35411367398 — success.
- Release: v2.9.41, published, non-draft/non-prerelease.
- Asset: `chatgpt-auto-confirm.user.js`, sha256 `681d50730566bd5f302f3c8b4e5d0ca1e4317951d7c018db565ccb8abf559218`.
