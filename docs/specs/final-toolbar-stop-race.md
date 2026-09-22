# Final-toolbar / Stop-disappearance race — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related issue/task/PR: user live incident 2026-09-22 / follow-up to v2.9.54

## 1. Context / problem

A live ChatGPT conversation can complete normally while the Fabushi userscript incorrectly logs:

“检测到当前会话 Stop 已消失且没有授权卡或最终回复，判定为异常停止；已在原会话输入并发送‘继续完成所有’”。

The user supplied screenshots show the previous assistant reply already rendered with the normal response action row (copy / feedback / more / sources), while a new “继续完成所有” user turn had already been injected and the new generation Stop button was visible. This proves the recovery action raced ahead of the normal final-toolbar mount.

Current runtime has contradictory behavior:
- classify() correctly treats “Stop disappeared but final evidence is not yet visible” as waiting.
- inspect() separately arms a 15-second stopMissing path and calls sendContinuation(), overriding that fail-closed classification.
- the toolbar detector also misses some renderer layouts where the response action row is mounted outside the assistant article/its narrow ancestor scopes, or where the secondary final action is “sources/more” rather than the older feedback/share set.

## 2. Goal

Eliminate false abnormal-continuation sends caused solely by Stop disappearance, and make normal final-toolbar detection robust enough for current ChatGPT response-action layouts.

Publish the verified fix as userscript v2.9.55.

## 3. Non-goals / out of scope

- Do not remove explicit recovery for actual connection interruption, retryable message/send errors, conversation-length limits, or authorization-card flows.
- Do not treat text stability alone as final evidence.
- Do not relax task/conversation ownership safeguards.
- Do not infer completion from the composer being available.
- Do not alter unrelated attachment, memory, navigation, or release behavior.

## 4. Requirements

- R1: Stop disappearance by itself must never trigger sendContinuation().
- R2: Remove the 15-second STOP_MISSING_CONTINUE_GRACE_MS recovery path and its persisted stopMissingSince/stopMissingSignature state where they exist only for that path.
- R3: When Stop is absent but final-toolbar evidence is not yet mounted, remain bound to the same conversation in waiting state.
- R4: Explicit abnormal conditions retain their own recovery behavior: connection interruption, retryable send/message errors, conversation-length limits, authorization cards, rate limits, and the existing long no-final watchdog.
- R5: Final completion must still require non-empty assistant content, no Stop, no pending authorization card, task ownership, and the existing stability window.
- R6: Recognize response-local Copy plus any established completion companion: share, feedback, like, dislike, sources/citations, or more-actions.
- R7: The detector must be able to find a response action row rendered in the latest assistant turn lane even when it is outside the assistant article, without adopting controls from an older turn.
- R8: Controls without an explicit turn association may count only when they are after the latest assistant content and before the composer/next conversation turn in document order.
- R9: Explicit message-id / turn-key association remains valid for portaled action rows.
- R10: Add a regression reproducing the live race: Stop disappears, composer is visible, no toolbar yet; after more than 15 seconds the script must not send “继续完成所有”.
- R11: Add a regression where the toolbar appears later; the same task must finish normally and must not have emitted a continuation.
- R12: Add a regression for Copy + Sources/More response actions outside the assistant article but in the latest response lane.
- R13: Preserve negative coverage preventing an older response toolbar from completing the latest turn.
- R14: Bump userscript metadata/runtime version and version assertions to 2.9.55.
- R15: Deliver only after exact-head GitHub Actions Test passes, then verify canonical-main Test and the release workflow.

## 5. Current state

v2.9.54 includes:
- FINAL_REPLY_STABILITY_MS = 4000.
- STOP_MISSING_CONTINUE_GRACE_MS = 15000.
- classify() returns waiting when Stop is absent without final evidence.
- inspect() independently tracks stopMissingSince and, after 15 seconds, invokes sendContinuation().
- finalByActions requires Copy plus share/feedback/like/dislike.
- action discovery searches the assistant article, assistant node, and up to two non-main ancestors, plus explicitly-associated portaled controls.

This allows a normal renderer transition (Stop disappears before final toolbar fully mounts) to become an incorrect continuation.

## 6. Target state

Normal transition:
generating/Stop visible → Stop disappears → waiting → final response actions mount → final candidate → stable for the normal window → complete.

No continuation is emitted merely because Stop disappeared.

Explicit error/recovery signals remain independent.

## 7. Architecture and ownership boundaries

Canonical repository: bhrumom/fabushi-chatgpt-auto-confirm-userscript.

Final evidence layers:
1. task ownership / exact recovery identity;
2. latest assistant content;
3. response-local completion controls or explicit static+Copy evidence;
4. no Stop / no approval;
5. stable-across-scans final gate;
6. finish().

Abnormal-recovery layers must not bypass these rules based only on missing Stop.

## 8. Interfaces / contracts / schemas / data flow

No external schema change.

Internal behavior changes:
- delete the stop-missing continuation timer/state machine;
- expand responseControlKind() with a source/citation semantic kind;
- allow main/latest-lane action discovery with strict document-order guards for unassociated controls;
- keep explicit portaled association support.

## 9. Constraints and non-functional requirements

- Fail closed under ambiguous ownership.
- No duplicate user message on a normally completed response.
- No local heavyweight build; verification through repository GitHub Actions.
- Keep existing stable update/download URLs.
- Keep release workflow idempotent.

## 10. Failure modes and edge cases

- Stop disappears before action buttons mount: wait.
- Composer becomes available before final action buttons: still wait.
- Copy + Sources/More appears after assistant content: recognize final candidate.
- Older response action row is still mounted: do not attribute it to the latest assistant.
- Explicit connection interruption appears: existing interruption recovery still applies.
- Retryable assistant error card appears: existing same-chat continuation behavior remains.
- Authorization card appears while Stop is absent: approval behavior wins.
- Final toolbar appears with stale streaming marker: preserve existing complete-toolbar behavior.

## 11. Implementation strategy

1. Remove STOP_MISSING_CONTINUE_GRACE_MS and stopMissing timer/state handling.
2. Remove the inspect() branch that calls sendContinuation() from Stop disappearance.
3. Expand response action semantics with sources/citations and allow more-actions as a completion companion to Copy.
4. Add a latest-response-lane guard for unassociated controls found outside the article.
5. Add deterministic JSDOM regressions for the live race, late toolbar completion, response-lane actions, and old-toolbar rejection.
6. Bump to v2.9.55.

## 12. Verification / test strategy

- GitHub Actions Test on exact PR head.
- node --check is already part of Test.
- npm test is already part of Test.
- Regression must prove no continuation after >15s Stop absence.
- Regression must prove later toolbar completes the task without a continuation send.
- Regression must prove Copy + Sources/More in the latest response lane counts as final.
- Full existing suite must stay green.
- After merge, canonical-main Test and Release workflow must succeed.
- Read back v2.9.55 release and exact userscript asset.

## 13. Acceptance criteria / Definition of Done

- AC-1: A normal Stop→toolbar transition never receives an injected “继续完成所有”.
- AC-2: A task with Stop absent, composer visible, no final toolbar remains waiting even beyond the old 15-second threshold.
- AC-3: When the final toolbar appears and remains stable, the task finishes normally.
- AC-4: Copy + Sources/More in the current response lane is sufficient response-action evidence when Stop is absent.
- AC-5: Older-turn controls cannot complete the latest assistant turn.
- AC-6: Explicit abnormal recovery regressions remain green.
- AC-7: Exact-head Test passes before merge.
- AC-8: Canonical-main Test passes and GitHub Release v2.9.55 is published from the tested source.

## 14. Release / migration / rollback

No storage migration is required. Old stopMissing fields, if present in localStorage, become inert and may be cleared opportunistically by existing dispatch/final cleanup.

Release through the existing tested-main workflow.

Rollback by reverting the v2.9.55 behavior-changing merge.

## 15. Observability / evidence

Pre-merge implementation evidence:
- Implementation PR: #66.
- Verified implementation head: `63e3d123e0489031655c7952d75b9f79a6b4c70d`.
- GitHub Actions Test run: `35687647581`, conclusion `success`.
- Regression suite: `167/167 PASS`, `0 FAIL`.
- Focused regressions passed:
  - Stop disappearance with a visible composer never triggers an abnormal continuation.
  - A late sibling final toolbar completes normally without injecting continuation.
  - An older unassociated toolbar cannot complete the latest assistant turn.
- Final PR head: `b32b7b7fecc2747db0f72cdf332f6dfe00c06364`.
- Exact-head Test run: `35687725747`, conclusion `success`.
- PR #66 squash merge / canonical source SHA: `10eb221ec8dda9d670e72a331a63f54e312f84cb`.
- Canonical-main Test run: `35687774100`, conclusion `success`; `167/167 PASS`, `0 FAIL`.
- Release workflow run: `35687808003`, conclusion `success`.
- GitHub Release: `v2.9.55`, published 2026-09-22T04:41:37Z from target `10eb221ec8dda9d670e72a331a63f54e312f84cb`.
- Release asset: `chatgpt-auto-confirm.user.js`, 276346 bytes, digest `sha256:db45f7217e593da56a4efa426102a574a0691c55d1bf2d2dc5f7211dd26c2437`.
- Final source readback reports both metadata `@version 2.9.55` and runtime `VERSION = '2.9.55'`.

## 16. References / provenance

- AGENTS.md
- docs/specs/spec-first-ai-development.md
- docs/specs/recovered-final-reply-identity.md
- docs/specs/tested-github-release-delivery.md
- chatgpt-auto-confirm.user.js v2.9.54
- test/workbench.test.mjs
- User screenshots and explicit report on 2026-09-22 showing a completed response toolbar followed by an incorrectly injected “继续完成所有”.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R14 | passed | PR #66 removes the 15-second Stop-missing continuation path, leaves Stop disappearance in waiting, expands final action detection to sources/more, constrains sibling action rows to the latest response lane, and bumps runtime/metadata to 2.9.55. |
| R15 | passed | Final exact-head Test run 35687725747 passed before merge; canonical-main Test run 35687774100 and Release run 35687808003 both succeeded. |
| AC-1-AC-6 | passed | Both the exact-head and canonical-main suites passed 167/167 tests, including the three focused live-race regressions and all existing explicit abnormal-recovery coverage. |
| AC-7 | passed | Final PR head b32b7b7fecc2747db0f72cdf332f6dfe00c06364 passed Test run 35687725747 before PR #66 merged. |
| AC-8 | passed | Canonical source SHA 10eb221ec8dda9d670e72a331a63f54e312f84cb passed Test run 35687774100; Release run 35687808003 published v2.9.55 with the recorded asset digest. |
