# Current-response conversation-length handoff — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-23
Related issue/task/PR: user live incident 2026-09-23

## 1. Context / problem

The conversation-length handoff currently copies `turn.text`, which is only the last assistant DOM node selected by `latestTurn()`. ChatGPT may split one response across multiple assistant segments, and the last segment may be a status/tool shell. This can omit the substantive latest work. If no turn text is available, the current code can copy the length-limit notice itself as if it were the reply.

## 2. Goal

Carry the visible assistant response belonging to the current task turn into the next chat, and never substitute an older reply or the length-limit notice for that response.

## 3. Non-goals / out of scope

- Do not change same-chat connection-interruption handling.
- Do not include earlier task turns, user messages, tool controls, hidden content, or another task's transcript.
- Do not change phase, round, attachment, or prompt ordering semantics.

## 4. Requirements

- R1: Extract the current task's visible assistant transcript using the exact conversation URL and current user-turn ownership boundary.
- R2: Preserve all substantive visible assistant segments for that response in document order; do not rely only on the final assistant DOM node.
- R3: Exclude the length-limit notice itself from carried work.
- R4: If current-turn ownership or substantive reply text cannot be established, do not queue a handoff with stale `turn.text` or notice text; keep the existing task/session and wait for safe content.
- R5: Keep the carry bounded and preserve existing phase/round/attachment behavior.
- R6: Add regressions for split replies with a trailing status-only assistant node, an unrelated earlier assistant reply, a stale `turn.text`, and missing/ambiguous current-turn content.
- R7: Bump userscript metadata/runtime and README version to 2.9.71.
- R8: If the current assistant response is still streaming or the Stop control is visible, defer handoff until generation ends.

## 5. Current state

`queueConversationLengthHandoff()` currently uses `turn?.text || noticeText`. `latestTurn()` returns only the last assistant node, while the existing `visibleAssistantWorkTranscript()` already gathers visible assistant segments after a task-owned user boundary but is only used for abnormal recovery.

## 6. Target state

Length handoff uses the task-scoped visible assistant transcript. The prior turn is excluded by the current task user boundary, and a notice-only or ambiguous transcript cannot cause a fresh-session dispatch.

## 7. Architecture and ownership boundaries

Canonical repository: `bhrumom/fabushi-chatgpt-auto-confirm-userscript`.

Ownership order: exact canonical conversation URL → task marker/current user boundary (or guarded exact-route fallback when the marker is virtualized) → visible assistant semantic content after that boundary. Existing foreign task/URL owner guards remain authoritative.

## 8. Interfaces / contracts / schemas / data flow

No external schema change. `lengthLimitCarry` remains a bounded string stored with its source URL and hop count. Data flow: detected length notice → extract current task response → strip the notice → persist carry → clear old dispatch → construct next Work/Review prompt.

## 9. Constraints and non-functional requirements

- Fail closed across task and route ownership.
- Never treat a product notice as assistant work.
- Keep existing maximum carry size and prompt structure.

## 10. Failure modes and edge cases

- Response split into multiple assistant nodes: combine substantive segments.
- Last segment is empty/status-only: retain earlier segments from the same current response.
- Older assistant response before current task user message: exclude it.
- Newer unrelated user turn or foreign task owner: do not hand off with that content.
- Only the limit notice is visible: wait; do not create a misleading fresh prompt.
- Stop control/streaming state remains active: wait in the exact existing conversation and extract the completed response on a later inspection.

## 11. Implementation strategy

1. Reuse the existing task-scoped visible assistant transcript extractor for length handoff.
2. Strip the exact recognized length notice from carry text.
3. Refuse to queue when no substantive, owned carry exists and keep inspection in a waiting state.
4. Add focused DOM regressions and bump to 2.9.71.

## 12. Verification / test strategy

- `node --check chatgpt-auto-confirm.user.js`
- `npm test`
- Verify fresh Work and Review prompt carry semantics remain unchanged.

## 13. Acceptance criteria / Definition of Done

- AC-1: The carry includes all substantive current-response segments and excludes a trailing notice/status segment.
- AC-2: Earlier assistant replies and stale `turn.text` are never used in place of the current task response.
- AC-3: Notice-only or ambiguous ownership does not queue a new chat.
- AC-4: Existing prompt, phase/round, attachment, and ownership regressions pass.
- AC-5: A visible Stop control prevents an early handoff; after it disappears, the full current response is carried.

## 14. Release / migration / rollback

No migration. Revert the source and this spec together if the regression suite fails.

## 15. Observability / evidence

Record the local test result and exact browser observation in the completion report.

## 16. References / provenance

- `docs/specs/spec-first-ai-development.md`
- `docs/specs/interrupted-visible-reply-carry.md`
- User screenshot and live Chrome inspection on 2026-09-23.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R8 | passed | `queueConversationLengthHandoff()` now uses the exact-route, task-bound `visibleAssistantWorkTranscript()`; inspection waits while Stop/streaming is active; missing safe work keeps the bound URL and dispatch identity. |
| AC-1-AC-5 | passed | `node --check chatgpt-auto-confirm.user.js` passed; `npm test` passed 199, failed 0, skipped 7. New tests verify prior-turn/stale-turn exclusion, split-current-response inclusion, notice stripping, no-carry waiting, and Stop-visible deferral. |
