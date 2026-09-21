# 2026-09-21 — Abnormal fresh-chat assistant reply carry

Latest user requirement:
- When a ChatGPT conversation has no final result but becomes abnormal and must be replaced by a fresh chat, do not resend only the previous prompt.
- Read the abnormal conversation's current ChatGPT assistant response first so the next chat knows what work was already done.
- The next Work prompt must contain three explicit parts in this order: the final current-round instruction from the review/acceptance session; the abnormal conversation's already-produced assistant work; the original goal.
- The new chat must continue from the interrupted work rather than restart completed steps.
- Apply the same principle to other abnormal fresh-chat recovery paths where ownership of the current assistant reply can be proven.
- Publish a new userscript version after verification.

Implementation target:
- v2.9.50.
- Capture only an owned assistant turn whose live conversation URL matches the task URL.
- Strip the standalone connection-interrupted status from the carry and bound its size using the existing continuation limit.
- Bind the carry to phase/round; replace it with the latest abnormal hop; clear it on final completion or goal edit.
- Preserve review taskId/round report identity even when review recovery carries partial review output.
