# Interrupted Stop Stall Recovery — v2.9.72

## Goal

When recovery for an interrupted ChatGPT response clicks Stop but the Stop control never disappears, do not wait forever. After fifteen minutes without visible conversation progress, reload the exact bound conversation and retry the durable continuation intent.

## Behavior

- Only the interrupted-continuation path that owns a bound conversation may use this recovery.
- A still-visible Stop control is clicked once per page attempt. If it remains, the task stays bound to its original URL and keeps `pendingContinuationReason`, `pendingContinuationURL`, and `pendingContinuationStopRecovery`.
- Visible conversation progress resets the no-response timer.
- After fifteen quiet minutes, reload the same conversation, preserving the task phase, round, send identity, attachments, and pending `继续完成所有` intent.
- Apply the existing fifteen-minute same-session reload cooldown, including after reload, to prevent a refresh loop.
- When the page returns, if Stop remains, request Stop again once and continue waiting for the composer/send controls to recover. Send the continuation only after Stop disappears and the send control is available.
- Never open a fresh conversation or dispatch the goal again from this recovery.

## Verification

- Regression covers visible progress resetting the timer.
- Regression covers refresh at the fifteen-minute boundary, preservation of the continuation intent and conversation URL, and the post-refresh cooldown.
- Existing tests continue to cover one Stop click per attempt and no continuation send while Stop remains visible.
