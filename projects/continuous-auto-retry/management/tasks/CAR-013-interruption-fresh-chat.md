# CAR-013 — Connection interruption -> immediate fresh chat resend

Status: complete
Started: 2026-09-19
Updated: 2026-09-19

Objective: replace the entire connection-interruption wait/refresh/same-chat-continuation path with an immediate fresh-chat redispatch of the current phase message.

Acceptance:
- J1: an owned current conversation that shows the exact connection-interruption notice immediately leaves the old conversation as the active task URL; there is no 15-minute wait.
- J2: connection interruption performs zero same-conversation reload attempts.
- J3: connection interruption does not create a pending same-chat “继续完成所有” continuation.
- J4: the task is re-queued for a fresh ChatGPT conversation with a new dispatch token and conversation identity.
- J5: phase, round, goal/next instruction, attachments, mode, and task identity are preserved; only dispatch/session state is reset.
- J6: the old interrupted conversation is retained in history/evidence so recovery does not erase provenance.
- J7: fresh redispatch uses the normal Work/planner prompt for the current phase, so the actual current task message is sent automatically in the new chat.
- J8: generic stalled refresh remains 15 minutes; ambiguous-send/rate-limit/approval/loading/final-completion behavior is unchanged.
- J9: deterministic regressions prove immediate requeue, preserved task context, cleared old URL/token, no refresh/pending continuation, and successful fresh-message preparation.
- J10: userscript version increments from 2.9.47 to 2.9.48 with stable update/download URLs.
- J11: exact-head CI passes, protected squash merge completes, post-merge main CI passes, and canonical main readback proves the fresh-chat interruption behavior.

Branch: `fix/interruption-fresh-chat-2.9.48-20260919`
Delivery:
- PR #51 final head `b99fc339066dfc4c97492094e1d41e76f97d6b01`.
- Exact-head Test run `35447029840`: SUCCESS.
- Squash merge `446698b4523beaf20a67c1889099fe75f7bc473b`.
- Post-merge main Test run `35447062729`: SUCCESS.
- Canonical main readback confirms `@version 2.9.48`, immediate `queueInterruptedFreshRetry`, one-shot `connectionInterruptedFreshDispatch`, generic stall = 15 minutes, ambiguous-send = 3 minutes, and removal of the old interruption refresh/pending-continuation runtime.
- Evidence: `projects/continuous-auto-retry/evidence/CAR-013/README.md`.
- No additional live-site/E2E behavioral test was requested.

Implementation candidate:
- userscript version: v2.9.48
- connection interruption handler: `queueInterruptedFreshRetry`
- old same-chat interruption refresh function removed
- old interruption pending-continuation runtime removed
- fresh resend preserves task/phase/round/goal/next/attachments and records the old conversation in history
- one-shot `connectionInterruptedFreshDispatch` bypasses the normal inter-conversation send cooldown only for this recovery
- regression coverage added for immediate requeue, live interruption -> fresh send, legacy pending migration, repeated interruptions, and source guards
- implementation and delivery evidence finalized above.
