# CAR-013 — Connection interruption -> immediate fresh chat resend

Status: in-progress
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
PR/CI/main evidence: pending.
