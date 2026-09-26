# Same-tab stalled route recovery — v2.9.87

## Goal

Keep recovery of a stalled ChatGPT conversation inside the current browser tab. If the bounded quick reload attempts do not restore the page, preserve the current workspace owner and wait before reloading the same conversation again.

## Requirements

- Never switch to `/` or ask the host to open a replacement tab for renderer recovery.
- Preserve the current task, phase, round, send identity, attachments, conversation URL, and workspace lock during recovery.
- After two quick recovery loads fail, wait 60 seconds, reload the same `/c/<id>` route, and continue waiting. Repeat with the same bounded cadence until loading clears or the task is explicitly paused/finished.
- Keep the no-duplicate-send, active-generation, and owned-final-reply protections.
- If a reload request does not unload the document, release the navigation barrier and keep supervising from the current tab.

## Implementation

The recovery ticket remains bound to the current conversation URL. `routeRecoveryRetryAt` persists the one-minute backoff; after the deadline, the route recovery counter is reset and the existing same-route reload path is used again. The fresh-document recovery function and lock-yield behavior are removed from this failure path.

## Verification

JSDOM regressions cover the backoff, same-route ticket, persisted task/attachment/send identity, and retained workspace lock after a failed reload. Exact-head CI and real Chrome validation are recorded with the release evidence.
