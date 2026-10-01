# Interrupted-state main-thread stall regression — v2.10.22

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-01

## 1. Incident

After v2.10.21, a real ChatGPT tab can become temporarily or effectively unresponsive while a bound conversation remains on `Connection interrupted. Waiting for the complete answer`.

The v2.10.21 recovery fix correctly moved explicit interruption handling ahead of inherited Stop hydration, but it also kept that interrupted page on the ordinary visible 4-second runner cadence. `superviseConnectionInterrupted()` always changed `updatedAt` and called `save()` after every unchanged pass. `save()` synchronously reads/merges/persists the workbench, writes the workspace heartbeat, and calls `paint()`. The same path also called the normal interruption progress fingerprint. On long/high-memory ChatGPT pages this recreates the synchronous main-thread pressure that v2.9.86 previously reduced.

## 2. Root cause / version boundary

- v2.10.20 introduced periodic same-route interruption refresh while Stop is present.
- v2.10.21 broadened the retained interruption state so the exact route remains under supervision even when the current document's Stop selector is missing or inherited hydration would otherwise win.
- The broad v2.10.21 state made the unconditional per-tick `save()` / paint path persistent in the exact scenario now reported.
- Therefore v2.10.21 is the first version whose explicit interruption supervisor itself can keep an otherwise static interrupted page on repeated 4-second persistence/paint work.

## 3. Required behavior

1. Preserve v2.10.21 precedence: a live explicit interruption still preempts inherited Stop/reload-hydration waits.
2. Persist/log the interruption transition once; do not persist identical interrupted state on every visible runner tick.
3. While the explicit interruption remains unchanged, schedule at most one recovery probe every 15 seconds.
4. Expose that probe deadline to `taskDeferredUntil()` so the scheduler skips the task entirely before the deadline; other tasks may continue.
5. Repeated direct/manual `inspect()` calls before the deadline must be idempotent: no updatedAt mutation, no new status message, no workbench repaint, no deadline sliding.
6. Use a cheap interruption-specific progress signature based on exact route, response boundary, bounded current assistant text, Stop, streaming and final flags. Do not call the ordinary conversation/activity fingerprint for each interruption probe.
7. Real progress restarts the five-minute no-progress interval and resets generic stalled-refresh counters.
8. At five minutes with no progress, refresh the same route using the existing durable interruption recovery; never duplicate the original send.
9. Clear the probe deadline with the rest of pending-continuation state.

## 4. Verification

- Source/package version must be v2.10.22.
- Regression: first interruption observation creates a probe about 15 seconds in the future.
- Regression: `nextSupervisionTask()` returns no runnable interrupted task before that deadline.
- Regression: a repeated early `inspect()` leaves updatedAt, messageVersion, paint count and probe deadline unchanged.
- Existing interruption, load-failure, approval, final-reply, rate-limit and five-minute refresh suites remain green.
- Verification and release are GitHub Actions only; no local build/test evidence is accepted.

## 5. Delivery

- Exact PR-head `Test` must pass.
- Merge only after that exact-head run succeeds.
- Canonical-main `Test` must pass on merge SHA.
- Release workflow must publish `v2.10.22` and attach `chatgpt-auto-confirm.user.js`.

## 6. Compliance record

| Requirement | Status | Evidence |
| --- | --- | --- |
| Runtime + regressions | pending | Await exact-head GitHub Actions Test. |
| Merge/main/release | pending | Await delivery pipeline. |
