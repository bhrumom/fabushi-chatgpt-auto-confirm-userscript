# Interrupted turn content and same-chat continuation — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-23
Related issue/task/PR: user live incident 2026-09-23

## 1. Context / problem
The live ChatGPT renderer places substantive Markdown work in the assistant conversation turn, while its `data-message-author-role="assistant"` descendant contains only a timeout/status node. The current extractor scans only role descendants and reports no safe work. The connection-interruption branch immediately creates a fresh chat.

## 2. Goal
Capture visible substantive work from the current owned assistant turn, and recover a bound connection interruption by sending `继续完成所有` in that same chat.

## 3. Non-goals / out of scope
Conversation length limits still require a fresh chat. Other retry types and task orchestration are unchanged.

## 4. Requirements
- R1: Scope extraction to the exact owned conversation and the assistant turn after the current task user boundary.
- R2: Read visible semantic content from the turn even when it is a sibling of the assistant-role node; exclude controls, tool UI, hidden content, status notices, and foreign turns.
- R3: A connection interruption in a bound conversation sends `继续完成所有` in the same URL, preserving phase, round, task, and attachment state.
- R4: If the send UI is unavailable, retain the same conversation and retry; avoid duplicate sends while the previous continuation is pending.
- R5: Legacy pending continuation records also stay in the same chat.

## 5. Current state
`visibleAssistantWorkTranscript()` enumerates only assistant-role nodes. `inspect()` sends interrupted conversations to `queueInterruptedFreshRetry()`.

## 6. Target state
Current-turn Markdown contributes to the work transcript; interruption invokes guarded same-chat continuation.

## 7. Architecture and ownership boundaries
Keep exact URL ownership, task marker or guarded route fallback, and latest user boundary. The assistant turn must contain an assistant-role node and follow that boundary.

## 8. Interfaces / contracts / schemas / data flow
No external schema change. Existing continuation fields and send guard apply.

## 9. Constraints and non-functional requirements
Do not copy arbitrary page text or Fabushi UI. Do not reload or navigate on the interruption path.

## 10. Failure modes and edge cases
Role-only status child, hidden sibling content, foreign user turn, missing composer, repeated interruption notice after a continuation send.

## 11. Implementation strategy
Extract semantic roots from the turn container and fall back to role-host extraction. Route interruption through `sendContinuation()` with a pending-send guard.

## 12. Verification / test strategy
Run focused DOM regressions and repository tests, including the live renderer shape and repeated interruption.

## 13. Acceptance criteria / Definition of Done
- AC-1: Visible sibling Markdown is captured and status is excluded.
- AC-2: Interruption sends in the same chat without clearing URL/token or opening a new chat.
- AC-3: A repeated notice does not trigger a duplicate continuation before a new assistant reply.
- AC-4: Existing ownership and hidden-content tests pass.

## 14. Release / migration / rollback
No migration. Revert this change if necessary.

## 15. Observability / evidence
Task log records same-chat continuation and the test suite validates its behavior.

## 16. References / provenance
User screenshots and live Chrome conversation inspected on 2026-09-23; `docs/specs/interrupted-visible-content-host-recovery.md`.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R2, AC-1, AC-4 | passed | `assistantTurnContent()` reads visible semantic siblings within the owned assistant turn; live-shape, hidden-content, and foreign-user tests pass. |
| R3, R5, AC-2 | passed | `inspect()` calls `sendContinuation()` on connection interruption, retaining URL, token, phase, and round; live-shape test passes. |
| R4, AC-3 | passed | Existing send UI guard and new status-key guard prevent duplicate sends; repeated-interruption test passes. |
| Full suite | passed | `npm test`: 181 passed, 0 failed. Seven superseded fresh-chat expectation tests are skipped; replacement behavior is covered by same-chat continuation regressions. |
