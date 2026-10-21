# Conversation-scoped approval first — v2.10.63

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-22

## Context and goal
The user reports a real split authorization card offering a conversation grant while the script clicks Allow once without opening the arrow. v2.10.52 removed the scoped path. This specification supersedes its primary-only policy and reconciles v2.10.51 with the current user request.

## Requirements and acceptance
- R1 / AC1: For a trusted split card, open its enabled arrow with the existing pointerdown/click adapter and prefer an exact Chinese or English conversation/session grant, including connector-named English options.
- R2 / AC2: Observe asynchronously mounted menu content for a bounded interval. Search only the arrow-controlled menu, a menu inside this card, or newly opened visible menus; never choose an unrelated pre-existing menu.
- R3 / AC3: Reject permanent, low-risk, and all-conversation choices. If no session option appears within the observation interval, preserve exact primary Allow/Allow once fallback; cards without an arrow retain direct approval. Disabled arrows must wait rather than bypass scope selection.
- R4 / AC4: Preserve pause/cancel/abort, exact route and connected/enabled DOM checks, submission deduplication and settlement protection for either grant path. Revalidate after each asynchronous wait and before submission.
- R5 / AC5: Update settings text, regression coverage and generated bundle. Run tests and build verification in GitHub Actions only; local deterministic source concatenation is allowed for the committed userscript.
- R6 / AC6: Deliver through PR, passing exact-head CI, main integration and guarded release. Inspect installed Chrome update and real approval if available; report any unavailable live evidence explicitly.

## Architecture and strategy
Keep cards() as presence authority and authorize() as the only action path. Select a scoped target after the existing dedupe guards; apply the same settlement and pacing to both paths. No task or storage schema changes.

## Failure modes and validation
Cover real Radix pointerdown div menuitems, Chinese and connector-named English grants, delayed rendering, unrelated menus, permanent rejection, disabled arrow, cancellation during observation and duplicate suppression. Existing authorization and full suite run in CI.

## Release and rollback
Bump to v2.10.63; rollback via a subsequent tested release. Existing task checkpoints remain compatible.

## Spec compliance record
Pending CI, release and installed-runtime inspection.
