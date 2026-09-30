# Latest-only localStorage budget — Specification

Status: active
Owner: Fabushi ChatGPT Auto-confirm Userscript
Last updated: 2026-09-30
Related issue/task/PR: user request after v2.10.17 — the script itself must never fill localStorage; persist only the latest information required for recovery

## 1. Context / problem

v2.10.17 made Web Storage failures non-fatal and added fallback state, but the canonical `fabushi-workbench-v2` record can still contain much more history than is required to resume current work. In particular, task message logs, historical conversation URL arrays, completed-task records and redundant recovery text can accumulate over long-running use.

The new requirement is stricter: Fabushi must not be the component that exhausts ChatGPT-origin localStorage. localStorage is a small synchronous coordination store, not a task-history database.

The browser origin can still become full because of ChatGPT or other code outside Fabushi. The guarantee in this specification is therefore: Fabushi keeps a hard bounded localStorage footprint and never grows it without bound; external origin usage is handled by the existing non-fatal fallback.

## 2. Goal

Persist only the newest execution-critical task state in localStorage, remove historical/diagnostic accumulation, keep a strict total Fabushi localStorage budget, and retain v2.10.17 non-fatal fallback behavior.

## 3. Non-goals / out of scope

- Do not preserve diagnostic/status history in localStorage.
- Do not preserve completed-task history in localStorage.
- Do not delete ChatGPT/OpenAI-owned localStorage.
- Do not re-enable automatic resurrection after an intentionally closed tab.
- Do not run builds/tests locally; verification is GitHub Actions or approved htch-runtime only.

## 4. Requirements

- R1: The canonical workbench write must serialize a new durable projection instead of serializing the live in-memory task object graph.
- R2: Persisted tasks must not contain `messages`, `history`, `sessionUrls`, renderer preview text, or other diagnostic history.
- R3: Tasks in state `done` are not durable recovery state and must be excluded from canonical localStorage. They may remain visible in the current document until reload.
- R4: Cancelled tasks remain durable because the product supports resuming them.
- R5: For unfinished tasks, persist current values required to resume execution: identity/ownership, goal/mode, state, phase/round, current conversation URL/token/send intent, pause/control state, reasoning preset, attachment metadata, current Work result/next instruction, and currently active recovery context.
- R6: Exact prepared prompt text is durable only while an unfinished task still has a prepared/ambiguous send intent; otherwise it is removed from localStorage.
- R7: Recovery text fields are bounded independently. Persist only their latest bounded value; no arrays of historical recovery content.
- R8: Canonical workbench localStorage target is at most 500,000 UTF-16 code units. Total Fabushi-owned localStorage budget is at most 600,000 code units, leaving a fixed reserve for heartbeat/recovery/transfer/navigation records.
- R9: Before any Fabushi localStorage write, stale Fabushi ephemeral records may be reclaimed. If a proposed write would exceed the hard Fabushi budget, the write must fail/degrade without evicting ChatGPT-owned data.
- R10: If the full durable projection is larger than the canonical target, store the full latest projection in the existing same-tab session overflow and write a lean localStorage projection that removes optional recovery bodies from least-recently-updated tasks until it fits.
- R11: The current document must continue to read the full latest volatile/session projection so localStorage trimming cannot regress the live task state.
- R12: Legacy Fabushi queue/runtime keys are removed after migration rather than rewritten forever as paused copies.
- R13: Auxiliary keys are latest-only: one heartbeat per workspace, one automatic recovery ticket per workspace, bounded short-lived manual recovery/transfer tickets, and bounded navigation state.
- R14: Existing v2.10.17 behavior remains: any browser storage failure is non-fatal and heartbeat scheduling continues.
- R15: Release version becomes v2.10.18 only after exact-HEAD GitHub Actions verification succeeds.

## 5. Current state

At main SHA `ce2902312b4b1abd0bb2d1b8fc84cb7327106eed`:
- version is v2.10.17;
- Web Storage writes are centralized/non-throwing;
- canonical persistence still serializes the live workbench after message compaction;
- completed tasks and many historical/transient fields remain in the canonical payload;
- legacy queue/runtime keys are kept as paused records;
- no hard total Fabushi localStorage budget exists.

## 6. Target state

localStorage becomes a bounded recovery/index layer:

- canonical workbench: latest unfinished task state only;
- no persisted task logs/history arrays;
- no completed task records;
- recovery bodies are bounded and latest-only;
- auxiliary coordination keys have reserved bounded space;
- old Fabushi migration keys are removed;
- session overflow holds the full latest durable projection when the lean canonical snapshot needs trimming;
- the script never grows its own localStorage usage beyond the hard budget.

## 7. Architecture and ownership boundaries

### Live in-memory state

The current document may keep rich messages/history for UI and diagnostics. This state is not automatically durable.

### Durable localStorage projection

A pure `durableWorkbenchSnapshot(state)` builds the recovery projection without mutating live tasks. A second `fitWorkbenchSnapshotToLocalBudget(snapshot)` produces a lean copy if required.

### Same-tab overflow

When the full durable projection exceeds the canonical target, the existing workspace-keyed session overflow stores the full latest durable snapshot. localStorage holds only the bounded lean projection.

### Total budget

The shared storage writer calculates Fabushi-owned localStorage footprint before committing a value. The canonical key receives a 500k target; all Fabushi keys together must remain within 600k code units.

## 8. Interfaces / contracts / schemas / data flow

`durableTaskSnapshot(task)`
- returns null for completed tasks;
- returns a new object for resumable/unfinished/cancelled tasks;
- strips diagnostic history;
- bounds large text fields;
- retains attachment metadata only, never attachment bytes.

`durableWorkbenchSnapshot(state)`
- returns canonical durable state with only controls/selections that correspond to retained workspaces/tasks.

`fitWorkbenchSnapshotToLocalBudget(snapshot, targetChars)`
- returns `{ snapshot, serialized, trimmed }`;
- never mutates live state;
- first removes optional recovery bodies from older tasks;
- preserves current task identity/goal/state/URL/token/send intent.

`fabushiLocalStorageFootprint(excludingKey)`
- counts only keys owned by this userscript;
- never counts/deletes unrelated ChatGPT keys.

## 9. Constraints and non-functional requirements

- Preserve synchronous send-intent durability.
- Do not introduce polling beyond existing timers.
- Do not mutate the live task just to make persistence smaller.
- Do not delete attachment IndexedDB blobs.
- Avoid full-origin cleanup on every heartbeat; cleanup remains rate-limited.
- No local build/test execution.

## 10. Failure modes and edge cases

- 50 queued tasks with very large goals: full latest projection is retained in same-tab overflow; localStorage writes a lean bounded projection.
- Many completed tasks: they remain visible until reload but are not re-persisted.
- Old versions left large legacy queue/runtime keys: v2.10.18 removes them after migration.
- External ChatGPT localStorage consumes the origin quota: Fabushi still may receive a browser quota rejection, but its own footprint is bounded and the v2.10.17 volatile/session fallback keeps the task runner alive.
- SessionStorage is unavailable: current-document volatile shadow remains the fallback.

## 11. Implementation strategy

1. Add explicit localStorage target/hard-budget constants.
2. Add durable task/workbench projection helpers.
3. Remove completed tasks, message logs and historical URL arrays from canonical persistence.
4. Bound latest recovery text and keep prepared prompt only for active send intent.
5. Add lean-budget fitting and full session overflow when trimming is needed.
6. Add total Fabushi-owned localStorage footprint checks to the centralized writer.
7. Delete obsolete legacy queue/runtime keys instead of maintaining paused copies.
8. Update diagnostics to expose canonical persisted size and whether lean trimming/session overflow is active.
9. Add focused regression tests.
10. Bump to v2.10.18 after implementation is covered.

## 12. Verification / test strategy

GitHub Actions only:
- `node --check chatgpt-auto-confirm.user.js`
- full `npm test`

Focused regressions:
- canonical persisted task contains no `messages`, `history`, `sessionUrls`, or preview;
- completed task is absent while cancelled/unfinished task remains resumable;
- preparedPrompt is absent for ordinary waiting/queued tasks but retained for prepared/ambiguous send;
- 100+ status messages do not change canonical persisted size materially;
- many completed tasks do not increase canonical persisted task count;
- oversized latest state writes a <=500k lean canonical snapshot and retains the full latest projection in same-tab overflow;
- total script-owned localStorage writer refuses growth beyond 600k without touching non-Fabushi keys;
- legacy queue/runtime keys are removed;
- all existing v2.10.17 quota-survival tests remain green.

## 13. Acceptance criteria / Definition of Done

- AC-1: Fabushi canonical localStorage no longer persists diagnostic/task history.
- AC-2: Completed-task accumulation cannot grow localStorage.
- AC-3: Canonical localStorage snapshot is <=500,000 code units after budget fitting.
- AC-4: All Fabushi-owned localStorage keys together are prevented from growing beyond 600,000 code units.
- AC-5: Required unfinished/cancelled task recovery identity and attachment metadata remain durable.
- AC-6: Oversized latest state is preserved in session overflow without stopping the runner.
- AC-7: Legacy Fabushi queue/runtime keys are removed after migration.
- AC-8: Exact PR HEAD passes GitHub Actions full regression suite.
- AC-9: Canonical main Test and Release succeed for v2.10.18.
- AC-10: Spec compliance record contains exact SHA/run/release evidence.

## 14. Release / migration / rollback

No task schema migration is required. v2.10.18 rewrites the canonical key into the latest-only format on the next save and removes obsolete legacy Fabushi queue/runtime keys. Rich history that was previously stored only in localStorage is intentionally not retained.

Rollback restores the older persistence behavior but cannot reconstruct deliberately discarded diagnostic history.

## 15. Observability / evidence

Storage status exposes:
- canonical serialized character count;
- whether the local snapshot was trimmed;
- fallback mode;
- total known Fabushi-owned localStorage footprint after successful writes.

No task prompt/goal/reply text is included in diagnostics.

## 16. References / provenance

- User instruction, 2026-09-30: localStorage must stay writable because Fabushi itself must not fill it; persist only the latest required information.
- `docs/specs/workbench-localstorage-quota-recovery-v2.10.16.md`
- `docs/specs/storage-quota-runtime-survival-v2.10.17.md`
- Repository `AGENTS.md`
- Baseline main SHA `ce2902312b4b1abd0bb2d1b8fc84cb7327106eed`

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R15 | blocked | Implementation and exact-HEAD CI pending. |
| AC-1-AC-10 | blocked | Implementation and exact-HEAD CI pending. |

Allowed final statuses: `passed`, `blocked`, `not-applicable`.
