# Stream recovery polling timeout handoff — Specification

Status: active
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-25
Related issue/task/PR: user live screenshot 2026-09-25

## 1. Context / problem

ChatGPT can leave the current assistant turn with a visible error `ChatGPT stream recovery polling timed out` and a `Retry` control. The userscript does not classify this renderer-specific failure as a recoverable interrupted response. The user wants the unfinished work moved into a new conversation, with already-rendered assistant work included in the next prompt so execution can continue rather than restarting blind.

## 2. Goal

Recognize the exact stream-recovery timeout only when it belongs to the current task response and has a visible retry action; capture the visible current-response assistant work, strip the error notice, persist it, and queue a fresh conversation for the same task/phase/round.

## 3. Non-goals / out of scope

- Do not click ChatGPT's Retry control or resend in the failed conversation.
- Do not treat a quoted/logged timeout string or a stale earlier error as the current failure.
- Do not mark the task complete from the error card or its controls.
- Do not copy user turns, foreign-task content, hidden content, toolbars, or Fabushi workbench text.
- Do not change the existing three-part fresh Work prompt ordering or attachment handling.

## 4. Requirements

- R1: Detect `ChatGPT stream recovery polling timed out` case-insensitively only when visible in the current task response and accompanied by a nearby visible `Retry` / `重试` action.
- R2: Keep exact conversation URL, task marker or guarded exact-route fallback, no-foreign-owner, no-foreign-marker, and current-response boundaries mandatory.
- R3: Before clearing the old dispatch, capture and persist all visible substantive assistant work for the interrupted response using the existing bounded carry mechanism.
- R4: Remove the standalone stream-timeout status text from the carry; preserve substantive assistant work before it.
- R5: Queue a new ChatGPT conversation using the same task id, phase, round, goal/next instruction, and attachments, with a new dispatch token/URL.
- R6: A final reply, a quoted error, an earlier stale error, or an error without an actionable retry control must not trigger a new conversation.
- R7: Add positive and negative DOM regressions for detection, current-turn scoping, error stripping, and next-prompt carry; preserve existing interrupted-carry/final/ownership tests.
- R8: Bump the userscript version to 2.9.76 after incorporating the pending local 2.9.75 recovery/performance candidate.

## 5. Current state

`visibleAssistantWorkTranscript()` and `queueInterruptedFreshRetry()` already preserve bounded, task-scoped assistant work for connection-interruption recovery. The detector only recognizes the older “connection interrupted / waiting for full response” notice and generic message-send retry errors; the stream recovery polling timeout is not included. `cleanAbnormalFreshReply()` likewise does not strip that exact status.

## 6. Target state

On the uniquely bound current task response, the exact visible stream-recovery timeout plus a nearby Retry action is treated as a proven abnormal end. The task records its old conversation, persists the visible assistant transcript as phase/round-bound carry, clears only the old dispatch identity, and queues a new conversation. The next Work prompt contains current instructions, carried work, then original goal. Ambiguous or stale UI remains fail-closed.

## 7. Architecture and ownership boundaries

The userscript remains the owner of task identity and retry orchestration. Exact task conversation URL and the current user/assistant boundary gate capture. The page error is a failure signal only; it never authorizes completion or ownership by itself. Existing `abnormalFreshCarry` persistence and Work-prompt generation remain the transfer contract.

## 8. Interfaces / contracts / schemas / data flow

No persisted schema change. Data flow: exact-route/current-response validation → visible timeout + Retry detection → scoped assistant transcript extraction → strip timeout status → persist phase/round-bound carry → clear old dispatch → queue new chat → include carry in existing fresh Work prompt.

## 9. Constraints and non-functional requirements

- Do not click Retry and do not issue a second send in the failed chat.
- Keep the existing bounded carry size and task ownership guards.
- A repeated inspection after transition must not re-queue the same old conversation; the cleared URL/current task boundary already prevents this.
- Browser/network/CI runtime verification remains separate from deterministic DOM tests.

## 10. Failure modes and edge cases

- Error text is in an assistant role node or adjacent page response surface; current response linkage and a nearby Retry action are both required.
- Timeout is quoted in prose/code or appears on an older turn; no retry.
- Error is visible but no Retry control exists; keep the bound chat under existing recovery policy.
- Substantive work spans multiple visible assistant segments and the error is the last segment; retain work and remove the final status.
- A final reply is available; completion wins and no fresh chat is queued.
- Hidden content or foreign task markers exist; existing transcript extraction rejects them.

## 11. Implementation strategy

1. Add the exact timeout detector, reusing the bounded visible Retry-control check.
2. Route the current task through `queueInterruptedFreshRetry()` before generic send-timeout same-chat handling.
3. Extend abnormal-carry cleanup to strip the timeout status.
4. Add positive end-to-end and negative stale/quoted/no-retry regressions.
5. Advance version to 2.9.76, covering the pending 2.9.75 changes already in this working tree, then run focused and full tests.

## 12. Verification / test strategy

- Positive regression: current task marker, visible assistant work, exact timeout error, and Retry action result in queued fresh dispatch, preserved carry, and correct next Work prompt ordering.
- Negative regressions: quoted/stale error, no Retry action, and final reply do not trigger the handoff.
- Run `node --check`, focused tests, full `npm test`, and `git diff --check`.
- Require exact-head GitHub Actions and live Chrome runtime before release.

## 13. Acceptance criteria / Definition of Done

- AC-1: The current failed response is moved to a new conversation and its substantive visible work is present in the next prompt.
- AC-2: Timeout status itself is absent from the carry.
- AC-3: Task id, phase, round, goal/next, and attachments are preserved; old URL/token are cleared only after carry is persisted.
- AC-4: Stale, quoted, non-actionable, final, and foreign content do not trigger or contaminate the handoff.
- AC-5: Focused and full local tests pass and the new version remains explicitly unpublished until cloud delivery evidence exists.

## 14. Release / migration / rollback

No migration. Candidate version is 2.9.76 because 2.9.75 is an unpublished local candidate. Do not publish without exact-head and canonical-main workflow evidence. Roll back by reverting the detector/branch/tests; persisted carry fields remain backward compatible.

## 15. Observability / evidence

The task log records the timeout-triggered fresh-session retry count, carry source kind, old conversation history entry, and whether visible work was captured. Record local test evidence here; exact-head Actions and live Chrome evidence remain pending until performed.

## 16. References / provenance

- `AGENTS.md`
- `docs/specs/spec-first-ai-development.md`
- `docs/specs/interrupted-visible-reply-carry.md`
- `docs/specs/interrupted-visible-content-host-recovery.md`
- User screenshot and explicit request 2026-09-25.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R6 / AC-1-AC-4 | implemented | Exact current-turn + visible Retry detector is evaluated before generic timeout/final classification; captured carry is cleaned; task identity and attachment preservation are covered by `stream recovery polling timeout carries visible work into a fresh chat`. |
| R7-R8 / AC-5 | verified locally | Positive carry and negative quote/stale/final/no-Retry DOM regressions pass; version is 2.9.76. Full `npm test`: 215 total, 208 pass, 0 fail, 7 skipped. `node --check` and `git diff --check` pass. Exact-HEAD GitHub Actions and live Chrome verification remain pending; unpublished. |
