# CAR-005 evidence — same-chat abnormal continuation

## Baseline

- Source repository: bhrumom/fabushi-chatgpt-auto-confirm-userscript
- Baseline main: cb30da99bce3a02295863cfb9d74c592947e0a42
- Baseline release: v2.9.39
- Incident: v2.9.39 correctly stopped treating Stop disappearance as completion, but retryable message errors still routed a bound task through queueNoFinalReplyRetry(), and the connection-interrupted path stopped after two refreshes rather than continuing the same conversation.

## Candidate

- Branch: fix/same-chat-abnormal-continuation-2.9.40-20260919
- Target version: 2.9.40
- Same-chat continuation text: 继续完成所有
- Message error: immediate same-chat continuation when the retryable error belongs to the latest task reply.
- Connection interrupted: preserve same URL; after 30 minutes send same-chat continuation.
- General bound no-final stall: after 30 minutes send same-chat continuation.
- Final authority remains the current assistant reply toolbar; a stale earlier error card cannot override a newer final reply.

## Delivery evidence

- Implementation commits: 68eced0020aea2bc1d8a9e005873cb94e307aa4e, 7665b1475fe0c1f3ff57366802c2ce2928289e49
- Regression commits: 0b4b1d5be76d7a6203260e1a86916964f20748c8, 7d9a49c0f5262f0d3bcfee5707345ee07c9906db
- PR: #34 — `fix: continue abnormal replies in the same chat`.
- Exact-head CI: run `35374393013` on `174fb954ad76e5aa81da6f8f1cc7ba9c04f8bb42` — SUCCESS; syntax check + 135/135 regression tests.
- Merge/release SHA: `9d34b1da774cdc5f4c4746b0ea39b26911f0f48c`; canonical main readback showed userscript `@version 2.9.40` / runtime `VERSION = '2.9.40'`.
- Release v2.9.40: pending.
- Release asset: `chatgpt-auto-confirm.user.js`, 244265 bytes, `sha256:95447daec0d0a8eaa8a71b810dfb9725d501cf17a5decef73bddf722b5c5298c`.
