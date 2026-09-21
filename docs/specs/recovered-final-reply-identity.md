# Recovered final-reply identity — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-21
Related issue/task/PR: user incident 2026-09-21 / v2.9.52

## 1. Context / problem

A persisted task can be restored onto its exact ChatGPT conversation after a renderer reload, page recovery, long-chat hydration, or DOM virtualization. ChatGPT may unmount the earlier user turn containing the Fabushi task marker while keeping the completed assistant turn and its response actions visible. The current task-scoped reader then returns `owned:false`, so the supervisor stays in `waiting` and may incorrectly start route loading recovery even though a true final reply is already visible.

The 2026-09-21 incident shows a completed assistant response with reply actions after task recovery while the Fabushi workbench continues to report “waiting for response” / page recovery.

## 2. Goal

Recognize and complete a recovered task when its exact bound conversation shows a strong, stable final assistant reply even if the marker-bearing user turn has been virtualized out of the DOM, without weakening cross-task ownership safety.

Publish the fix as userscript v2.9.52 after CI verifies it.

## 3. Non-goals / out of scope

- Do not treat arbitrary last assistant text as task-owned.
- Do not relax the strict final-completion boundary for streaming, tool approval, or Stop-button transitions.
- Do not change abnormal fresh-chat carry semantics except where shared ownership helpers must remain consistent.
- Do not modify the legacy copy in `bhrumom/fabushi` as the canonical implementation.

## 4. Requirements

- R1: Keep marker/verified-continuation ownership as the preferred path.
- R2: If marker ownership is unavailable, allow a final-only exact-route fallback only when the live conversation URL exactly equals the task URL.
- R3: The fallback must refuse the result when another persisted task owns that URL or any other task marker is visibly mounted.
- R4: The fallback must refuse a visible non-task user turn. A visible exact Fabushi continuation prompt may be accepted only when this task recorded a continuation send.
- R5: The fallback must require strong final evidence from the latest assistant turn: non-empty content plus the existing final toolbar/static-copy rules, no Stop, and no pending authorization card. Existing behavior that accepts a stale renderer streaming marker when the complete final toolbar is already present remains unchanged.
- R6: Completion must still satisfy the existing stable-across-scans final timing before `finish()`.
- R7: Once the exact-route final fallback is ready, loading recovery must not increment a recovery counter or navigate/reload the completed conversation.
- R8: Existing cross-task and foreign-marker fail-closed behavior must remain intact.
- R9: Add regressions covering recovered marker virtualization, stability, reload suppression, foreign marker rejection, and visible foreign user-turn rejection.
- R10: Bump userscript version to 2.9.52 and publish through canonical main after CI success.

## 5. Current state

`latestTurn(task)` requires the task marker (or a verified continuation after it). If the marker is virtualized, it returns `owned:false` and empty text. `inspect()` therefore does not classify the visible completed assistant reply as final. Existing exact-route fallback exists only for abnormal reply carry and does not feed normal final completion.

## 6. Target state

Normal inspection uses marker ownership first. If it is absent, a narrowly-scoped final-only recovery helper may adopt the latest assistant turn for classification when the exact route and all anti-confusion guards prove that no other visible task/user turn can own the reply. The existing final stability gate remains unchanged.

## 7. Architecture and ownership boundaries

Canonical repository: `bhrumom/fabushi-chatgpt-auto-confirm-userscript`.

Ownership layers:
1. Conversation identity: exact canonical `task.url`.
2. Message identity: task marker / verified continuation (preferred).
3. Recovery final fallback: exact route + unique task route + no foreign task marker + no foreign visible user turn + strong final evidence.
4. Final completion: existing two-scan/stability classification.
5. Recovery navigation: must consult the same final-ready helper before reload/navigation.

## 8. Interfaces / contracts / schemas / data flow

No external schema change.

Internal helper contract:
- Input: task, current DOM, current route.
- Output: task-scoped turn plus diagnostic flag identifying exact-route fallback.
- Fallback output may set `owned:true` only for a strong final turn after all R2–R5 guards pass.
- Non-final markerless turns remain unowned and continue through existing recovery logic.

## 9. Constraints and non-functional requirements

- Fail closed under ambiguity.
- Do not use text stability alone as completion.
- Preserve single-tab multi-task isolation.
- No duplicate dispatch caused by the fallback.
- No local heavyweight application build; verification runs through repository GitHub Actions.

## 10. Failure modes and edge cases

- Another task marker is visible: refuse fallback.
- Another task owns the same URL: refuse fallback.
- Human/foreign user turn is visible after marker virtualization: refuse fallback.
- Active streaming without strong final evidence, Stop visible, or approval pending: refuse completion. A stale streaming marker may be ignored only under the pre-existing complete-toolbar rule.
- Toolbar appears before stability window: remain waiting until existing stability rule passes.
- Final reply becomes visible while route recovery is about to start: recovery must abort before counter increment/navigation.

## 11. Implementation strategy

1. Add a task-scoped inspection helper that calls `latestTurn(task)` first.
2. If unowned, inspect the unscoped latest turn and apply exact-route final fallback guards.
3. Use the helper in `inspect()` and `ownedFinalReplyReady()`.
4. Preserve existing `classify()` final stability behavior.
5. Add focused JSDOM regressions.
6. Bump version to 2.9.52.

## 12. Verification / test strategy

- `node --check chatgpt-auto-confirm.user.js`
- repository `npm test`
- GitHub Actions `Test` on exact PR head
- post-merge `Test` on canonical main
- read back main metadata/version and final helper behavior from source

## 13. Acceptance criteria / Definition of Done

- AC-1: A restored exact-route conversation whose marker user turn is absent but whose latest assistant turn has strong final controls reaches `complete` after the normal stability window.
- AC-2: The same scenario does not enter `recoverStalledRoute()` or increment route-recovery attempts.
- AC-3: A foreign task marker or another URL owner prevents fallback ownership.
- AC-4: A visible non-task user turn prevents fallback ownership.
- AC-5: Active streaming without strong final evidence, Stop-visible, or approval-pending states do not complete; a stale streaming marker may still be ignored when the existing complete final-toolbar rule proves completion.
- AC-6: Exact-head CI and canonical-main CI pass.
- AC-7: Canonical main reports userscript version 2.9.52.

## 14. Release / migration / rollback

Release: merge verified PR to `main`; the stable `@updateURL`/`@downloadURL` already point to canonical raw main. Create/retain release evidence when supported by repository delivery tooling.

Migration: none.

Rollback: revert the v2.9.52 merge; no storage schema migration is introduced.

## 15. Observability / evidence

Record branch/head SHA, PR, exact-head workflow run, merge SHA, main workflow run, and final main version readback.

## 16. References / provenance

- `AGENTS.md`
- `docs/specs/spec-first-ai-development.md`
- `projects/continuous-auto-retry/SOURCE_OF_TRUTH.md`
- `projects/continuous-auto-retry/source/2026-09-18-strict-final-completion-boundary.md`
- `projects/continuous-auto-retry/source/2026-09-19-streaming-final-review-identity.md`
- `projects/continuous-auto-retry/source/2026-09-21-abnormal-reply-carry.md`
- User screenshots and explicit request on 2026-09-21.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1–R10 | passed | PR #57 implements the recovery identity and final-only exact-route fallback; exact-head `3016107855e5abe43358dbea1967966cda54583f` passed Test run `35611381263`; squash merge `c99e662a78540f61684af07296e70dbe98e7f0d4` published v2.9.52 to canonical main. |
| AC-1–AC-5 | passed | Focused JSDOM regressions in `test/final-reply-handoff.test.mjs` passed in exact-head run `35611381263`; they cover marker virtualization completion, route-recovery suppression, recovery identity, foreign marker rejection, and visible foreign user-turn rejection. |
| AC-6 | passed | Exact-head Test run `35611381263` succeeded; canonical-main push Test run `35611473160` succeeded for merge SHA `c99e662a78540f61684af07296e70dbe98e7f0d4`. |
| AC-7 | passed | Canonical `main` readback after merge reports userscript metadata `@version 2.9.52` and runtime `VERSION = '2.9.52'`. |
