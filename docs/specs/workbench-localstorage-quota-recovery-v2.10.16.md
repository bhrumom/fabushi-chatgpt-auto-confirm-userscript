# Workbench localStorage quota recovery — Specification

Status: active
Owner: Fabushi ChatGPT Auto-confirm Userscript
Last updated: 2026-09-30
Related issue/task/PR: user-reported `QuotaExceededError` on `fabushi-workbench-v2`

## 1. Context / problem

The userscript persists the complete workbench in one ChatGPT-origin `localStorage` entry named `fabushi-workbench-v2`. Each task can keep a goal, Work result, next-round instruction, durable recovery carry/snapshots, up to 40 conversation-history entries, and a diagnostic/status message log. The message log is currently bounded per task, but the bound is large enough that multiple long-running tasks/workspaces can make the single serialized workbench exceed the browser origin's synchronous Web Storage quota.

When `localStorage.setItem('fabushi-workbench-v2', ...)` exceeds that quota, Chrome throws `QuotaExceededError`. The current direct writes do not recover from that exception, so the workbench can surface:

`Failed to execute 'setItem' on 'Storage': Setting the value of 'fabushi-workbench-v2' exceeded the quota.`

This is a persistence-layer failure, not a ChatGPT usage-quota or workspace-credit error.

## 2. Goal

Make workbench persistence quota-safe without deleting runnable tasks or losing task execution identity. A quota hit must trigger deterministic compaction of nonessential diagnostic history and retry the write instead of propagating the browser exception into the workbench UI.

## 3. Non-goals / out of scope

- Do not move attachment bytes out of their existing IndexedDB attachment store.
- Do not change ChatGPT task scheduling, authorization-card semantics, conversation ownership, or recovery policy.
- Do not silently delete active, paused, cancelled, or completed task records as a quota-recovery mechanism.
- Do not use local test/build execution; verification is GitHub Actions or the approved `htch-runtime` device only.
- Do not treat ChatGPT workspace-credit banners as browser-storage quota signals.

## 4. Requirements

- R1: All writes of the canonical `fabushi-workbench-v2` value must go through one quota-aware persistence function.
- R2: Before a normal write, persisted task message logs must be globally bounded so many tasks cannot independently consume the old per-task maximum.
- R3: If the first write throws a Web Storage quota exception, the userscript must perform a stricter emergency compaction and retry synchronously.
- R4: Compaction may discard old diagnostic/status message history, but must preserve every task record and execution-critical fields, including task ID, owner, goal, mode, state, phase, round, URL, token/attempted state, result/next instruction, attachment metadata, pause/control state, and current recovery carry needed to continue an unfinished task.
- R5: Completed-task transient recovery fields that cannot be used again may be cleared during compaction, but cancelled tasks remain resumable and therefore are not treated as disposable.
- R6: A successful emergency retry must not throw to the caller. The runtime must retain an inspectable storage-pressure status for diagnostics.
- R7: If the emergency retry still cannot fit because the origin is externally saturated, the workbench must fail closed without deleting tasks: keep the current in-memory state, expose a persistent storage-pressure diagnostic, and avoid pretending the write succeeded.
- R8: Startup migrations, ownership migration, task reassignment, and ordinary `save()` must all use the same canonical write path.
- R9: Existing message-log behavior and UI remain unchanged except that older diagnostic history may be compacted when persistence size requires it.
- R10: Release version becomes v2.10.16 only after GitHub Actions verification succeeds.

## 5. Current state

- Canonical key: `fabushi-workbench-v2`.
- Direct canonical writes currently exist in startup transfer/ownership migration, `save()`, and task reassignment.
- `compactTaskMessages()` limits one task to 80 messages and 320,000 message characters, but there is no global message budget across all tasks/workspaces.
- A single quota exception from `setItem` propagates out of the call site.

## 6. Target state

The userscript owns one `persistWorkbenchState(state)` boundary. Normal persistence first enforces conservative per-task and global diagnostic-message budgets. If the browser still rejects the replacement, the same function applies an emergency budget and retries. The retry never removes a task or unfinished-task semantic/recovery state. Storage pressure is observable to tests and the workbench status line.

## 7. Architecture and ownership boundaries

The userscript remains the owner of workbench persistence. `localStorage` remains the synchronous cross-tab rendezvous for task ownership/control in this patch. IndexedDB remains the attachment-byte store. The fix is intentionally a bounded-storage policy around the existing schema rather than an asynchronous persistence-model rewrite.

The persistence boundary owns:
1. task-log compaction for storage,
2. quota classification,
3. one emergency retry,
4. storage-pressure diagnostics.

Callers own task semantics and must not implement their own quota recovery.

## 8. Interfaces / contracts / schemas / data flow

`persistWorkbenchState(state)` returns a boolean:
- `true`: the canonical value was written.
- `false`: both normal and emergency writes were rejected by quota; in-memory state remains authoritative for the current document and diagnostics record the failure.

Storage diagnostic shape is internal and includes at least:
- status level (`ok`, `recovered`, or `blocked`),
- timestamp,
- attempted serialized size,
- emergency serialized size when used,
- compacted message count/characters when available.

No task schema version change is required.

## 9. Constraints and non-functional requirements

- Preserve synchronous save semantics needed by send-intent durability and cross-tab ownership.
- Do not introduce a polling loop.
- Do not clear attachment metadata or IndexedDB blobs.
- Normal operation should compact before hitting the browser exception so long-running workspaces stay below a predictable diagnostic-history ceiling.
- Emergency compaction must be deterministic and bounded in CPU cost relative to the number of stored tasks/messages.
- No local build/test execution; CI evidence is authoritative.

## 10. Failure modes and edge cases

- Existing oversized legacy state: the first subsequent canonical write compacts it before replacement.
- Browser quota already consumed by unrelated ChatGPT keys: emergency retry may still fail; report blocked persistence without deleting tasks.
- Many completed tasks: old status logs can shrink to near-zero while records/results remain.
- Cancelled task: preserve fields required by `restoreCancelledTask()`.
- In-flight prepared prompt/recovery carry: preserve it because losing it could create a duplicate send or lose recovery context.
- Cross-tab reassignment under pressure: destination ownership mutation uses the same safe writer and only merges back after a successful write.
- Non-quota `setItem` errors: do not misclassify; rethrow so unexpected browser/security failures remain visible.

## 11. Implementation strategy

1. Generalize `compactTaskMessages()` so callers can supply storage-specific limits.
2. Add `compactWorkbenchForStorage(state, { emergency })` with conservative per-task limits plus a global message-character budget, prioritizing removal from completed/old/unselected tasks before currently selected unfinished tasks.
3. Add `isStorageQuotaError()`, storage-pressure diagnostics, and `persistWorkbenchState()`.
4. Replace every direct write of `fabushi-workbench-v2` with the canonical persistence function.
5. Make task reassignment abort its local merge/ownership update if the canonical write cannot be persisted.
6. Surface recovered/blocked storage pressure in the workbench status text.
7. Add regression coverage that emulates a realistic quota threshold: normal serialized state is rejected, emergency-compacted state is accepted, essential task fields survive, and no exception reaches the caller.
8. Add blocked-quota coverage where both writes fail and task data is not deleted.
9. Bump userscript/internal version to v2.10.16 only once verification is green.

## 12. Verification / test strategy

GitHub Actions only:
- `node --check chatgpt-auto-confirm.user.js`
- full `npm test`

Focused regressions:
- first canonical write exceeds an emulated storage threshold, emergency retry succeeds;
- active task ID/owner/goal/state/phase/round/URL/token/result/next/attachments remain exact;
- persisted message history is materially reduced;
- status reports `recovered`;
- a permanently rejecting quota does not delete tasks and reports `blocked`;
- task reassignment does not claim success if persistence is blocked;
- existing multi-tab/recovery tests continue to pass.

## 13. Acceptance criteria / Definition of Done

- AC-1: Reproduced quota error no longer escapes from normal workbench save when emergency-compacted state fits.
- AC-2: Every direct canonical-key write is replaced by the quota-aware writer.
- AC-3: Emergency compaction preserves all unfinished/cancelled task execution-critical fields and attachment metadata.
- AC-4: Completed tasks are not deleted; only nonessential diagnostic/transient history may shrink.
- AC-5: Permanently blocked persistence is visible and fails closed rather than reporting success.
- AC-6: GitHub Actions syntax and full regression suite are green on the exact PR HEAD.
- AC-7: Spec compliance table is updated with exact CI evidence before merge/release.

## 14. Release / migration / rollback

No explicit schema migration. Oversized legacy state is compacted lazily on the next canonical write. Rollback is a source revert; already compacted old diagnostic messages are intentionally not reconstructed.

Release target: v2.10.16 after green CI.

## 15. Observability / evidence

The workbench status line reports storage state when a quota recovery occurs or persistence remains blocked. Tests can inspect the same diagnostic object. CI run IDs and exact HEAD are recorded below before completion.

## 16. References / provenance

- User screenshot and error report, 2026-09-30.
- `chatgpt-auto-confirm.user.js` canonical key `fabushi-workbench-v2`.
- `docs/specs/spec-first-ai-development.md`.
- `docs/specs/task-drag-drop-tab-workspaces-v2.9.67.md`.
- Repository `AGENTS.md`.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 | passed | Canonical workbench writes now route through `persistWorkbenchState()`; the only remaining direct `localStorage.setItem(KEY,...)` calls are its normal and emergency write attempts. |
| R2 | passed | Normal persistence preserves the historical per-task 80-message/12k-text/320k-character behavior while adding an 800k aggregate message-character ceiling across the workbench. |
| R3 | passed | A classified Web Storage quota rejection triggers deterministic emergency compaction and one synchronous retry with 12 messages/task, 4k/message, 24k/task and 200k aggregate diagnostic-message ceilings. |
| R4 | passed | Quota regression preserves active task ID, owner, goal, state, phase, round, URL, token, result, next instruction and attachment metadata while shrinking only message history. |
| R5 | passed | Emergency cleanup clears only dead transient recovery fields from `done` tasks; cancelled tasks and their resumable fields remain intact. |
| R6 | passed | Successful emergency retry returns true without propagating the quota exception and leaves `storagePersistenceStatus.level === "recovered"` plus visible storage diagnostics. |
| R7 | passed | Permanent quota rejection returns false, records `blocked`, preserves the in-memory task list, and exposes a storage-pressure warning instead of deleting tasks. |
| R8 | passed | Startup transfer, ownership migration, ordinary `save()`, and task reassignment use the canonical writer. |
| R9 | passed | Existing per-task log semantics were retained after the first CI regression exposed an over-aggressive normal cap; only aggregate/quota-pressure compaction is new. |
| R10 | passed | Candidate runtime/metadata version is v2.10.16; release remains gated on canonical-main Test after merge. |
| AC-1 | passed | Focused quota regression emulates normal write rejection and successful emergency retry without an escaping exception. |
| AC-2 | passed | Source audit confirms canonical-key writes are centralized in `persistWorkbenchState()`. |
| AC-3 | passed | Focused regression verifies unfinished task execution identity and attachment metadata survive emergency compaction exactly. |
| AC-4 | passed | Compaction never deletes task records; completed-task cleanup is limited to dead transient recovery strings. |
| AC-5 | passed | Permanent-quota regression passes and verifies blocked status with the cancelled task still present and resumable. |
| AC-6 | passed | PR-head implementation commit `14aedc52d21b1c223abecab873d8c4b3528d64a4` passed GitHub Actions Test run `36689630792`: syntax check and full regression suite both succeeded. |
| AC-7 | passed | This compliance record captures implementation and CI evidence; the docs-only compliance commit is revalidated by the PR Test gate before merge. |
