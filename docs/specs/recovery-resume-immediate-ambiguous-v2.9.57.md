# Recovery resume identity and immediate ambiguous resend — Specification

Status: in progress
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related incident: live v2.9.56 report after current-tab recovery

## 1. Context / problem

Two live behaviors remain incorrect after v2.9.56.

First, a task whose bound ChatGPT conversation has already ended can still remain in `waiting` after upgrading/reloading the userscript or after the user pauses and immediately resumes the task. v2.9.56 armed `recoveredFinalIdentity` during workspace takeover, but ordinary persisted startup/hot replacement and `paused -> resume` paths do not arm that identity. If ChatGPT virtualizes the marker-bearing user turn, the exact-route final-only recovery fallback therefore remains unavailable and the task keeps polling/refeshing an already-finished conversation.

Second, an unbound ambiguous send that remains unconfirmed for 90 seconds currently enters up to four same-page refresh attempts spaced three minutes apart before opening a fresh chat. The explicit user requirement is now: once the 90-second send-confirmation timeout expires and there is still no bound current-round conversation, immediately create a fresh dispatch of the same phase/round payload instead of waiting for the three-minute refresh loop.

## 2. Goals

1. Make persisted exact-route tasks arm recovered-final identity whenever supervision is resumed after reload/hot replacement or manual pause/resume, while keeping existing final-only fail-closed ownership rules.
2. Replace the post-90-second unbound ambiguous-send refresh loop with an immediate fresh-chat resend.
3. Publish the verified behavior as userscript v2.9.57.

## 3. Non-goals

- Do not weaken exact-route, token, phase/round, foreign-task, foreign-marker, Stop, approval, or final-toolbar guards.
- Do not treat arbitrary text stability as completion.
- Do not resend when a valid current-round bound conversation URL already exists.
- Do not discard attachments, phase, round, goal/next, or task identity when performing the new immediate fresh retry.
- Do not change connection-interruption or conversation-length handoff behavior.

## 4. Requirements

- R1: Restoring an individually paused task whose resumed state is resumable and whose current phase has a canonical URL + token must arm `recoveredFinalIdentity` before supervision continues.
- R2: Startup/hot-replacement auto-resume of a task already displayed on its exact canonical task URL must arm `recoveredFinalIdentity` before `autoStart()`.
- R3: Existing workspace-takeover identity arming from v2.9.56 remains intact.
- R4: The recovered-final fallback remains final-only and keeps all existing ambiguity guards.
- R5: Add regression coverage for `paused -> resume` with marker virtualization and a completed exact-route final reply.
- R6: Add regression coverage for startup/current-route auto-resume identity arming where feasible without weakening the production contract.
- R7: When `task.attempted=true`, no current-round URL is bound, and the 90-second send-confirmation window has expired, the script must stop refreshing the old page and immediately queue a fresh dispatch.
- R8: The immediate ambiguous retry must clear the old dispatch token/attempt state, preserve task goal/next/phase/round/attachments, and generate a new token only when the fresh send is prepared.
- R9: The immediate ambiguous retry must bypass the ordinary inter-dispatch cooldown for that one recovery send; it must not wait three minutes or one minute.
- R10: If an unbound ambiguous send can safely adopt the unique live conversation before retry, adoption still wins and no duplicate send is created.
- R11: If the task already has a canonical bound URL, continue inspecting that URL and do not fresh-resend.
- R12: Remove or retire the ambiguous-send three-minute refresh state machine/logging from the active timeout path.
- R13: Update affected regressions so they assert immediate fresh resend after the 90-second timeout.
- R14: Bump metadata/runtime/version assertions to 2.9.57.
- R15: Merge only after exact-head GitHub Actions Test passes, then verify canonical-main Test and Release v2.9.57.

## 5. Target behavior

### Finished recovered conversation

Persisted waiting task on exact saved `/c/<id>`
→ script reload/update or pause/resume
→ arm phase/round/token-bound recovered-final identity
→ inspect existing page
→ if strong final reply is present and no ambiguity guard fires, finish normally
→ no 15-minute polling loop.

### Unbound send timeout

Send click attempted
→ no valid current-round `/c/<id>` can be bound for 90 seconds
→ one last safe adoption check
→ clear stale dispatch intent
→ immediately queue same phase/round payload for a fresh ChatGPT conversation
→ bypass normal dispatch cooldown once
→ no 3-minute refresh cycle.

## 6. Verification

- Full repository Test workflow on exact PR head.
- Existing recovered-final negative tests remain green.
- New pause/resume recovery regression proves marker-virtualized final reply can be recognized after resume.
- Updated ambiguous-send regression proves timeout immediately queues a fresh dispatch with a new send identity and no refresh-attempt state.
- Canonical-main Test succeeds.
- Release workflow publishes v2.9.57.

## 7. Acceptance criteria

- AC-1: A completed bound conversation does not remain in `waiting` solely because a userscript reload or manual pause/resume lost the transient recovered-final identity.
- AC-2: No duplicate send is created when a real current-round URL can still be adopted or is already bound.
- AC-3: An unbound send older than 90 seconds immediately transitions to a fresh queued resend; there is no “第 1/4 次” refresh and no three-minute wait.
- AC-4: The immediate recovery send bypasses ordinary dispatch cooldown once.
- AC-5: Existing task payload and attachments survive the fresh retry.
- AC-6: Exact-head Test, canonical-main Test, and Release workflow all pass.
- AC-7: Canonical main and GitHub Release report v2.9.57.

## 8. Spec compliance record

Pending implementation and verification.
