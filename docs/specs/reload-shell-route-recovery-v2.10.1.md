# Reload shell-only route recovery — v2.10.1

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-28  
Related issue/task/PR: live v2.10.0 task remains at “等待响应” after refresh while the ChatGPT composer is visible but the conversation transcript is blank

## 1. Context / problem

v2.10.0 fixed the inherited-Stop zero-scan loop and allows an already-visible owned final reply to bypass the historical Stop hydration gate. A second live failure remains: after refresh/pause/resume, ChatGPT can render the exact conversation URL and enabled composer while mounting no visible user/assistant message nodes. The inherited-Stop branch treats this as incomplete hydration and returns on every scan.

That early return currently stores `identityMismatchSince: 0`, so the existing bounded empty-route recovery (`ROUTE_HYDRATION_TIMEOUT_MS` → `recoverStalledRoute()`) can never mature. The task therefore keeps scanning but performs no recovery action.

## 2. Goal

Keep the inherited-Stop safety boundary while allowing a bound shell-only ChatGPT conversation to enter the existing same-route renderer recovery after the normal 30-second hydration grace period.

## 3. Non-goals / out of scope

- Do not treat a blank transcript as task completion.
- Do not open a fresh chat merely because message nodes are absent.
- Do not clear or weaken inherited Stop evidence.
- Do not resend the task prompt.
- Do not change the 15-minute generic conversation-stall policy.
- Do not change authorization, rate-limit, blocker, final-reply, foreign-owner, or route-ownership rules.

## 4. Requirements

- R1: When the task is on its exact bound conversation, carries an inherited Stop observation, Stop is absent, the document is complete, the composer is enabled, and no visible user/assistant messages are mounted, supervision must persist a shell-hydration timer instead of resetting the mismatch timer to zero.
- R2: The shell-hydration timer must use the existing `ROUTE_HYDRATION_TIMEOUT_MS` boundary (30 seconds).
- R3: Before that timeout, keep the task in the same conversation and do not navigate, resend, or fresh-chat.
- R4: At or after the timeout, invoke the existing `recoverStalledRoute()` for the same exact URL. Existing route-recovery attempt limits/backoff remain authoritative.
- R5: If visible conversation messages or Stop appear before the timeout, the shell-only timer must clear and normal inherited-Stop handling resumes.
- R6: A visible, strongly owned final reply still wins before this recovery path, preserving v2.10.0 behavior.
- R7: Authorization cards, blockers, rate limits, foreign task markers, competing route owners, and ambiguous sends must prevent shell-only route recovery.
- R8: Every waiting pass remains observable through scan accounting/observation state; the recovery path must not restore a zero-scan loop.
- R9: No shell-only recovery path may create a fresh task dispatch or duplicate user send.
- R10: Publish as v2.10.1 only after exact-head Test, canonical-main Test, Release, tag, and release-asset verification succeed.

## 5. Current state

The inherited-Stop early-return branch records a bounded observation with `identityMismatchSince: 0` and returns before the later empty-route hydration recovery logic. A shell-only route therefore never reaches `recoverStalledRoute()`.

## 6. Target state

The inherited-Stop branch recognizes a fully loaded shell-only exact route as a bounded hydration mismatch, preserves its start timestamp across scans, and hands it to the existing same-route recovery mechanism after 30 seconds without fresh-chat or resend.

## 7. Architecture and ownership boundaries

The userscript remains the sole owner of task supervision and recovery classification. This change reuses the existing route recovery mechanism; it does not add a new navigation subsystem or host API.

## 8. Interfaces / contracts / schemas / data flow

No external schema change is required.

Flow:

exact bound route + inherited Stop + complete document + enabled composer + no visible messages
→ persist hydration mismatch timestamp
→ wait up to 30 seconds
→ if messages/Stop return, clear timer and use normal path
→ otherwise call existing `recoverStalledRoute(exactURL, task)`.

## 9. Constraints and non-functional requirements

- Keep DOM work bounded to existing message/composer checks.
- Preserve current navigation guard and recovery backoff.
- Do not introduce a polling loop faster than the existing scheduler.
- Do not read or duplicate full transcript content for this decision.

## 10. Failure modes and edge cases

- Composer exists but document is still loading: wait; do not start shell timer.
- Document/composer ready but authorization card appears: approval handling wins.
- Another task owns the same route: do not recover for this task.
- Stop reappears: bind it to the current document and cancel inherited-absence/shell recovery.
- Messages reappear without Stop: continue existing inherited-Stop stable-absence logic.
- Final reply toolbar appears: v2.10.0 owned-final path completes normally.
- Route recovery reaches its existing attempt/backoff boundary: preserve that boundary; do not escalate to fresh-chat from this new condition.

## 11. Implementation strategy

1. Add a focused regression reproducing a complete document with an enabled composer and no visible conversation messages under inherited Stop.
2. Refactor inherited-Stop readiness to cache composer/message readiness once per scan.
3. Persist the shell-only `identityMismatchSince` value inside the inherited-Stop observation.
4. Once the existing 30-second timeout elapses, call `recoverStalledRoute()` on the exact task URL and return.
5. Add regressions that messages or Stop cancel the shell timer.
6. Bump metadata/runtime/README/tests to v2.10.1 for the release PR.

## 12. Verification / test strategy

- Focused workbench regression for the live shell-only state.
- Regression: no recovery before 30 seconds.
- Regression: recovery after 30 seconds uses same URL and does not queue a fresh send.
- Regression: visible message hydration clears the shell timer and starts normal inherited-Stop stability behavior.
- Regression: Stop reappearance keeps the same conversation.
- Existing v2.10.0 inherited-Stop, recovered-final, ownership, approval, route recovery, and generic 15-minute stall tests.
- Full `npm test` and userscript syntax check through GitHub Actions.

## 13. Acceptance criteria / Definition of Done

- AC-1: The reported shell-only state no longer waits forever without a recovery action.
- AC-2: A shell-only exact route stays on the same conversation for the first 30 seconds.
- AC-3: After 30 seconds, the existing same-route recovery is invoked.
- AC-4: No duplicate send or fresh-chat occurs from shell-only hydration alone.
- AC-5: Message/Stop reappearance returns to ordinary inherited-Stop behavior.
- AC-6: Existing final-reply and safety-boundary regressions remain green.
- AC-7: Exact-head Test, canonical-main Test, Release, tag, and v2.10.1 asset readback all succeed.

## 14. Release / migration / rollback

No task data migration is required. Existing persisted task records remain compatible. Rollback is v2.10.0; no schema downgrade is needed.

## 15. Observability / evidence

Record the focused regression, route-recovery attempt/log state, exact commit, PR Test run, merge SHA, canonical-main Test run, Release run, tag, asset digest, and live Fabushi reproduction result when the host device is available.

Delivery evidence (2026-09-28): PR #111 exact-head Test #332 passed on `01891793aeb3ec76c5c7c80e24f836fe96f7647a` with 262 tests / 255 passed / 0 failed / 7 skipped. Squash merge `f4831b87823410884565d9b07f3d8c17065cbf97` passed canonical-main Test #333 and Release #145. GitHub Release `v2.10.1` is published with `chatgpt-auto-confirm.user.js` (358012 bytes; `sha256:767d3db50b20529f44e12c2b82db25549853929ff3a57654e220739fef837229`). Live Fabushi-host validation remains blocked until an account-scoped device is online.

## 16. References / provenance

- `docs/specs/reload-hydration-and-reply-carry-v2.9.98.md`
- `docs/specs/resume-final-reply-before-inherited-stop-gate-v2.10.0.md`
- Existing `recoverStalledRoute()` / `ROUTE_HYDRATION_TIMEOUT_MS` behavior
- User-provided live v2.10.0 screenshot on 2026-09-28

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R9 / AC-1-AC-6 | passed | PR #111 implemented shell-only inherited-Stop hydration timing and same-route recovery without fresh-chat/resend. Exact-head Test #332 (run `36362107063`) succeeded on `01891793aeb3ec76c5c7c80e24f836fe96f7647a`; full suite reported 262 tests, 255 passed, 0 failed, 7 skipped. Focused regressions verify no recovery before 30 seconds, same-route recovery after timeout, no Send click, and normal inherited-Stop handling after messages hydrate. |
| R10 / AC-7 | passed | PR #111 squash-merged as `f4831b87823410884565d9b07f3d8c17065cbf97`; canonical-main Test #333 (run `36362153018`) succeeded; Release #145 (run `36362185639`) succeeded; tag `v2.10.1` targets the merge commit; release asset `chatgpt-auto-confirm.user.js` is 358012 bytes with `sha256:767d3db50b20529f44e12c2b82db25549853929ff3a57654e220739fef837229`. |
| Live Fabushi reproduction | blocked | Release delivery is verified, but the authenticated Fabushi MCP currently reports no online account-scoped devices and the available `gloria-macbook-air` device is offline, so the user’s live Chrome task cannot be remotely re-tested in this turn. This is not treated as evidence of installation or live recovery. |
