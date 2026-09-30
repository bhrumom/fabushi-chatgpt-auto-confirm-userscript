# Storage quota runtime survival — Specification

Status: active
Owner: Fabushi ChatGPT Auto-confirm Userscript
Last updated: 2026-09-30
Related issue/task/PR: user-reported `QuotaExceededError` on `fabushi-workspace-heartbeat-v1:<workspace>`; follows v2.10.16 workbench-quota fix

## 1. Context / problem

v2.10.16 made the canonical `fabushi-workbench-v2` payload quota-aware, but the userscript still writes multiple auxiliary coordination records directly to the ChatGPT origin's synchronous Web Storage. The newly reported live failure is:

`Failed to execute 'setItem' on 'Storage': Setting the value of 'fabushi-workspace-heartbeat-v1:<workspace>' exceeded the quota.`

That write occurs in `writeWorkspaceHeartbeat()`. A thrown exception can escape the heartbeat timer callback before the callback schedules its next heartbeat. The same origin-level quota can also reject recovery tickets, navigation-guard state, task-transfer tickets, migration records, or the canonical workbench after the v2.10.16 emergency retry. These failures must not tear down the runner, remove the workbench UI, or silently stop supervision.

"Keep running forever" is interpreted as a runtime invariant inside the userscript's control: no browser-storage write failure may terminate or permanently silence the scheduler/workbench. The userscript cannot guarantee survival of an OS/browser process kill, device shutdown, browser extension removal, or explicit user tab closure.

## 2. Goal

Make every userscript-owned storage write non-fatal, preserve the latest task state when persistent localStorage is saturated, keep heartbeat/supervision scheduling alive, and automatically return to normal durable persistence when browser storage becomes writable again.

## 3. Non-goals / out of scope

- Do not delete ChatGPT/OpenAI-owned storage keys or unrelated origin data.
- Do not delete runnable, paused, cancelled, or completed task records to create space.
- Do not delete attachment metadata or IndexedDB attachment blobs.
- Do not re-enable automatic resurrection of a workspace after the user intentionally closes its tab; v2.9.96 semantics remain unchanged.
- Do not promise continuity across browser/OS termination when both durable localStorage and same-tab sessionStorage are unavailable.
- Do not run builds or tests locally. Verification is GitHub Actions or the approved `htch-runtime` device only.

## 4. Requirements

- R1: All script-owned `localStorage.setItem` call sites must route through centralized storage boundaries. A storage exception must never escape into task scheduling, heartbeat scheduling, UI rendering, or shutdown.
- R2: `writeWorkspaceHeartbeat()` must be non-throwing under quota/security failures, and its periodic timer must re-arm in a `finally` path so one failed heartbeat cannot permanently stop future heartbeats.
- R3: Auxiliary coordination writes must retry safely after pruning only stale Fabushi-owned ephemeral coordination keys. The implementation must never remove ChatGPT-owned keys, the canonical task workbench, or attachment data as part of auxiliary cleanup.
- R4: Recovery/task-transfer operations that require a cross-document ticket must fail closed with a controlled visible error if the required ticket cannot be persisted. They must not report success or navigate/open a new tab with a missing ticket.
- R5: Noncritical replaceable records such as heartbeats and navigation guards may degrade to an in-document volatile shadow when localStorage is unavailable. Failure of those records must not stop the task runner.
- R6: If canonical workbench persistence still cannot write after v2.10.16 emergency compaction, the latest compacted workbench must be retained in an in-document volatile shadow and, when possible, a same-tab `sessionStorage` overflow snapshot keyed by the workspace/tab identity.
- R7: While canonical localStorage is blocked, reads/merges performed by the current document must prefer the latest volatile/same-tab overflow snapshot instead of stale localStorage so later `save()` calls cannot overwrite newer in-memory task state with an older durable copy.
- R8: On same-tab reload/navigation, bootstrap must recover a valid overflow snapshot for the same workspace before falling back to stale canonical localStorage. Duplicate-tab isolation remains enforced by the existing workspace Web Lock.
- R9: After localStorage becomes writable again, a successful canonical save must clear the volatile and same-tab overflow fallback and return diagnostics to normal/recovered state.
- R10: Auxiliary quota recovery must be bounded and rate-limited. A 15-second heartbeat must not repeatedly run expensive full cleanup while the origin remains full.
- R11: Existing task identity, send-intent, phase/round, recovery carries, attachments, pause controls, authorization semantics, and v2.10.16 workbench compaction guarantees must remain intact.
- R12: Session-storage writes used by navigation/workspace identity must also be wrapped so a session quota/security error cannot crash the runtime.
- R13: Release version becomes v2.10.17 only after exact-HEAD GitHub Actions verification is green.

## 5. Current state

At main SHA `c0310f12eabccdf3e19edb5ddd6b3e297109084b`:

- `persistWorkbenchState()` protects only `fabushi-workbench-v2`.
- Direct localStorage writes remain for:
  - `fabushi-workspace-heartbeat-v1:<tab>`,
  - `fabushi-workspace-auto-recovery-v1:<tab>`,
  - `fabushi-workspace-recovery-v1:<token>`,
  - `fabushi-workbench-task-transfer-v1:<token>`,
  - navigation-guard records,
  - legacy/migration records,
  - manual recovery pending tickets.
- `scheduleWorkspaceHeartbeat()` calls `writeWorkspaceHeartbeat()` and then re-arms the timer only after that call returns, so a quota exception can terminate the loop.
- When `persistWorkbenchState()` returns `false`, `save()` keeps only the current JS object. A later merge still reads stale localStorage, and a reload can lose the latest in-memory state.

## 6. Target state

One storage subsystem owns all Web Storage mutations:

1. canonical workbench persistence with normal/emergency compaction;
2. bounded stale Fabushi coordination-key cleanup;
3. non-throwing auxiliary record writes;
4. volatile shadow fallback for all failed writes;
5. same-tab session overflow fallback for canonical task state;
6. controlled failure for cross-document ticket writes;
7. automatic recovery when localStorage becomes writable again.

The runner and UI continue operating even when persistent origin storage is temporarily full.

## 7. Architecture and ownership boundaries

### Canonical task state

`persistWorkbenchState(state)` remains the only owner of `fabushi-workbench-v2`. It may compact diagnostic history but never removes task records. When localStorage remains blocked, it updates the volatile shadow and same-tab overflow snapshot.

### Auxiliary coordination state

A new helper such as `writeLocalStorageRecord(key, value, options)` owns auxiliary records. It is non-throwing and returns success/failure. Callers decide whether failure is:
- degradable: heartbeat/navigation diagnostics continue without durable cross-tab visibility; or
- critical: a cross-document operation is aborted before navigation/opening a new tab.

### Volatile shadow

A bounded Map stores the latest failed writes for the life of the document. `read()` prefers this shadow, preventing stale localStorage from re-entering task merges after a failed write.

### Same-tab overflow

The canonical workbench additionally writes an emergency snapshot to `sessionStorage` under a workspace-specific key. That snapshot survives same-tab reload/navigation but remains isolated from unrelated tabs. Existing Web Lock ownership remains the authority for duplicate-tab safety.

## 8. Interfaces / contracts / schemas / data flow

### `writeLocalStorageRecord(key, value, options)`

Returns:
- `true`: localStorage contains the new record.
- `false`: localStorage rejected the write; the runtime did not throw and may hold a volatile shadow.

Options include whether the key is replaceable and whether stale-key cleanup should be attempted.

### `persistWorkbenchState(state)`

Returns:
- `true`: canonical localStorage persistence succeeded.
- `false`: localStorage remains unavailable; current state is preserved in volatile/session fallback when available.

### Storage diagnostics

The existing storage diagnostic is extended with degraded/fallback information, for example:
- `level`: `ok | recovered | degraded | blocked`
- `fallback`: `'' | session | memory`
- `at`
- attempted/emergency sizes
- compacted message count
- last failed key category, without storing goals/prompts/content.

## 9. Constraints and non-functional requirements

- Storage recovery must be synchronous where send-intent durability requires it.
- Cleanup must be bounded to Fabushi-prefixed ephemeral keys and inspect only a bounded number of localStorage entries.
- Deep reclamation/cleanup is rate-limited so repeated heartbeat failures do not create CPU/storage churn.
- The runtime must not create a retry recursion between canonical persistence and auxiliary persistence.
- Existing Web Locks and per-tab ownership semantics remain authoritative.
- No local build/test execution.

## 10. Failure modes and edge cases

- Origin quota consumed mostly by ChatGPT-owned data: Fabushi stale-key cleanup may reclaim little. Runtime still continues with volatile/session fallbacks.
- `sessionStorage` is also full or disabled: canonical state remains in the volatile shadow for the current document; diagnostics report memory fallback.
- Heartbeat/recovery-key write fails while canonical workbench still fits: task scheduling continues; noncritical heartbeat degrades, while a critical new-tab handoff aborts safely.
- Existing oversized/stale Fabushi coordination records: bounded cleanup removes only expired ephemeral records.
- Browser throws a non-quota storage/security exception: treat it as unavailable storage for runtime continuity; do not let it escape.
- Tab is intentionally closed: no automatic stale-workspace resurrection is re-enabled.
- Duplicate tab copies sessionStorage: existing Web Lock prevents both copies from claiming the same workspace; a newly allocated workspace id does not consume another workspace's overflow snapshot.

## 11. Implementation strategy

1. Add bounded storage-read/write/remove helpers and a volatile shadow.
2. Move the recovery-prefix declaration early enough for the shared storage subsystem.
3. Add workspace-keyed canonical overflow snapshots in sessionStorage and make bootstrap prefer a valid same-workspace overflow snapshot.
4. Extend `persistWorkbenchState()` to prune stale Fabushi ephemeral records on pressure, retry, then write volatile/session fallback without throwing.
5. Replace every direct auxiliary localStorage write with the safe boundary.
6. Make recovery/task-transfer tickets transactional at the caller level: all required records must persist before opening/navigating.
7. Wrap direct sessionStorage writes for tab identity and navigation tickets.
8. Make heartbeat scheduling re-arm in `finally`.
9. Keep `save()` painting/running and attempt heartbeat regardless of canonical persistence success.
10. Add targeted regression tests and source-audit assertions.
11. Bump userscript/internal version to 2.10.17 only after implementation is covered.

## 12. Verification / test strategy

GitHub Actions only:
- `node --check chatgpt-auto-confirm.user.js`
- full `npm test`

Focused regressions:
- permanently reject heartbeat/recovery auxiliary writes and prove `writeWorkspaceHeartbeat()` does not throw or mutate/delete the task;
- prove the heartbeat scheduler re-arms after a rejected write;
- permanently reject canonical localStorage and prove the same-tab overflow snapshot contains the latest runnable task;
- prove current-document reads prefer the latest overflow/volatile task state over stale localStorage;
- prove recovery-ticket and task-transfer creation abort safely if critical persistence fails;
- prove successful later canonical persistence clears overflow fallback;
- source audit confirms no product call site directly writes localStorage outside centralized helpers;
- retain existing v2.10.16 quota tests, multi-tab tests, recovery tests, authorization tests, and navigation guards.

## 13. Acceptance criteria / Definition of Done

- AC-1: The reported `fabushi-workspace-heartbeat-v1:<tab>` quota failure cannot escape or stop the runner/workbench.
- AC-2: Heartbeat scheduling survives failed storage writes and continues to schedule future attempts.
- AC-3: Every userscript-owned localStorage write is centralized; no heartbeat/recovery/transfer/navigation call site uses direct `localStorage.setItem`.
- AC-4: Permanent canonical localStorage failure preserves latest task state in volatile memory and same-tab session overflow when sessionStorage is available.
- AC-5: Same-tab bootstrap can recover that overflow state while duplicate-tab Web Lock isolation remains unchanged.
- AC-6: Cross-document operations never navigate/open a tab after a required recovery/transfer ticket failed to persist.
- AC-7: A later successful canonical write clears fallback state and reports recovered persistence.
- AC-8: No task record or attachment metadata/blob is deleted to handle quota pressure.
- AC-9: Exact PR HEAD passes GitHub Actions syntax and the full regression suite.
- AC-10: Spec compliance table records exact implementation/CI evidence before merge/release.

## 14. Release / migration / rollback

No schema migration is required for tasks. The new session-overflow key is ephemeral and workspace-specific. Old v2.10.16 data remains readable. Stale auxiliary cleanup is lazy and bounded.

Release target: v2.10.17 after exact-HEAD and canonical-main GitHub Actions are green. Rollback is a source revert; no ChatGPT-owned storage is modified by rollback.

## 15. Observability / evidence

The existing storage status line reports whether persistence is normal, recovered, degraded, session-fallback, or memory-only. Diagnostics must not contain task goal/prompt/file bytes.

Exact PR HEAD, GitHub Actions run, canonical merge SHA, canonical-main Test, and Release evidence are recorded in section 17 before completion.

## 16. References / provenance

- User live screenshot/error report, 2026-09-30 21:31 +08:00: quota rejection on `fabushi-workspace-heartbeat-v1:<workspace>` followed by the userscript entry disappearing.
- `docs/specs/workbench-localstorage-quota-recovery-v2.10.16.md`.
- `docs/specs/disable-self-recovery-after-tab-close-v2.9.96.md`.
- `docs/specs/task-drag-drop-tab-workspaces-v2.9.67.md`.
- Repository `AGENTS.md`.
- Main baseline `c0310f12eabccdf3e19edb5ddd6b3e297109084b`.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R13 | blocked | Implementation and exact-HEAD CI evidence pending. |
| AC-1-AC-10 | blocked | Implementation and exact-HEAD CI evidence pending. |

Allowed final statuses: `passed`, `blocked`, `not-applicable`.
