# Recover stable network errors with stale activity indicators — v2.9.90

Status: active  
Owner: Fabushi ChatGPT Auto-confirm userscript  
Last updated: 2026-09-27  
Related issue/task/PR: user report from the Fabushi extension-hosted session

## 1. Context / problem

Fabushi v2.9.89 recognizes a current assistant network-error card with a visible Retry control and queues a fresh conversation after an eight-second stable ended-turn observation. In practice, ChatGPT can leave stale streaming or loading markers attached to that failed response after its Stop control disappears. Those markers currently veto abnormal-end eligibility indefinitely, so the task stays in “loading” despite the actionable error card.

The `task-not-resumable` signal belongs to the separate memory-pressure reload safety check. It explains why an automatic reload is refused, but it must not block the independent fresh-chat recovery path for a proven network-error end.

## 2. Goal

Allow a uniquely owned task conversation with a current retryable network-error card and no active Stop control to recover into a fresh ChatGPT conversation after a stable observation, even when stale streaming/loading signals remain.

## 3. Non-goals / out of scope

- Do not let an error message alone trigger recovery without its nearby Retry control.
- Do not override a visible Stop control, authorization card, rate limit, blocker, ambiguous/foreign task ownership, or final reply.
- Do not loosen generic loading recovery or memory-pressure reload safety.
- Do not clear composer text until exact-route ownership and all other safe-idle conditions pass.

## 4. Requirements

- R1: A retryable error is authoritative for ended-state classification only when it belongs to the current exact-route task response, has its nearby Retry/重试 control, and the Stop control is absent.
- R2: Under R1, stale streaming/loading markers do not mask abnormal-end observation; the same task ownership, no-final, no-approval, no-blocker, no-rate-limit, empty-composer, and non-ambiguous-send requirements remain.
- R3: Recovery requires an unchanged stable observation for the existing eight-second interval, then queues a fresh conversation while preserving task goal, phase, round, and attachments.
- R4: A visible Stop, authorization, newer final reply, foreign task/user boundary, or active/changed response resets or blocks recovery.
- R5: A non-empty composer may be cleared only after R1 and the remaining safe ownership/idle conditions pass; clearing restarts the full stability interval.
- R6: Memory-pressure reload safety remains independent; `task-not-resumable` must not be misreported as the cause of a fresh-chat recovery decision.

## 5. Current state

The v2.9.89 inspector calculates the retryable-error signal, then excludes recovery whenever `activityStreaming` or effective conversation loading is true. ChatGPT's failed response can retain those indicators even after Stop disappears. The separate `memoryReloadSafety()` predicate allows only selected task states and can report `task-not-resumable`, but that predicate is only for memory-pressure reloads.

## 6. Target state

For a uniquely bound current response, a visible actionable network-error card plus absent Stop is terminal evidence for that response. Stale stream/loading markers are ignored for the abnormal-end timer only; a fresh final reply, active Stop, approval, blocker, rate limit, route ambiguity, or changing task boundary still prevents transition. After eight stable seconds, the existing fresh-retry transition starts a new conversation.

## 7. Architecture and ownership boundaries

The userscript owns response classification and task recovery. The Fabushi Chrome extension remains the host that injects the stable remote userscript. No extension host or memory-policy behavior changes are required.

## 8. Interfaces / contracts / schemas / data flow

No persisted schema or external interface changes. Reuse `sendTimeoutNotice()` for the current-response error signal and `queueInterruptedFreshRetry()` for the existing new-session transition.

## 9. Constraints and non-functional requirements

- Keep the recovery scan bounded to the current owned response and nearby Retry control.
- Preserve the existing eight-second stability and single-tab task ownership rules.
- Do not make memory-pressure reloads more permissive.

## 10. Failure modes and edge cases

- Retry control absent or error text is quoted/history/workbench content: remain fail-closed.
- Stop or approval appears while the error is visible: do not recover.
- New assistant text, final toolbar, changed user boundary, or route ownership ambiguity: reset/block recovery.
- Composer contains a draft: clear only after safe ownership checks and restart observation.

## 11. Implementation strategy

Compute the current owned retryable-error signal before deriving effective loading/streaming gates. Define error-ended evidence only when Stop is absent. Use that evidence to bypass stale activity/loading markers in both the safe composer cleanup predicate and abnormal-end eligibility, without weakening the other guards. Add regressions for stale activity markers, active Stop, authorizations, final replies, and the eight-second fresh-session transition.

## 12. Verification / test strategy

Run focused userscript tests, the complete `npm test` suite, `node --check chatgpt-auto-confirm.user.js`, and `git diff --check`. Require exact-HEAD CI and a successful v2.9.90 release workflow before publication.

## 13. Acceptance criteria / Definition of Done

- AC-1: A current owned network-error card with nearby Retry, no Stop, no approval, and stale streaming/loading markers queues a fresh session after eight stable seconds.
- AC-2: Active Stop, approval, final reply, foreign/ambiguous ownership, or changing state prevents recovery.
- AC-3: Composer cleanup remains ownership-gated and restarts the stability interval.
- AC-4: The existing memory-pressure safety policy remains unchanged.
- AC-5: Local checks and exact-HEAD GitHub CI pass; v2.9.90 is published and its stable update source is verified.

## 14. Release / migration / rollback

No migration. Publish canonical userscript v2.9.90 through the userscript repository's validated release flow. Fabushi extension v0.6.23 fetches newer source from its stable update URL; do not bump the host extension unless host code changes are required.

## 15. Observability / evidence

Log that a current retryable error overrode stale activity/loading markers, without including user message contents. Record local test results, exact-HEAD workflow results, release asset URL, and stable-source version readback.

## 16. References / provenance

- `AGENTS.md`
- `docs/specs/retry-generic-network-error-v2.9.89.md`
- `docs/specs/loading-failure-recovery-and-scan-cost.md`
- User screenshot/report dated 2026-09-27 showing a Fabushi-hosted task with an error card and no visible final reply.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R6 / AC-1-AC-4 | passed | `test/workbench.test.mjs`: stable network error over stale streaming/loading indicators queues one fresh session after the eight-second gate; visible Stop retains the current task in generating state. Existing draft-cleanup and exact-route/network-error regressions pass. |
| AC-5 | pending | Local complete suite and syntax checks pass; exact-HEAD CI and release workflow still required. |
