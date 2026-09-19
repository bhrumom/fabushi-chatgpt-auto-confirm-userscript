# 2026-09-19 — Loading recovery scheduler deadlock

Latest live-site evidence:
- 15:07:37 rate-limit episode 2/3 -> five-minute cooldown.
- 15:12:37 cooldown ends and recorded conversation recovery starts.
- 15:18:40 page reports loading.
- 15:19:10 logs `ChatGPT 页面长时间没有恢复；正在进行第 1/2 次单次加载恢复，不会循环刷新。`.
- More than one hour later no additional automation log or recovery action occurs.

Confirmed source root causes in v2.9.44:
1. `recoverStalledRoute()` calls `beginGuardedNavigation()` against the current same conversation URL with `navigating=true`.
2. `beginGuardedNavigation()` cancels any target whose pathname equals `location.pathname`, even when `recovery=true`, so the advertised recovery does not actually reload the page.
3. The scheduler's `tick.finally` sees `navigating=true` and therefore schedules nothing. The later same-route cancellation sets `navigating=false` but does not call `schedule()`, permanently stopping the supervision loop.
4. `navigate(..., requireComposer=false)` clears `routeRecoveryAttempts` whenever the route is already correct, even if `pageLoadingState()` is still true. This makes repeated failed recovery display `第 1/2 次` instead of progressing.

Required behavior:
- A same-route recovery must perform a real document reload rather than being cancelled as a no-op.
- Every asynchronous navigation path that aborts/cancels before committing navigation must restart the scheduler.
- A committed navigation/reload gets a bounded watchdog; if the document does not unload, the scheduler must self-heal instead of remaining stuck behind `navigating=true`.
- Route/document recovery counters reset only after loading has genuinely cleared, not merely because inspection can see the same route/task marker.
- The 1/2 -> 2/2 -> fresh-document recovery sequence must be deterministic and never become silent.
- Preserve rate-limit cooldown, interruption pending-continuation, approvals, task identity and attachment behavior.
- Release the userscript and synchronize the not-yet-released Chrome host bundle to the fixed source.
