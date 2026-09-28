# Transient local ChatGPT route quarantine — v2.10.6

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-28

## 1. Live failure

A fresh-session handoff successfully submitted a new Work message. ChatGPT briefly exposed this route:

`https://chatgpt.com/c/local-chatgpt%3A9d4bb335-4fb8-4588-bafd-1403a1a719a6`

The userscript logged the send as confirmed and persisted that route as the task's durable conversation URL. Later recovery repeatedly tried to navigate back to the transient local route, while the real durable conversation was:

`https://chatgpt.com/c/6aba1ad0-50c0-83e8-9b76-ade67716f47a`

## 2. Root cause

`parseConversationURL()` currently treats only `WEB:` conversation ids as synthetic. A `local-chatgpt:` id therefore passes through `canonicalConversationURL()`.

During `send()`, ChatGPT can render the task's own user marker before the server has replaced the local route with its durable conversation id. The existing rule:

`live /c/<id> + own [Fabushi:<token>] => captureConversationURL()`

then permanently records the local route.

This is a route-identity bug, not a send-confirmation bug.

## 3. Goals

1. Never persist or navigate to `/c/local-chatgpt:...` as a durable task identity.
2. Keep waiting for the real server conversation route after Send without clicking Send again.
3. Safely quarantine already-persisted local routes from older versions.
4. Preserve the task token, phase, round, goal, attachments, and original send intent while waiting for the durable route.
5. Repair the current known task to its user-confirmed durable URL without losing its paused state.

## 4. Requirements

- R1: `parseConversationURL()` classifies both unescaped and percent-escaped `local-chatgpt:` ids as transient/synthetic.
- R2: `canonicalConversationURL()` returns an empty string for `local-chatgpt:` routes.
- R3: `currentConversationURL()` never reports a local route as durable.
- R4: `recordConversationURL()` and `captureConversationURL()` cannot write a local route into `task.url`, `sessionUrl`, or `sessionUrls`.
- R5: `safeURL()`, direct navigation, recovery tickets, heartbeat recovery, and task inspection cannot navigate to a local route.
- R6: After Send, the presence of the task marker on a local route is not sufficient confirmation. The send remains ambiguous and waits for a durable route.
- R7: If the real durable route appears later with the same task marker, that durable route is captured and the original send is confirmed without a duplicate Send.
- R8: If the marker is temporarily unavailable, the existing bounded ambiguous-send confirmation path remains available; it may adopt only a durable route.
- R9: A persisted current binding that is `local-chatgpt:` is quarantined on upgrade. Its current `task.url` / `sessionUrl` are cleared and transient entries are removed from `sessionUrls`.
- R10: Quarantine of a task with an existing token and send timestamp converts it back to an ambiguous-send confirmation state instead of resetting the token or redispatching immediately.
- R11: A paused quarantined task stays paused. Its `pausedState` becomes `sending`; the 90-second confirmation window begins only when the user resumes it.
- R12: A non-paused quarantined task becomes `sending` and starts a fresh confirmation window immediately.
- R13: If the current page is already a durable route and visibly contains the quarantined task's own marker, upgrade migration may bind that durable route directly.
- R14: Historical durable session URLs remain audit evidence but must never be silently promoted as the current generation merely because the current local binding was rejected.
- R15: Existing `WEB:` synthetic-route behavior remains unchanged.
- R16: Existing fallback-turn DOM, final reply, bounded renderer recovery, attachment, navigation-guard, and multi-task regressions remain green.
- R17: Release as v2.10.6 only after exact-head and canonical-main tests pass.

## 5. Implementation

Add a single source of truth for transient conversation ids:

- `WEB:`
- `local-chatgpt:`

The prefix check happens after `decodeURIComponent()`, so both:

- `/c/local-chatgpt:...`
- `/c/local-chatgpt%3A...`

are rejected identically.

Add `quarantineTransientConversationBindings()` during startup before automatic recovery selection. It:

1. detects only the current binding (`task.url`) when it is transient;
2. refuses to recover a prior `sessionUrls` entry as the current generation;
3. removes the transient binding from current/session fields;
4. preserves token, phase, round, goal, attachments, and `sentAt`;
5. re-enters ambiguous-send confirmation rather than sending again;
6. preserves manual pause.

## 6. Regression tests

1. canonical URL rejects encoded `local-chatgpt%3A...`.
2. canonical URL rejects unencoded `local-chatgpt:...`.
3. a post-Send local route with the correct Fabushi marker is ignored.
4. when that same DOM later moves to a durable `/c/<server-id>`, exactly that route is recorded.
5. no local route enters `sessionUrls`.
6. upgrade quarantine keeps token/attachments and marks an active task as `sending + attempted`.
7. upgrade quarantine keeps a paused task paused and resumes it into bounded send confirmation rather than fresh dispatch.
8. migration never substitutes an older durable `sessionUrls` entry for the rejected current local binding.
9. existing `WEB:` tests remain green.
10. full suite remains green.

## 7. Acceptance

The exact observed failure must be impossible: a log after Send may wait while ChatGPT is on `local-chatgpt:`, but it must not print or persist that route as the recorded conversation. Only the later durable server `/c/<id>` is allowed to become the task identity.
