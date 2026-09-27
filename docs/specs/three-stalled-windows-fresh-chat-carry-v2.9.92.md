# Three stalled windows start a fresh session with work carry — Specification

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-27  
Related issue/task/PR: User request in Codex

## 1. Context / problem

The current userscript refreshes an unchanged ChatGPT conversation every 15 minutes without a limit. This can keep a task waiting indefinitely, even when the conversation has stopped making progress or is no longer recoverable. Existing abnormal-session recovery can carry the visible assistant work to a new session, but the generic stalled-page path does not use it.

## 2. Goal

After three consecutive 15-minute no-progress windows for the same task conversation, start a fresh ChatGPT conversation and continue the task with the current assistant work included in its prompt.

## 3. Non-goals / out of scope

- Do not weaken final-reply detection or treat Stop-button disappearance alone as completion.
- Do not create a new tab or transfer the task to another host.
- Do not duplicate an ambiguous, unbound send.
- Do not reset the no-progress streak merely because the page document reloaded.

## 4. Requirements

- R1: Preserve the existing 15-minute visible-progress window and same-conversation refreshes after the first and second consecutive no-progress windows.
- R2: At the third consecutive no-progress window, queue a fresh conversation on the same task instead of refreshing again.
- R3: Carry the exact-route task-scoped visible assistant transcript (including bounded fallback where ownership markers were virtualized) into the new Work prompt using existing abnormal carry behavior.
- R4: Preserve task goal, current phase and round, next instruction, prior completed Work result, and attachments. Do not resend the old prompt to the old conversation.
- R5: A visible conversation progress change resets the consecutive-window count. A document reload alone does not reset it.
- R6: Keep final, authorization, rate-limit, blocker, route ownership, and ambiguous-send guards intact.
- R7: Keep the recovery in the current Fabushi-hosted ChatGPT tab.
- R8: Bump userscript metadata/runtime/README to 2.9.92 and record implementation/compliance evidence.
- R9: When Stop is absent, “thinking” text or stale assistant `aria-busy`/stream markers must not block recovery indefinitely. Actual assistant text changes restart a bounded stability window; once stable, abnormal-end recovery proceeds.

## 5. Current state

`refreshStalledConversation()` increments `stalledRefreshAttempts` and allows indefinite 15-minute refreshes. `inspect()` calls it only after route and task checks, but does not transition to a fresh session after repeated refreshes. Existing `queueInterruptedFreshRetry()` captures the owned assistant transcript and preserves task state for a fresh session.

## 6. Target state

The task allows at most two same-route refreshes in a consecutive no-progress streak. At the third 15-minute no-progress threshold, the script records the old conversation, captures its current assistant work and queues the same task for a new ChatGPT session. Progress observed before that threshold resets the streak; a document reload does not. “Thinking” copy and sticky assistant busy/stream markers do not establish active generation after Stop disappears; observed assistant text changes provide a short bounded grace period before abnormal-end recovery proceeds.

## 7. Architecture and ownership boundaries

`inspect()` remains the sole decision point and uses its existing route-owned task sample. The transition reuses `queueInterruptedFreshRetry()` and `captureOwnedAbnormalFreshCarry()` so carry extraction remains bound to the exact conversation and current phase/round. Existing final classification runs before any recovery transition.

## 8. Interfaces / contracts / schemas / data flow

No external interface changes. Reuse the existing task `stalledRefreshAttempts` field as a persisted consecutive-window counter and the existing bounded abnormal fresh carry fields. Persist only a bounded hash of the assistant transcript tail as the post-reload progress baseline; do not persist additional raw conversation text for this purpose.

## 9. Constraints and non-functional requirements

- Keep the page scan bounded and do not add DOM polling.
- Preserve the current two-second task inspection cadence and 15-minute timeout.
- Avoid false fresh-session retries while Stop is visible, assistant text is actively changing, loading is conversation-scoped, approval is pending, the page is blocked/rate-limited, or send ownership is ambiguous. A stale thinking/busy marker alone is bounded by the ended-state stability window.

## 10. Failure modes and edge cases

- A reply arrives after a reload: after stable transcript hydration, detect the changed bounded tail and reset the streak.
- The page reloads with the same transcript: preserve the streak and begin a fresh 15-minute window.
- The task response is genuinely final: existing final evidence wins and no refresh/fresh session is started.
- Assistant output is split across visible nodes or its task marker is virtualized: use the existing bounded transcript extractor and guarded exact-route fallback.
- Stop is absent while “thinking” / `aria-busy` remains: wait only while assistant text is changing, then treat the marker as stale and allow the existing abnormal-end stability path.
- No safe assistant text is visible: queue the fresh conversation with existing task context and report that no assistant work could be safely carried.

## 11. Implementation strategy

1. Reuse existing progress fingerprints and abnormal fresh-session carry.
2. Record a bounded transcript-tail hash with each stalled refresh and compare it only after the restored page has a stable, non-empty transcript sample.
3. Reset the streak on actual visible progress; otherwise refresh twice, then queue fresh session on the third window.
4. Update repository version documentation and version assertions.

## 12. Verification / test strategy

- Cover first and second refresh, third-window fresh-session transition, transcript carry, progress reset, and reload-preserved count.
- Preserve existing final, ownership, ambiguous-send, and attachment continuity regressions.
- Check syntax, complete repository suite, and exact version metadata/runtime consistency.

## 13. Acceptance criteria / Definition of Done

- AC-1: The first two uninterrupted 15-minute windows refresh the same conversation.
- AC-2: The third uninterrupted 15-minute window queues a fresh conversation and includes the current assistant work in its prompt.
- AC-3: Real visible progress resets the streak; a document reload does not.
- AC-4: Final replies, ambiguous sends, approval, loading, blockers, and rate limits remain protected.
- AC-5: The same task, phase, round, previous result, next instruction, goal, and attachments survive the transition.
- AC-6: Userscript metadata/runtime/README report 2.9.92 and implementation evidence is recorded.

## 14. Release / migration / rollback

No destructive migration. The existing `stalledRefreshAttempts` value becomes a consecutive-window count capped operationally at two same-route refreshes before fresh-session recovery. Existing persisted counts at or above two trigger the new-session transition at the next eligible 15-minute window. Publish only through the repository's verified main/release workflow after exact-head verification.

## 15. Observability / evidence

Logs identify refresh number or the third-window fresh-session transition without including assistant content. The recovery log states whether safe assistant text was captured.

## 16. References / provenance

- `AGENTS.md` and `docs/specs/spec-first-ai-development.md`
- `docs/specs/active-assistant-suppresses-recovery-v2.9.69.md`
- `docs/specs/interrupted-visible-reply-carry.md`
- User request dated 2026-09-27: after three consecutive 15-minute periods without page changes, open a new session and continue with current assistant work.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R6 / AC-1-AC-5 | passed | `inspect()` passes the owned sample into bounded recovery; `refreshStalledConversation()` allows two same-route reloads and uses the third eligible 15-minute window to call `queueInterruptedFreshRetry()`. Progress resets attempts; a short transcript hash allows the restored document to detect changed content without persisting transcript text. The existing carry prompt preserves current work, task phase/round, previous result, goal/next, and attachments. Final/approval/loading/blocker/rate-limit/ambiguous-send gates remain before this transition. |
| R7 | passed | The existing same-task queue dispatches its next session in the current tab; this path creates no new tab or host handoff. |
| R8 | passed | Userscript metadata, runtime constant, README and version assertion now report 2.9.92. |
| R9 | passed | `inspect()` now measures stability from assistant reply text. When Stop is absent, sticky assistant streaming/busy markers cease blocking the abnormal-end path after the existing eight-second stability interval; changing text restarts the interval. This decision still cannot declare a final reply. Regression: `a stale assistant busy marker cannot block abnormal-end recovery after reply text stops changing`. |
| AC-6 | passed | Runtime and README version are 2.9.92; `node --check chatgpt-auto-confirm.user.js`, full `npm test` (226 passed, 7 skipped, 0 failed), and `git diff --check` pass. |
