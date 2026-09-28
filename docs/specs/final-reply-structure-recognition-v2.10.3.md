# Final reply structure recognition — v2.10.3

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-28  
Related issue/task/PR: live report that the task is recognized as ended but the visible assistant reply is not recognized as final

## 1. Context / problem

The current final-reply detector is stricter than the product requirement and current ChatGPT renderer behavior.

The product-level completion rule is: the current task-owned assistant reply is visible, Stop is gone, and the response-local Copy control has appeared. The current implementation instead requires Copy plus at least one secondary action (Share / feedback / like / dislike / source / more), unless an explicit static completion attribute is also present. If ChatGPT renders only Copy first, changes the secondary action row, or delays the extra controls, the script can correctly conclude that generation has ended while still setting `turn.final === false`.

That false negative flows into the existing abnormal-ended path: exact route, idle composer, no Stop/streaming/approval/loading/blocker/rate limit, but no recognized final reply. The script can therefore report “当前会话已经结束但没有最终回复” even though a substantive assistant answer is already present.

A live inspection was attempted on the requested `htch-runtime` device. The device is online and its Chromium binary was located at `/opt/meta-chromium/chrome`; however, Chromium traffic from that sandbox is blocked by the Hatch egress path and reaches `chrome-error://chromewebdata/` with `ERR_EMPTY_RESPONSE` even though command-line curl can reach the proxy. No authenticated ChatGPT session is present on that device. Therefore this Spec does not claim a successful direct DOM capture from the user’s completed conversation; it uses the verified runtime failure path plus the repository’s existing response-lane binding rules and the user’s explicit completion criterion.

## 2. Goal

Recognize a real final assistant reply without depending on a particular set of secondary response actions, while keeping ownership, route, approval, error, loading, and streaming safety boundaries intact.

## 3. Non-goals / out of scope

- Do not treat arbitrary assistant text as final immediately.
- Do not accept response controls from an older assistant turn.
- Do not relax exact-route/task ownership.
- Do not complete while Stop, streaming, approval, retryable error, loading, blocker, rate-limit, or ambiguous-send state is active.
- Do not change conversation-length, connection-interruption, or authorization handling.
- Do not use a route-only ownership fallback to adopt assistant text as final.
- Do not require direct access to the user’s credentials or copy browser cookies to `htch-runtime`.

## 4. Requirements

- R1: A response-local Copy control bound to the latest task-owned assistant turn is sufficient final-UI evidence when Stop is absent and the turn is not streaming.
- R2: Secondary actions (Share / feedback / like / dislike / source / more) remain useful diagnostics but are no longer mandatory for finality.
- R3: Existing response-lane association rules must continue to reject an older or foreign toolbar.
- R4: If the current owned assistant reply has substantive natural-language content but the renderer exposes no recognizable Copy control, an idle-ended fallback may become a final candidate only when all of these are true: exact task route, strong task ownership, no Stop, no streaming, no approval, no loading, no blocker, no rate limit, no retryable error, enabled composer, empty composer, no ambiguous send.
- R5: The idle-ended natural reply fallback must remain text-stable for at least `ENDED_NO_FINAL_STABILITY_MS` (8 seconds) before completion.
- R6: Any reply-text change resets the natural-final stability window.
- R7: The natural-final fallback must be excluded from the abnormal “ended without final reply” fresh-recovery path while it is inside its 8-second stability window.
- R8: Route-only ended ownership (`routeEndedOwned`) must not be enough to finish from the natural-final fallback.
- R9: Retryable error cards, connection interruption, stream-cache expiry, length-limit notices, approvals, or hidden/foreign turns must never satisfy the fallback.
- R10: Existing strong-toolbar and recovered-static completion paths remain supported.
- R11: Publish as v2.10.3 only after exact-head Test, canonical-main Test, Release, tag, and release-asset verification succeed.

## 5. Current state

`latestTurn()` calculates `responseActionsComplete` as Copy plus one secondary completion action, and `turn.final` is true only for that combination or for an explicit static completion marker plus Copy.

`inspect()` separately knows when the conversation is idle/ended. If `turn.final` remains false, `abnormalNoFinalEligible` eventually classifies the page as an ended conversation with no final reply.

## 6. Target state

Final recognition uses two ordered evidence paths:

1. Strong UI path: latest response-local Copy + Stop absent + not streaming.
2. Bounded structural fallback: strongly owned natural assistant reply + fully idle exact-route state, unchanged for 8 seconds.

The second path exists only to tolerate renderer/action-row changes; it never overrides explicit error/approval/loading/ownership boundaries.

## 7. Architecture and ownership boundaries

No new subsystem is introduced. `latestTurn()` remains responsible for response-local structural evidence. `inspect()` remains responsible for route/task ownership and ended-state guards. `classify()` remains responsible for stability before completion.

## 8. Interfaces / contracts / schemas / data flow

No external schema changes.

Internal sample/observation additions:

- `naturalFinalCandidate: boolean`
- `naturalFinalSince: number`

Flow:

latest owned assistant turn
→ response-local Copy? → ordinary final path
→ otherwise inspect exact-route idle guards
→ natural-language reply candidate
→ stable 8 seconds with identical text
→ complete

## 9. Constraints and non-functional requirements

- Keep DOM scans bounded to the latest response/control lane and existing message nodes.
- Do not scan full page text to infer finality.
- Do not persist full additional transcript copies.
- Reuse existing 8-second ended-state stability duration.

## 10. Failure modes and edge cases

- Copy is the only visible action: final after ordinary final stability window.
- Copy appears as a sibling lane control: existing lane ownership rules apply.
- Copy belongs to an older response: reject.
- Natural text is visible but still changing: reset fallback timer.
- Natural text is stable but Stop is visible: not final.
- Natural text is stable but approval/error/loading is present: not final.
- Marker is virtualized and only route ownership remains: do not finish through the natural fallback.
- Current response has a length-limit or connection-error notice: existing special handling wins before fallback.
- Composer contains a draft: fallback is not eligible.

## 11. Implementation strategy

1. Relax the latest-turn final UI requirement from “Copy + secondary action” to response-local Copy with Stop absent and no streaming.
2. Preserve `responseActionsComplete` for diagnostics/tests.
3. Add the guarded `naturalFinalCandidate` in `inspect()`.
4. Add stability handling in `classify()` and observation persistence.
5. Exclude this candidate from `abnormalNoFinalEligible` while it is stabilizing.
6. Add focused regressions for Copy-only final, old-toolbar rejection, stable natural fallback, text-change reset, and error/ownership guards.
7. Bump metadata/runtime/README/tests to v2.10.3.

## 12. Verification / test strategy

- Copy-only response-local final UI completes.
- Copy-only sibling response lane completes.
- Older Copy toolbar cannot complete a newer assistant reply.
- Stable owned natural reply without recognizable toolbar completes after 8 seconds.
- Natural reply does not complete before 8 seconds.
- Text change resets the 8-second window.
- Retryable error / Stop / streaming / approval / loading / draft / route-only ownership block the fallback.
- Existing v2.10.0–v2.10.2 recovery, ownership, message visibility, and final-toolbar tests stay green.
- Full `npm test` and userscript syntax check in GitHub Actions.

## 13. Acceptance criteria / Definition of Done

- AC-1: The user-reported state “conversation ended, visible final answer present, final reply not recognized” is represented by passing regressions.
- AC-2: Copy alone on the latest owned response is sufficient final UI evidence.
- AC-3: Renderer variants with no recognized action row can still complete only through the guarded 8-second natural-reply fallback.
- AC-4: Older/foreign response controls and route-only ownership remain fail-closed.
- AC-5: Existing abnormal-error and recovery paths stay green.
- AC-6: Exact-head Test, canonical-main Test, Release, tag, and v2.10.3 asset readback all succeed.

## 14. Release / migration / rollback

No data migration. Existing persisted tasks/observations are backward compatible. Rollback is v2.10.2.

## 15. Observability / evidence

Record device inspection outcome, focused regression names, exact-head SHA/Test run, merge SHA, canonical-main Test run, Release run, tag, asset digest, and live-host revalidation when available.

Delivery evidence (2026-09-28): `htch-runtime` was inspected directly; `/opt/meta-chromium/chrome` launches, but ChatGPT navigation in that sandbox reaches `chrome-error://chromewebdata/` with `ERR_EMPTY_RESPONSE`, and the device has no authenticated ChatGPT session, so no live DOM capture is claimed. PR #115 exact-head Test #343 passed on `c403645f1143233327d368e5e52d396e78bf367b` with 272 tests / 265 passed / 0 failed / 7 skipped. Squash merge `9c6211a8be5171ea37cbca4b61a63d7ce2fd738a` passed canonical-main Test #344 and Release #156. GitHub Release `v2.10.3` publishes `chatgpt-auto-confirm.user.js` (361485 bytes; `sha256:553a6168823c510748f66263b60400b153e3af0c8efe994e825913bcb9e11be5`).

## 16. References / provenance

- `docs/specs/zero-rect-visible-message-hosts-v2.10.2.md`
- Current `latestTurn()`, `inspect()`, and `classify()` implementations
- User requirement: Stop gone + Copy present is a completed reply
- User live report on 2026-09-28 that ended-state recognition succeeds but final-reply recognition fails
- `htch-runtime` inspection attempt on 2026-09-28

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R10 / AC-1-AC-5 | passed | PR #115 implements Copy-only latest-response final UI evidence plus the guarded 8-second natural-language fallback. Exact-head Test #343 (run `36364119470`) succeeded on `c403645f1143233327d368e5e52d396e78bf367b` with 272 tests, 265 passed, 0 failed, 7 skipped. Focused regressions cover Copy-only inline/sibling actions, old-toolbar rejection, 8-second natural fallback, text-change reset, route-only rejection, and preserved stale-loader recovery. |
| R11 / AC-6 | passed | PR #115 squash-merged as `9c6211a8be5171ea37cbca4b61a63d7ce2fd738a`; canonical-main Test #344 (run `36364167128`) succeeded; Release #156 (run `36364197532`) succeeded; tag `v2.10.3` targets the merge commit; release asset `chatgpt-auto-confirm.user.js` is 361485 bytes with `sha256:553a6168823c510748f66263b60400b153e3af0c8efe994e825913bcb9e11be5`. |
| htch-runtime live DOM capture | blocked | The requested device was used and Chromium was located/launched, but sandbox browser traffic to ChatGPT resolves to `chrome-error://chromewebdata/` / `ERR_EMPTY_RESPONSE`; no authenticated ChatGPT profile is present. The device inspection therefore establishes the environment limitation only, not a fabricated live conversation DOM capture. |
