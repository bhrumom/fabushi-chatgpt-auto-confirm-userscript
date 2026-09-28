# Zero-rect visible message hosts — v2.10.2

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-28  
Related issue/task/PR: live v2.10.1 task reports “消息区仍未挂载” even though the full transcript is visibly rendered

## 1. Context / problem

v2.10.1 added bounded same-route recovery for a true shell-only ChatGPT route. A live follow-up shows the opposite case: the transcript is already fully visible, but the script still classifies the page as if no conversation messages were mounted.

The current readiness helper uses `visible(node)` directly on `[data-message-author-role=user|assistant]`. `visible()` requires the role host itself to have at least one client rect. ChatGPT can render the role host as a layout-neutral / zero-rect container (for example `display: contents`) while its turn wrapper and semantic message children are visibly painted. The repository already handles this renderer shape when extracting assistant content, but the conversation-readiness, loading, active-generation, and progress-fingerprint paths still require the role host itself to own a rect.

This mismatch can incorrectly start the shell-only hydration timer, trigger same-route recovery on an already-rendered conversation, and suppress page progress detection.

## 2. Goal

Treat a ChatGPT message as visibly mounted when its role host is connected and not hidden/inert, and either the host itself, a semantic message child, or the owning conversation turn provides real rendered evidence.

## 3. Non-goals / out of scope

- Do not accept hidden, inert, `display:none`, or `visibility:hidden` transcript content.
- Do not weaken task ownership, marker, route, final-toolbar, approval, blocker, or rate-limit rules.
- Do not treat arbitrary text elsewhere in `main` as a conversation message.
- Do not infer user/assistant roles from prose or page order when `data-message-author-role` is absent.
- Do not change the 30-second shell-only timeout or the 15-minute generic stall policy.
- Do not introduce full-page text scans on ordinary supervision ticks.

## 4. Requirements

- R1: Add one bounded message-rendered predicate for `[data-message-author-role]` hosts.
- R2: The predicate must reject disconnected, Fabushi-owned, hidden, inert, `display:none`, and `visibility:hidden` hosts.
- R3: A role host with a client rect remains visible exactly as before.
- R4: A zero-rect role host is visible when a known semantic message child (`.markdown`, `[data-message-content]`, or `[data-selected-text-overlay-target]`) is visible.
- R5: A zero-rect role host may also be considered visible when its owning conversation turn is visibly rendered and the role host contains text, covering user-message renderer shapes without semantic assistant wrappers.
- R6: `visibleConversationHasMessages()` must use the new predicate.
- R7: `pageLoadingState()` must use the same predicate when deciding whether a loading document already has a rendered transcript.
- R8: `activeAssistantGeneration()` must not discard a zero-rect assistant role host before checking its owning turn for streaming/busy state.
- R9: `visibleConversationProgressFingerprint()` must include zero-rect-but-rendered recent role hosts so visible progress resets the stall clock.
- R10: The v2.10.1 shell-only path must not start when visible message content is already painted through a zero-rect role host.
- R11: Hidden/inert zero-rect content must remain excluded from readiness/progress decisions.
- R12: Publish as v2.10.2 only after exact-head Test, canonical-main Test, Release, tag, and release-asset verification succeed.

## 5. Current state

`visibleConversationHasMessages()`, the loading detector, active-generation detector, and visible progress fingerprint call `visible()` directly on role hosts. This fails when ChatGPT uses a layout-neutral role wrapper.

## 6. Target state

All message-mounted decisions share one renderer-aware predicate. The predicate recognizes the same zero-rect-but-painted shape already supported by assistant-content extraction, while preserving hidden/inert and ownership safety boundaries.

## 7. Architecture and ownership boundaries

The userscript remains the only owner of renderer classification and task supervision. This change is local to DOM interpretation and does not add a host API, navigation mechanism, or new persistence schema.

## 8. Interfaces / contracts / schemas / data flow

No external schema changes.

Renderer evidence flow:

`[data-message-author-role]` host
→ reject disconnected / Fabushi / hidden / inert / CSS-hidden
→ accept host rect
→ else accept visible semantic message child
→ else accept visible owning conversation turn + text-bearing role host
→ use result consistently for hydration, loading, active generation, and progress fingerprinting.

## 9. Constraints and non-functional requirements

- Keep checks bounded to existing role nodes and their owning turn / known semantic descendants.
- Do not walk the whole transcript subtree on every scan.
- Preserve current scan cadence and memory behavior.
- Reuse existing `visible()`, `hasTextNode()`, and conversation-turn selectors.

## 10. Failure modes and edge cases

- `display:contents` assistant host with visible Markdown: must count as rendered.
- Zero-rect user host inside a visible conversation turn with text: must count as rendered.
- Hidden/inert turn: must not count.
- CSS `display:none` or `visibility:hidden` role host: must not count even if an ancestor is visible.
- Visible turn wrapper containing a text-bearing role host plus unrelated controls: role identity still comes exclusively from `data-message-author-role`.
- A role host exists but neither host, semantic child, nor owning turn is visibly rendered: keep treating it as not mounted.
- Existing true shell-only route with no role nodes: v2.10.1 30-second same-route recovery remains unchanged.

## 11. Implementation strategy

1. Add a renderer-aware message visibility helper beside the existing generic `visible()` helper.
2. Replace direct role-host `.filter(visible)` / `.some(visible)` use in conversation hydration, page loading, active assistant generation, and recent progress fingerprinting.
3. Add focused regressions that model zero-rect role hosts with visibly painted descendants/turn wrappers.
4. Add negative regressions for hidden/inert role hosts.
5. Bump userscript metadata/runtime/README/tests to v2.10.2.

## 12. Verification / test strategy

- Regression: inherited Stop + zero-rect user/assistant hosts + visible transcript must enter normal hydrated handling, not shell-only waiting.
- Regression: a loading `document.readyState` with a zero-rect role host and painted message content must recognize that a visible turn exists.
- Regression: recent progress fingerprint must retain zero-rect rendered messages.
- Regression: hidden/inert zero-rect messages remain absent.
- Existing v2.10.0/v2.10.1 inherited Stop, final reply, shell-only recovery, route recovery, loading, and stall tests.
- Full `npm test` and syntax check in GitHub Actions.

## 13. Acceptance criteria / Definition of Done

- AC-1: The live “消息区明明已经全部出现但仍提示未挂载” renderer shape is represented by a passing regression.
- AC-2: Visible zero-rect role hosts no longer start the v2.10.1 shell-only timer.
- AC-3: True empty transcript shells still use the v2.10.1 30-second same-route recovery.
- AC-4: Hidden/inert transcript content is never accepted as visible.
- AC-5: Existing task ownership and final-reply safety regressions stay green.
- AC-6: Exact-head Test, canonical-main Test, Release, tag, and v2.10.2 asset readback all succeed.

## 14. Release / migration / rollback

No persistent data migration. Existing task state is compatible. Rollback is v2.10.1.

## 15. Observability / evidence

Record the focused renderer regression, exact-head SHA/Test run, merge SHA, canonical-main Test run, Release run, tag, asset digest, and live-host validation status.

Delivery evidence (2026-09-28): exact-head Test #337 passed on `e30b5ddc8afcca833200e3c612f3225010cc60df` with 266 tests / 259 passed / 0 failed / 7 skipped. PR #113 squash-merged as `c5a08b3a825d6c3c48f2578729c8fe45736b278c`; canonical-main Test #338 and Release #150 succeeded. GitHub Release `v2.10.2` is published with `chatgpt-auto-confirm.user.js` (359370 bytes; `sha256:fc39e4cbd5e6ecf18f1f5fe5b2fcbaaf2252a320eefb7606d086255f668a29e2`). Live DOM validation remains blocked while `gloria-macbook-air` is offline.

## 16. References / provenance

- `docs/specs/reload-shell-route-recovery-v2.10.1.md`
- Existing `assistantSegmentContent()` zero-rect host compatibility
- User live report on 2026-09-28: transcript fully visible while logs say “消息区仍未挂载”

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R11 / AC-1-AC-5 | passed | PR #113 implemented renderer-aware role-host visibility and reused it for hydration/loading, active assistant detection, message-area readiness, and visible progress fingerprinting. Exact-head Test #337 (run `36362707629`) succeeded on `e30b5ddc8afcca833200e3c612f3225010cc60df`; full suite reported 266 tests, 259 passed, 0 failed, 7 skipped. Focused regressions verify zero-rect rendered user/assistant hosts are recognized, hidden/inert hosts remain excluded, a loading document recognizes the painted transcript, and inherited Stop no longer enters shell-only recovery for an already-rendered zero-rect transcript. |
| R12 / AC-6 | passed | PR #113 squash-merged as `c5a08b3a825d6c3c48f2578729c8fe45736b278c`; canonical-main Test #338 (run `36362763215`) succeeded; Release #150 (run `36362796803`) succeeded; tag `v2.10.2` targets the merge commit; release asset `chatgpt-auto-confirm.user.js` is 359370 bytes with `sha256:fc39e4cbd5e6ecf18f1f5fe5b2fcbaaf2252a320eefb7606d086255f668a29e2`. |
| Live Fabushi reproduction | blocked | Release delivery is verified, but the available `gloria-macbook-air` device remains offline, so the user’s exact live Chrome DOM cannot be remotely inspected or re-tested in this turn. This is not treated as live-installation evidence. |
