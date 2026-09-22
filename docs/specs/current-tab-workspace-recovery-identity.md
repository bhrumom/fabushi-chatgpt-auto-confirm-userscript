# Current-tab workspace recovery identity — Specification

Status: in progress
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related incident: user live incident 2026-09-22 / v2.9.55

## 1. Context / problem

When a stale Fabushi workspace is restored with the UI action “恢复到当前标签页”, the selected persisted task may already be in `waiting` with a canonical ChatGPT conversation URL. The current restore path merges the old workspace and restarts supervision, but only calls `prepareTaskForRecovery()` for `blocked` tasks.

Recovered-final-reply fallback introduced in v2.9.52 intentionally requires a phase/round/token-bound `recoveredFinalIdentity`. A normal `waiting` task restored into the current tab therefore may reach the exact saved `/c/<id>` route without that identity. If ChatGPT has virtualized the original marker-bearing user turn, `latestTurn(task)` remains unowned and the final-only exact-route fallback is rejected, so the task can remain in “等待响应” despite a complete assistant reply already being visible.

## 2. Goal

Make every legitimate workspace takeover path arm recovered-final identity for the selected resumable task before supervision starts, without weakening cross-task, foreign-marker, foreign-user-turn, phase/round, token or URL ownership guards.

Publish the verified fix as userscript v2.9.56.

## 3. Non-goals

- Do not adopt arbitrary assistant text as task-owned.
- Do not resend the task or create a duplicate conversation.
- Do not weaken exact-route or cross-task ownership checks.
- Do not change final-toolbar, authorization, attachment, or retry semantics except as required for workspace recovery.
- Do not edit the legacy implementation in `bhrumom/fabushi`.

## 4. Requirements

- R1: `restoreWorkspace(ownerTabId, true)` must arm recovered-final identity for the selected current phase/round task when it has a canonical task URL and token, before `autoStart()`.
- R2: The same identity preparation must apply to recovery-token/new-document workspace takeover before automatic supervision starts.
- R3: Automatic stale-workspace takeover must inherit the same behavior because it delegates to current-tab restore.
- R4: Paused tasks remain paused; cancelled/done tasks remain non-restorable according to existing rules.
- R5: Restoring identity must not mutate phase, round, goal revision, task URL, token, or dispatch state except for existing blocked-task recovery behavior.
- R6: Existing `taskTurnForInspection()` fail-closed guards remain unchanged: exact route, identity match, no other URL owner, no foreign marker, no non-task mounted user turn, strong final evidence, no Stop, no approval.
- R7: Add a regression that exercises the real workspace-restore path rather than manually calling `armRecoveredFinalIdentity()`.
- R8: Regression must prove that a persisted `waiting` task restored into an empty current tab can recognize a completed marker-virtualized final reply and does not stay waiting.
- R9: Preserve existing negative recovered-final tests.
- R10: Bump metadata/runtime/test version assertions to 2.9.56.
- R11: Merge only after exact-head GitHub Actions Test passes; then verify canonical-main Test and release v2.9.56.

## 5. Target behavior

Persisted waiting task in closed/stale workspace
→ user clicks “恢复到当前标签页”
→ workspace ownership transfers
→ task is merged and selected
→ recovered-final identity is armed from the persisted current phase/round/token/URL
→ supervisor starts
→ exact saved conversation is inspected
→ if the marker-bearing user turn is virtualized but the final assistant reply has strong final evidence, the existing final-only fallback can own and complete it
→ no duplicate send.

## 6. Verification

- Repository GitHub Actions Test on exact PR head.
- Existing full test suite remains green.
- Focused regression covers `restoreWorkspace(..., true)` with a `waiting` task and marker virtualization.
- Canonical-main Test succeeds after merge.
- Release workflow publishes v2.9.56 from the tested source.

## 7. Acceptance criteria

- AC-1: “恢复到当前标签页” no longer leaves an exact-route completed recovered task stuck in “等待响应” solely because the original user marker was virtualized.
- AC-2: No duplicate task dispatch is introduced.
- AC-3: Existing cross-task/foreign-user fail-closed tests remain green.
- AC-4: Exact-head and canonical-main Test workflows pass.
- AC-5: GitHub Release v2.9.56 is published and canonical main reports metadata/runtime 2.9.56.

## 8. Spec compliance record

Pending implementation and verification.
