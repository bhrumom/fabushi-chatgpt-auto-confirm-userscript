# Stream cache expired recovery — v2.9.94

Status: active
Owner: Fabushi userscript
Date: 2026-09-27

## Context and goal
The supplied screenshots show a stopped response with a `Stream cache expired` card and 重试, while the workbench reports loading and repeated route recovery. Version 2.9.93 does not recognize this terminal error. Recognize it before stale loading/stall handling and retry the current conversation.

## Requirements and acceptance
- R1 / AC-1: Recognize standalone Stream cache expired with an enabled nearby Retry/重试 in the current response, including a sibling error card outside the assistant message. Ignore quoted text, history, workbench logs, and unrelated retry controls.
- R2 / AC-2: Exact task route and current turn ownership (including existing marker-virtualized route fallback), no Stop, approval, rate limit, blocker, ambiguous send, or newer final response remain required. Observe eight stable seconds; stale loading/streaming must not mask this terminal error.
- R3 / AC-3: Retry the current conversation once per response/user boundary, keep goal/phase/round/attachments, and do not mark the error as successful completion. If the retry remains stuck, preserve existing 15-minute recovery policy. A new user boundary permits another retry.
- R4 / AC-4: Preserve successful final-toolbar recognition and existing generic network-error/connection-interruption recovery. Do not carry the cache-error text as useful work.
- R5 / AC-5: Bump metadata/runtime/README to 2.9.94; syntax and full regression tests must pass; publish through tested main and verify release SHA and exact asset bytes.

## Design and scope
Userscript only; no host-extension or dependency changes. Add a bounded error-card detector returning the actionable Retry control, limited to the latest user boundary/current response. Feed its terminal evidence into existing ended-state gates. Persist a response key before clicking to prevent repeat clicks across scans/reloads. After a retry, normal progress and final detection resume; an unchanged failed retry waits for the existing stalled recovery path. No changes to final-result ownership or the 15-minute stall threshold.

## Verification and risks
Reproduce the screenshot structure in jsdom, including a stale spinner, missing marker, and sibling error card. Check negative cases (history, quotes, missing/disabled Retry, Stop, foreign route, newer final). Run all existing tests. Exact live ChatGPT DOM was not supplied, so tests model the visible screenshot and known renderer variants. No migration; rollback by a follow-up version reverting this change.

## Provenance
User request and two screenshots from conversation 6ab89b94-28c8-83e8-8eee-2d345cd0fccb; AGENTS.md; stale-activity-on-network-error-v2.9.90.md; recovered-final-toolbar-wins-loading-v2.9.93.md; tested-github-release-delivery.md. This spec changes cache-expiry recovery to prefer the current conversation; existing generic network-error policy remains.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R5 / AC-1–AC-5 | pending | Implementation and publication checks follow. |

Local verification: old 2.9.93 fails both screenshot recovery cases (owned and virtualized marker); 2.9.94 passes 13 cache-expiry cases. Full suite: 248 tests, 241 passed, 7 pre-existing skipped, 0 failures. Syntax and whitespace checks pass. R1–R4 / AC-1–AC-4: passed (current-response/sibling detection, stop/approval/ambiguous/foreign/final guards, one-click retry, existing recovery regressions). R5 / AC-5 publication verification is pending the protected Test → Release workflow.
