# Send acknowledgement and multi-tab efficiency — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-23
Related issue/task/PR: user-reported duplicate dispatch and high CPU across multiple tabs

## 1. Context / problem

A successful ChatGPT send can leave the submitted prompt in the composer while the Stop control and task marker/route are delayed. The scheduler currently treats a send as ambiguous for 90 seconds, then may clear its send identity and dispatch the same task in a fresh conversation. Multiple live tabs also run recurring DOM scans every two seconds, plus popup and optional approval scans, creating avoidable CPU use.

## 2. Goal

Prevent a retained, exact submitted prompt from being automatically resent while send acceptance remains ambiguous, and reduce recurring work across visible and background tabs without making recovery unresponsive.

## 3. Non-goals / out of scope

- Do not infer a task is complete from a composer draft or missing Stop button.
- Do not automatically click Send a second time when the first click may have succeeded.
- Do not introduce cross-tab shared locking or reduce explicit error recovery.
- Do not promise immediate recovery while Chrome throttles background tabs.

## 4. Requirements

- R1: When an attempted send has no safely bound conversation but the composer still exactly matches this task's prepared prompt, retain the original token/attempt and do not fresh-resend solely because the 90-second confirmation window elapsed.
- R2: Once task marker or unique new route evidence appears, bind/adopt the original send and resume normal inspection without changing task/phase/round/attachments.
- R3: When the draft is no longer retained and there is no safe route/marker, preserve the existing bounded ambiguous-send recovery policy.
- R4: Increase ordinary visible supervision cadence from 2 seconds to 4 seconds; run ordinary hidden-page supervision no more often than every 15 seconds, except explicit shorter retry deadlines.
- R5: Reduce repeated popup DOM scans to 5 seconds visible and 15 seconds hidden; keep optional global-approval scans responsive at 1.5 seconds visible and 8 seconds hidden.
- R6: Add regressions for retained-composer ambiguous-send protection, later route adoption, ordinary polling cadence, and timer cleanup/pause behavior.

## 5. Current state

`tick()` defaults to a 2-second scan. Popup scans repeat every second; enabled global authorization scans repeat every 1.2 seconds. After an attempted send's 90-second confirmation timeout, `stopAmbiguousSend()` adopts a discoverable route or immediately queues a fresh send. It does not inspect an unchanged exact prompt left in the composer.

## 6. Target state

An unchanged exact task prompt after a possibly successful click is retained as an ambiguous send and remains bound to its original send token. The scheduler checks at a measured lower cadence and wakes sooner only for explicit retry/dispatch deadlines or foreground send/approval work.

## 7. Architecture and ownership boundaries

The task's persisted `preparedPrompt` and `token` define exact send identity. Composer contents are only ambiguity evidence; they never prove completion or conversation ownership. Existing unique route and task-marker checks remain authoritative. Cadence belongs to each document scheduler; visibility-aware timers are local and do not coordinate tabs.

## 8. Interfaces / contracts / schemas / data flow

Persist `retainedComposerDraftSince` only as diagnostic state if needed; no external schema or permission change. Existing versioned localStorage migration must tolerate the optional field.

## 9. Constraints and non-functional requirements

Preserve short explicit retry deadlines; never busy-loop. Use visibility state at each timer scheduling decision. Background tabs may be throttled further by Chrome. Maintain safe authorization and send exclusivity.

## 10. Failure modes and edge cases

- Exact prompt remains and route appears: adopt original send, do not create a duplicate.
- Exact prompt remains but no route appears: keep original send pending and explain in task log; do not resend.
- Prompt differs or composer clears with no ownership evidence: existing ambiguous recovery applies.
- Bound task URL exists: existing bound-route recovery takes precedence.
- User pauses/cancels: timers stop through current lifecycle controls.

## 11. Implementation strategy

1. Guard the unbound 90-second resend path with exact prepared-composer matching.
2. Keep attempted-send ownership durable while the exact draft is retained.
3. Move ordinary scheduler, popup, and global-approval cadence to visibility-aware intervals.
4. Add focused JSDOM tests and run the full suite and syntax/diff checks.
5. Bump userscript version to 2.9.64 and record compliance evidence.

## 12. Verification / test strategy

Test retained draft prevents resend after timeout; route adoption still binds the same task; changed/cleared draft retains existing retry behavior; visible/hidden intervals meet R4-R5; all existing tests pass.

## 13. Acceptance criteria / Definition of Done

- AC-1: Exact retained prompt cannot trigger an automatic fresh conversation resend after the timeout.
- AC-2: Original send is adopted when matching route/marker appears.
- AC-3: Visible and hidden polling use the specified intervals, preserving explicit short deadlines.
- AC-4: Relevant focused tests and full repository suite pass; syntax and diff checks pass.
- AC-5: Spec compliance table records each requirement with evidence.

## 14. Release / migration / rollback

No destructive migration. Optional task diagnostic fields are safe to ignore. Rollback by reverting implementation commit. Release only after exact-head CI and canonical-main release workflow verify.

## 15. Observability / evidence

Local implementation version: 2.9.64.
- Focused JSDOM regression set passed (5 targeted tests, including legacy resend fallback).
- Full `npm test`: 191 tests, 184 passed, 0 failed, 7 skipped.
- `node --check chatgpt-auto-confirm.user.js` and `git diff --check` passed.
- Exact-head GitHub CI/release and live Chrome runtime verification: pending.

## 16. References / provenance

- `AGENTS.md`
- `docs/specs/spec-first-ai-development.md`
- `docs/specs/tested-github-release-delivery.md`
- `chatgpt-auto-confirm.user.js` send() / stopAmbiguousSend() / tick()
- `test/workbench.test.mjs`
- User report on 2026-09-23: sent prompt can remain in composer with no Stop button, causing later duplicate dispatch; multiple active script tabs raise device temperature.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R6 | passed | Exact-composer guard protects ambiguous sends; existing marker/route adoption runs before the guard; visible/hidden timers use revised cadences and preserve sub-second recovery deadlines. |
| AC-1 | passed | Regression `exact prompt retained after an ambiguous send prevents a fresh duplicate dispatch`. |
| AC-2 | passed | Regression `retained prompt is adopted into its later marked route without changing send identity`. |
| AC-3 | passed | Regression `visibility-aware supervision slows ordinary scans but preserves short recovery deadlines`; runtime callers pass the 4s/15s visibility cadence. |
| AC-4 | passed | Full suite 184 passed, 0 failed, 7 skipped; syntax and diff checks passed. |
| AC-5 | blocked | Exact-head CI and live Chrome CPU/dispatch verification have not yet run. |
