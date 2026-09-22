# Manual recovery static-final recognition — Specification

Status: in progress
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related incident: live v2.9.57 task remains waiting after “已恢复当前任务”

## 1. Context / problem

v2.9.57 re-arms a phase/round/token-bound recovered-final identity on pause/resume, startup and workspace takeover. The live task still remains in `waiting` and eventually reaches the generic 15-minute stalled-conversation refresh.

The remaining failure is narrower: `taskTurnForInspection()` only accepts the recovered exact-route fallback when no ordinary mounted user turn remains, and it still requires the current ChatGPT final toolbar/static-copy evidence. Current ChatGPT virtualization can remove the marker-bearing Fabushi user turn while leaving an older ordinary user boundary mounted; current renderer variants can also omit or defer the expected final-response toolbar. In that state, the task has exact route + persisted phase/round/token identity + static assistant content, but recovery still refuses ownership/finality forever.

A manual “继续此任务” / “恢复到当前标签页” action is an explicit user recovery decision. It can safely establish a bounded snapshot of the currently visible user boundary and use a recovery-only static-final rule, while still rejecting any user turn that appears or changes after recovery.

## 2. Goal

For explicit manual recovery only, allow an exact-route recovered task to accept the already-rendered assistant response after a short stability window even when the original Fabushi marker and final toolbar are virtualized, provided there is no Stop, streaming state, loading state, approval card, blocker, rate limit, other task owner, or post-recovery user-boundary change.

Publish the verified fix as userscript v2.9.58.

## 3. Non-goals

- Do not make stable text a general completion rule for ordinary live tasks.
- Do not weaken exact URL, token, phase, round, goal revision, foreign-task or foreign-owner checks.
- Do not accept a manual user turn added after recovery.
- Do not change the v2.9.57 immediate resend behavior for unbound 90-second send timeouts.
- Do not remove the normal toolbar-based final detector.

## 4. Requirements

- R1: Extend recovered-final identity with recovery-only metadata when the recovery is explicitly initiated by the user.
- R2: Explicit manual pause/resume must snapshot the latest currently mounted user boundary and enable recovery-only static-final fallback.
- R3: Explicit “恢复到当前标签页” workspace takeover must enable the same recovery-only fallback.
- R4: Automatic startup, automatic stale-workspace takeover, and automatic route recovery remain strict and must not enable recovery-only static-final completion.
- R5: If the mounted user boundary changes after explicit recovery, the recovery-only fallback must fail closed.
- R6: A visible foreign Fabushi task marker or another task owning the same URL must continue to fail closed.
- R7: On the exact saved route, an explicitly recovered candidate with assistant text may be marked task-owned for inspection when its snapshotted user boundary is unchanged.
- R8: Recovery-only static completion requires unchanged assistant text for at least 8 seconds, exact recovered ownership, no Stop, no streaming marker, no page loading, no approval card, no blocker and no rate limit.
- R9: Normal final toolbar/static-copy completion remains faster and authoritative when available.
- R10: A recovery-only static candidate must complete before the 15-minute stalled refresh and therefore must not depend on repeated page reloads.
- R11: Add regression coverage for a manually resumed task with a virtualized Fabushi marker, an older ordinary mounted user turn, assistant text, and no final toolbar; it must complete through the 8-second recovery-only stability gate.
- R12: Add regression coverage proving a new/changed user boundary after recovery is rejected.
- R13: Preserve the existing automatic recovered-final negative test for a visible non-task user turn.
- R14: Bump metadata/runtime/version assertions to 2.9.58.
- R15: Merge only after exact-head GitHub Actions Test passes, then verify canonical-main Test and Release v2.9.58.

## 5. Target behavior

Manual pause/resume or manual current-tab recovery
→ bind exact task URL + token + phase/round/goalRevision
→ snapshot the currently mounted latest user boundary
→ immediately inspect the current conversation
→ if normal final toolbar evidence exists, finish normally
→ otherwise, if the same assistant text remains unchanged for 8 seconds and no active/blocking state exists, accept it as the recovered final reply
→ advance Work/Review normally
→ do not enter the 15-minute refresh loop.

If a new user turn appears after recovery, the boundary fingerprint changes and the fallback is rejected.

## 6. Verification

- Full Test workflow on exact PR head.
- Existing recovered-final, foreign-task and visible-non-task-user negative tests stay green.
- New manual recovery static-final regression passes.
- New post-recovery user-boundary-change rejection regression passes.
- Existing v2.9.57 immediate ambiguous resend regression stays green.
- Canonical-main Test succeeds.
- Release workflow publishes v2.9.58.

## 7. Acceptance criteria

- AC-1: After “已恢复当前任务”, an already-ended exact-route conversation no longer waits 15 minutes solely because marker/toolbar DOM was virtualized.
- AC-2: Recovery-only stable-text completion is restricted to explicit manual recovery.
- AC-3: A user turn added after recovery prevents the fallback from owning the reply.
- AC-4: No duplicate send is introduced.
- AC-5: Exact-head Test, canonical-main Test and Release workflow all pass.
- AC-6: Canonical main and GitHub Release report v2.9.58.

## 8. Spec compliance record

Pending implementation and verification.
