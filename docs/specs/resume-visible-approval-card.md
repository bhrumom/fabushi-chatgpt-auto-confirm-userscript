# Resume-time visible authorization card — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-25
Related incident: resumed task on an exact bound conversation stayed in loading recovery while an authorization card was visible

## 1. Context / problem

After a task resumes, ChatGPT may virtualize the marker-bearing user turn while keeping a current authorization card visible in the same bound conversation. `inspect()` currently suppresses card counts unless the task turn marker is mounted (or the narrow ended-route fallback applies). The visible card is therefore omitted from classification, and the task can enter loading/route recovery rather than approval handling.

## 2. Goal

Recognize and prioritize a visible authorization card when resuming inspection of the task's exact, already-bound conversation, even if the marker-bearing user turn is virtualized.

## 3. Non-goals / out of scope

- Do not infer task ownership of assistant text, final replies, Stop, or streaming from the route-only approval rule.
- Do not auto-approve unless the existing auto-approval setting is enabled.
- Do not recognize cards on a different route, or when another task owns the route / a foreign task marker is mounted.
- Do not click or choose a broader authorization scope as part of detection.

## 4. Requirements

- R1: A visible card on the exact canonical `task.url` may be classified as `approval` when no foreign task marker and no other route owner exist, even if `turn.owned` is false because the marker-bearing user turn was virtualized.
- R2: This exception is for card-state detection only; it must not set `sample.owned`, make replies readable, enable final completion, or enable ended-conversation continuation.
- R3: Approval classification takes priority over loading/recovery signals for that same exact route.
- R4: Existing auto-approval preference and exact card action flow remain unchanged; detection alone does not click anything.
- R5: A foreign marker, competing route owner, or non-matching route must continue to suppress task-specific card classification.
- R6: Add regression coverage for resumed marker-virtualized approval and negative ownership cases.

## 5. Current state

`inspect()` computes `pending = cards()` but exposes `sample.cards` only for `turn.owned || routeEndedOwned`. Marker virtualization on a resumed, already-attempted task makes both false, despite the saved task URL matching the current route.

## 6. Target state

The inspection computes an approval-only exact-route capability from the canonical bound URL and absence of competing ownership. It exposes pending cards through that capability without changing reply ownership. A visible eligible card is classified as approval before loading recovery can run.

## 7. Architecture and ownership boundaries

Conversation URL binding is sufficient only to locate an approval control in that conversation. Message/reply attribution continues to require the existing message-turn identity rules. The new capability must remain a local boolean used solely for pending-card classification and must not flow into `turn.owned` or `pageBelongsToTask`.

## 8. Interfaces / contracts / data flow

`inspect(task)` → exact route check + competing-owner checks → `approvalRouteEligible` → pending card count → approval state / existing optional authorization handler. `classify()` continues to receive ordinary `owned` unchanged; the inspect result may explicitly select approval when an eligible pending card exists.

## 9. Constraints and non-functional requirements

- Preserve URL canonicalization and existing foreign-task detection.
- Preserve user-controlled auto-approval behavior.
- No navigation, refresh, or external side effect is introduced by card detection.

## 10. Failure modes and edge cases

- Virtualized marker with bound URL and no competing owner: recognize approval.
- Other task marker or route owner: do not assign card to this task.
- Different or synthetic URL: existing route guard prevents inspection.
- Auto-approval disabled: show approval state but do not click.
- Active generation/loading alongside the card: approval state wins; it is not treated as a final reply.

## 11. Implementation strategy

Add the approval-only exact-route capability to `inspect()`, prioritize eligible card classification, and add focused workbench regressions. After explicit release authorization, bump metadata/runtime to v2.9.74 and publish through the canonical-main Test → Release workflow.

## 12. Verification / test strategy

Run the focused and full workbench suite. Verify positive exact-route marker-virtualized recognition and negative foreign-task / route mismatch behavior. Review that no reply ownership or auto-approval guards changed.

## 13. Acceptance criteria / Definition of Done

- AC-1: A resumed task on its exact bound route enters approval state when a visible card exists even with no mounted task marker.
- AC-2: The route-only exception does not mark the task's reply as owned or permit final completion/continuation.
- AC-3: Foreign ownership and route mismatch remain fail-closed.
- AC-4: Detection respects the existing auto-approval preference.

## 14. Release / migration / rollback

No persisted state migration is required. Revert the approval-only route capability and its tests to roll back.

## 15. Observability / evidence

Approval state remains visible through the existing task status UI; no new telemetry is added.

## 16. References / provenance

- `docs/specs/recovery-resume-immediate-ambiguous-v2.9.57.md`
- `docs/specs/ended-conversation-continue-v2.9.59.md`
- `docs/specs/active-assistant-suppresses-recovery-v2.9.69.md`
- User-provided live ChatGPT screenshot and accessibility tree (2026-09-25).

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 | passed | `inspect()` computes `approvalRouteEligible` only for the exact canonical bound URL when no foreign marker or other route owner exists; that capability exposes the detected card to classification despite marker virtualization. |
| R2 | passed | `approvalRouteEligible` is separate from `turn.owned`; the positive regression asserts `latestTurn(task).owned === false` while classifying the card as approval. |
| R3 | passed | Eligible cards classify before ownership/loading/generation checks; visible cards also suppress length-limit, interrupted-continuation and stalled-refresh recovery paths. |
| R4 | passed | Only after classification does the existing `data.autoApprove` branch call `authorize`; detection itself does not click controls. Regression confirms the split-menu arrow is untouched. |
| R5 | passed | Foreign-marker regression remains non-approval; canonical route equality and `conversationURLOwner()` guard the positive route capability. |
| R6 | passed | Workbench regressions cover marker-virtualized approval, preserved reply ownership boundary, no-click detection and foreign task suppression. |
| AC-1-AC-4 | passed | `npm test`: 210 tests, 203 passed, 0 failed, 7 skipped; `git diff --check` clean. |
