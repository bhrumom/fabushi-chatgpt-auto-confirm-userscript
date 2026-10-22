# Optional bounded authorization gate and concurrent-request recovery — v2.10.67

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-22

## Context / goal
The user reports the current response stuck on `Too many concurrent requests`. They replace the mandatory authorization gate with an optional script-page switch. When enabled, continue in the same conversation at most three times without a card, then open a successor if no card appeared.

## Requirements / acceptance
- R1/AC1: Show a persisted workspace-scoped `新开会话前检查授权（最多继续3次）` checkbox in the script workbench. Default off for new and migrated workspaces. Changes take effect for existing tasks without dropping URL, phase, round or attachments. Other workspaces keep their settings.
- R2/AC2: Off bypasses the historical-card prerequisite, preserving all pending-card/settlement, ownership, pause and ambiguous-send guards. On requires a card or at most three same-route continuation sends before successor handoff. Count survives reload, migrates existing route-matched continuationCount, and cannot leak to a different conversation or reset by toggling.
- R3/AC3: Never send a fourth continuation. After three sends and another ended/interrupted response without a card, open a successor with the existing carry mechanism even if the response contains status=complete; do not silently mark the task done. Initial unbound dispatch remains possible.
- R4/AC4: Recognize the exact current-response `Too many concurrent requests` error with its local Retry control. Exclude quotes, old replies, foreign routes and user content. Wait 30 seconds, persist one retry intent before clicking, then allow 60 seconds for recovery. A persistent error uses the existing fresh-handoff/optional authorization gate instead of waiting forever. This error is never success evidence.
- R5/AC5: Do not retry while generating, paused, showing a pending card or settling authorization, holding an unrelated draft, or without owned route evidence. Preserve current task and attachments. Do not reuse a retry intent after reload or count retries as continuation sends.
- R6/AC6: GitHub Actions alone verifies generated bundle parity, syntax and full regressions. Inspect exact-head PR/main CI, guarded release, asset digest, installed and active Chrome runtime separately. Exercise the reported live conversation after installation when available.

## Architecture / data flow
Use the existing tabControls persistence for requireAuthorizationBeforeNewChat. The shared authorization guard checks current pending cards first, then toggle/history/route-scoped attempts. Count persisted send intents before click. finish explicitly routes an exhausted enabled gate through the existing carried fresh handoff. A bounded current-response concurrency handler precedes pending-continuation and generic ended classification, records route/user/response identity and retry deadlines, and delegates persistent errors to the same guard/handoff.

## Constraints / failure modes
No local builds or tests. Source concatenation is file generation; cloud performs parity/syntax/testing. An ambiguous Retry is not replayed after reload. A successful newer reply must not be overridden by an old error. Drafts and outstanding grants remain protected. Switching off clears obsolete pending gate waits, not conversation evidence or send counters. Rollback reverts source, tests, version and generated bundle together.

## Verification / release
Add regressions for on/off/persistence, exactly-three limit, route reset, final-report cap handoff, concurrency detection/quote exclusion, retry timing/reload, pending cards, pause and drafts. Publish v2.10.67 after Test; verify package digest and update original Chrome tabs in place.

## Provenance
User request and screenshot 2026-10-22; AGENTS.md; conversation-authorization-required-v2.10.66.md (superseded for mandatory/unbounded behavior); tested-github-release-delivery.md.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1-R6 / AC1-AC6 | pending | Implementation and verification pending. |
