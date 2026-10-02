# Recent two-hour activity log and visible interruption recovery — v2.10.24

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-02

## 1. Live failure

The workbench can show an active task as waiting while the activity feed is empty. The user then cannot tell which automatic actions happened before the current page load, especially when ChatGPT displays `Connection interrupted. Waiting for the complete answer`.

The root cause is intentional storage hardening introduced in v2.10.18: `durableTaskSnapshot()` removes `messages`, `messageVersion`, `history`, `sessionUrl`, and `sessionUrls` from the canonical `localStorage` snapshot so long-running diagnostics cannot exhaust the synchronous origin quota. That solved quota failures, but it also means a document refresh restores only execution-critical task state; the human-readable activity timeline lived only in memory and disappeared on every reload.

The interruption supervisor refreshes the same conversation after five minutes with no visible progress. Therefore the recovery path itself repeatedly destroys the in-memory feed even though the task continues safely.

## 2. Goals

1. Preserve the most recent two hours of user-visible task activity across ChatGPT page reloads and conversation navigation.
2. Keep canonical `localStorage` latest-only and hard-bounded; recent activity must not reintroduce the old quota failure.
3. Preserve meaningful automation operations: dispatch/recovery/status transitions and assistant results already written through `log()`.
4. Before a refresh/handoff, preserve the latest safely-owned visible assistant/work transcript snapshot so the user can see what was done before the interruption.
5. Make the five-minute connection-interruption recovery deadline and refresh count visible in the workbench.
6. Keep the existing interruption behavior: do not duplicate Send; refresh the same route only after five quiet minutes.
7. Bound retained and rendered data independently so the fix cannot recreate page jank.

## 3. Storage model

### 3.1 Canonical localStorage

`fabushi-workbench-v2` remains execution-state-only. `messages/history` continue to be excluded from `durableTaskSnapshot()`.

### 3.2 Recent activity

Recent activity is written outside canonical localStorage:

- primary durable store: IndexedDB database `fabushi-workbench-recent-activity-v1`, store `events`;
- same-tab fast/recovery copy: bounded sessionStorage key `fabushi-workbench-recent-activity-v1`.

Each record contains only bounded display/audit fields: task id, owner id, timestamp, role, text, phase, round, state, and canonical conversation URL.

### 3.3 Retention and limits

- time retention: two hours;
- in-memory/task cap: 360 messages;
- recent-store record cap: 360 records;
- recent-store/task text cap remains bounded by `MAX_TASK_MESSAGE_TEXT`;
- rolling recent-store character cap: 600,000 characters;
- live UI render cap: 80 messages and 180,000 characters.

Expired records are dropped on read/write and old IndexedDB rows are pruned during writes.

## 4. Restore behavior

During bootstrap, after the canonical task list is loaded but before the workbench mounts, the runtime merges sessionStorage + IndexedDB recent records into each matching task. Duplicate records are removed by task/timestamp/role/text identity. Records older than two hours are ignored.

If a task has a durable `handoffReplySnapshot` from within the two-hour window, it is also surfaced as a recovered assistant snapshot so a refresh does not hide the last visible work state.

## 5. Write behavior

`log()` writes the normal in-memory message and mirrors the same entry into the bounded recent activity store. No ordinary scheduler scan writes a record unless it already produces a human-visible log transition.

`persistHandoffReplySnapshot()` records a bounded assistant activity snapshot when the snapshot materially changes, throttled to at most once per minute for the same task. This is mainly reached before pagehide/refresh/handoff and therefore preserves the work that was visible immediately before navigation.

## 6. Connection interruption visibility

When `pendingContinuationReason` is active, the workbench derives the next recovery deadline from the same state used by `superviseConnectionInterrupted()`:

`max(pendingContinuationSince, stalledRefreshAt) + INTERRUPTED_STOP_STALL_REFRESH_MS`.

The UI shows:

- approximate minutes/seconds until the next same-route refresh; and
- the number of stalled refresh attempts already performed.

This is display-only. It must not change scheduler timing or trigger additional writes.

## 7. Safety requirements

- R1: Never add recent activity back into canonical localStorage.
- R2: Recent activity failure must not block task execution; IndexedDB errors fail soft and sessionStorage is best-effort.
- R3: Retention must be time-bounded to two hours.
- R4: Storage and rendering each have independent hard caps.
- R5: No new periodic transcript scan is added to the hot 4-second supervision loop.
- R6: Interruption recovery remains five-minute same-route refresh and never duplicate Send.
- R7: Existing authorization, rate-limit, final-detection, and recovery invariants remain unchanged.
- R8: Tests/builds run only in GitHub Actions or htch-runtime.

## 8. Regression coverage

Focused tests must prove:

1. A task can restore recent status/assistant records after its in-memory `messages` array is cleared.
2. A record older than two hours is excluded.
3. `persistWorkbenchState()` still stores no `messages` field in canonical localStorage.
4. Connection-interruption status reports the correct remaining refresh time and refresh count.
5. Packaged script version/constants declare the two-hour retention contract.
6. The full existing test suite remains green on the exact PR HEAD.
