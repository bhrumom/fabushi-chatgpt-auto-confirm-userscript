# Resume final reply before inherited Stop gate — v2.10.0

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-28  
Related issue/task/PR: live Fabushi 2.9.99 incident on a refreshed, paused/resumed task

## 1. Context / problem

A persisted task can be refreshed while ChatGPT is still generating, then paused and resumed after the refreshed page already shows a complete final assistant reply. The task still carries a Stop observation from the previous document. `inspect()` currently applies the inherited-Stop hydration gate before it records a scan, stores the current observation, or classifies the visible final reply. When any hydration prerequisite remains unresolved, that branch returns silently on every scheduler tick. The workbench therefore stays at `waiting`, shows zero completed scans, and never consumes the already-visible final reply.

## 2. Goal

Keep the v2.9.98 protection against false Stop-disappearance handoffs, while allowing a strongly owned final reply that is already visible after explicit pause/resume recovery to complete normally. Ensure unresolved inherited-Stop hydration remains observable and cannot create a silent zero-scan loop.

## 3. Non-goals / out of scope

- Do not weaken exact-route, task identity, foreign-task, authorization, rate-limit, blocker, or final-reply toolbar checks.
- Do not treat Stop disappearance alone as task completion.
- Do not restore automatic memory-pressure reload behavior.
- Do not delete or rewrite persisted user tasks as part of migration.

## 4. Requirements

- R1: A strongly owned final reply must be classified before an inherited historical Stop observation can force an early hydration return.
- R2: This bypass is allowed only for the existing task-owned final evidence: exact route, no competing owner/foreign marker, no visible Stop, no authorization card, and the existing final toolbar/static-copy rules.
- R3: A final reply recovered by explicit pause/resume identity must complete even when the original Fabushi marker is virtualized and `stopObservedDocumentId` belongs to a previous document.
- R4: An unowned or ambiguous final-looking reply must not bypass the inherited-Stop gate.
- R5: If no owned final reply exists, preserve the v2.9.98 hydration and eight-second stable Stop-absence behavior.
- R6: Every `inspect()` pass that reaches the owned exact route must update scan diagnostics before any inherited-Stop wait return, so the workbench cannot remain at zero scans while the scheduler is actively checking.
- R7: The inherited-Stop wait state must be persisted in the ordinary observation record and expose a bounded diagnostic status/log on first entry, without repeating it every tick.
- R8: Pause/resume, authorization, visible Stop reappearance, route ownership, reload reply carry, and continuous-memory behavior must retain their existing semantics.
- R9: Publish the fix as v2.10.0 only after exact-head Test, canonical-main Test, and Release succeed; verify the GitHub release asset before treating the Fabushi-hosted update as delivered.

## 5. Current state

`inspect()` computes ownership and inherited Stop state, then returns from the inherited-Stop branch before final classification and before `measurements.scans` is incremented. The live Fabushi 2.9.99 incident shows an exact-route final reply in ChatGPT, while the task remains `等待响应` and the workbench reports `扫描 0 次` after pause/resume.

## 6. Target state

Exact-route inspection first accepts an already-visible owned final reply. Otherwise it records the scan/observation and continues to enforce inherited Stop hydration. A genuine unfinished reloaded page still cannot hand off until the existing hydration/stability boundary is satisfied.

## 7. Architecture and ownership boundaries

The standalone userscript remains the sole owner of task supervision and final-reply classification. Fabushi only injects/hosts the released script. No host API or Tampermonkey behavior is involved.

## 8. Interfaces / contracts / schemas / data flow

No external interface or persisted schema change is required. Existing task fields (`recoveredFinalIdentity`, `explicitRecoveryActive`, `stopObservedGenerationIdentity`, `stopObservedDocumentId`, and reload-absence fields) remain authoritative.

## 9. Constraints and non-functional requirements

- Keep scheduler work bounded on long ChatGPT conversations.
- Do not add full-page MutationObservers or repeated whole-document text scans.
- Preserve fail-closed behavior whenever route or message ownership is ambiguous.

## 10. Failure modes and edge cases

- Strong toolbar belongs to an older/foreign response: must not complete.
- Approval card appears with a final-looking toolbar: approval wins.
- Stop reappears after reload: bind it to the current document and continue generating.
- Page is genuinely unhydrated: wait, but record scan diagnostics and a single observation/status.
- Explicit recovery identity boundary changed by a later user message: refuse recovered ownership.

## 11. Implementation strategy

1. Add focused regressions for a paused/resumed, marker-virtualized final reply with an inherited Stop observation, plus an ambiguous negative case.
2. Refactor the inherited-Stop early branch so an owned final reply can reach ordinary classification and so the waiting path records diagnostics/observation before returning.
3. Keep the existing reload hydration timer and fresh-handoff behavior unchanged for non-final states.
4. Bump release/runtime/readme assertions only when preparing an actual release.

## 12. Verification / test strategy

- Focused Node regressions for the reported state.
- Existing reload hydration, Stop reappearance, pause/resume static-final, authorization, ownership, and memory tests.
- Full `npm test` suite.
- Live browser verification after the repaired Fabushi build is installed.

## 13. Acceptance criteria / Definition of Done

- AC-1: The reported exact-route, paused/resumed task consumes the visible final reply instead of remaining at `等待响应`.
- AC-2: Active supervision no longer displays zero scans solely because the inherited-Stop gate returns early.
- AC-3: A reloaded unfinished generation still observes the full v2.9.98 hydration/stability gate.
- AC-4: Foreign/ambiguous content and authorization states cannot complete the task.
- AC-5: Focused and full tests pass.
- AC-6: Fabushi can install the verified v2.10.0 GitHub release asset without any Tampermonkey copy.

## 14. Release / migration / rollback

No data migration is required. Rollback is the previous userscript asset; persisted task records remain compatible. Release/version work is separate from the code fix until CI and live verification succeed.

## 15. Observability / evidence

Use the workbench scan counter, task status log, focused regression names, full test totals, exact commit, CI run, and live Fabushi reproduction result.

## 16. References / provenance

- `docs/specs/reload-hydration-and-reply-carry-v2.9.98.md`
- `docs/specs/recovery-resume-immediate-ambiguous-v2.9.57.md`
- `docs/specs/recovered-final-toolbar-wins-loading-v2.9.93.md`
- User-provided live Chrome/Fabushi screenshots and 2026-09-28 task log

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R3 / AC-1 | passed | `recoveredOwnedFinal` permits only an exact-route, task-owned strong final reply to pass the historical Stop gate; `resumed recovered final reply is inspected before an inherited Stop gate` reproduces pause/resume with a virtualized marker and completes normally. |
| R4 / AC-4 | passed | `inherited Stop recovery cannot consume a final toolbar owned by another task record` keeps the ambiguous reply unassigned; existing authorization and foreign-marker regressions also pass. |
| R5 / AC-3 | passed | Existing `reload inherited Stop observation waits for full hydration and stable absence before fresh handoff` and `Stop reappearing after reload binds the current document and cancels inherited absence timer` remain green. |
| R6-R7 / AC-2 | passed | The inherited-wait branch stores a bounded observation, increments scan timing/count, and logs the unhydrated wait once through existing duplicate-log suppression; regression asserts the first wait scan is observable. |
| R8 | passed | Full local suite: 260 tests, 253 passed, 0 failed, 7 explicitly skipped; pause/resume, authorization, route ownership, reply carry and diagnostic-only memory regressions remain green. |
| R9 / AC-6 | pending | v2.10.0 metadata/runtime/README are prepared; exact-head CI, merge, canonical-main Test, Release and asset readback are not yet complete. |
| AC-5 | passed | `node --check chatgpt-auto-confirm.user.js`, focused regressions, `npm test`, and `git diff --check` pass locally. |
