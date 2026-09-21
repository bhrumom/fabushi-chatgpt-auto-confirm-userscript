# CAR-015 — Abnormal fresh-chat assistant reply carry

Status: in-progress
Started: 2026-09-21
Updated: 2026-09-21

Objective: when a ChatGPT task conversation must move to a fresh chat without a true final reply, preserve the owned assistant work already visible in the abnormal conversation and make the next prompt explicitly continue from that work instead of blindly resending the previous instruction.

Acceptance:
- L1: capture only the current task's owned assistant turn before clearing the old conversation identity.
- L2: remove the standalone connection-interrupted product status from the carried work text.
- L3: Work recovery prompt part one is the current round instruction from review/next (or the current task prompt on the first round).
- L4: part two is the abnormal conversation's latest visible assistant work.
- L5: part three is the original task goal.
- L6: the new chat is explicitly told to continue from the interruption and not redo completed steps.
- L7: repeated abnormal fresh-chat hops replace carry with the newest bounded assistant reply instead of accumulating transcripts indefinitely.
- L8: carry is phase/round bound and is cleared by a true final reply or a manual goal edit.
- L9: review/planner fresh-chat recovery may carry partial review analysis while the current taskId/round remains authoritative.
- L10: v2.9.50 passes exact-head CI, protected merge, post-merge main CI, canonical readback, and GitHub Release publication.

Branch: `fix/abnormal-reply-carry-2.9.50-20260921`
