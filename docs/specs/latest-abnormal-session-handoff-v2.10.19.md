# Latest abnormal-session handoff replacement — v2.10.19

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-01
Related incident: after one abnormal fresh-session handoff succeeds, a later interruption in the replacement ChatGPT conversation can still place the first interrupted conversation's realtime reply/work steps into the next recovery prompt.

## 1. Context / problem

The existing abnormal fresh-session design uses two durable fields:

- `abnormalFreshCarry`: the work trace selected for the next abnormal recovery prompt.
- `handoffReplySnapshot`: a pagehide/reload-safe fallback copy of the visible assistant work trace.

The intended behavior is already documented: when several abnormal conversations occur in sequence, only the newest interrupted conversation's visible assistant reply and work steps may be carried forward.

The current implementation has a stale-snapshot hole. After conversation C1 is interrupted and C2 is opened, C1's `handoffReplySnapshot` remains valid because `handoffReplySnapshotForCurrentPhase()` checks only phase, round and goal revision. It does not require the snapshot's source conversation URL to equal the current interrupted conversation. If C2 later interrupts while its latest assistant DOM is temporarily unavailable, `captureOwnedAbnormalFreshCarry()` can fall back to the stale C1 snapshot and then re-label it with C2's URL. C3 therefore receives C1 work instead of the latest C2 work.

The existing repeated-interruption regression supplies the second interruption's text directly and therefore does not exercise this DOM-loss fallback.

## 2. Required outcome

For C1 -> abnormal handoff -> C2 -> abnormal handoff -> C3:

1. C3 must never reuse C1's carry/snapshot merely because C2's live assistant DOM is temporarily unavailable.
2. A durable handoff snapshot is usable only for the same canonical conversation URL from which it was captured.
3. Once a recovery prompt has been successfully dispatched into a newly bound conversation, the previous conversation's consumed carry/snapshot must no longer be eligible as fallback evidence for that new conversation.
4. If the newest interrupted conversation has no safe current work trace, recovery may continue without a work-trace section; it must not substitute older conversation content and present it as current.
5. If C2 has a current C2 snapshot, C3 may use that C2 snapshot when C2's DOM disappears.
6. Work and Review phases retain the same phase/round/goal-revision isolation, task ownership guards, prompt contracts and bounded persistence.

## 3. Goals

- Make abnormal carry strictly latest-conversation scoped.
- Prevent stale snapshot provenance from being rewritten as a newer conversation.
- Preserve pagehide/reload recovery for the current conversation.
- Add regressions for multiple sequential abnormal handoffs, including DOM loss.
- Release the verified fix as v2.10.19.

## 4. Non-goals

- Do not accumulate an unbounded chain of all prior interrupted replies.
- Do not change final-reply recognition, authorization handling, rate-limit handling, attachment behavior, reasoning preset behavior, memory behavior, or the 15-minute stall policy.
- Do not treat missing current work text as permission to use a previous conversation's text.
- Do not run builds/tests locally; verification is GitHub Actions only.

## 5. Requirements

### Provenance and lifecycle

- R1: `handoffReplySnapshotForCurrentPhase(task)` must reject a snapshot when its canonical `handoffReplySnapshotSourceURL` does not equal the task's currently bound canonical conversation URL.
- R2: A snapshot with missing/invalid source URL must not be used as abnormal fresh-handoff fallback.
- R3: `captureOwnedAbnormalFreshCarry()` may consume `handoffReplySnapshot` only after the same-route provenance check passes.
- R4: Successful binding/confirmation of a newly dispatched fresh conversation must retire the previous conversation's consumed `abnormalFreshCarry` and `handoffReplySnapshot` before that new conversation can later become the source of another abnormal handoff.
- R5: Retirement must happen only after the new conversation is safely bound/owned; do not clear recovery context before the replacement prompt has actually been sent and associated with its real conversation.
- R6: Current-conversation pagehide snapshots remain writable and usable after R4; the new conversation can create its own fresh snapshot.
- R7: If no latest-conversation live text, owned preview or same-route durable snapshot exists, the next recovery prompt omits abnormal work trace rather than reusing older content.
- R8: Phase, round and goalRevision checks remain in force in addition to URL provenance.
- R9: A later true final reply or manual goal edit continues to clear recovery carry/snapshot.

### Tests

- R10: Regression: C1 interruption captures C1, C2 binds, then C2 interruption with current C2 text replaces C1.
- R11: Regression: C1 interruption captures C1, C2 binds, C2 DOM is unavailable and C2 has no current snapshot; C3 must not contain C1.
- R12: Regression: same as R11 but C2 has a durable C2 snapshot; C3 uses C2 and excludes C1.
- R13: Regression: `handoffReplySnapshotForCurrentPhase()` rejects foreign URL even when phase/round/goalRevision match.
- R14: Existing abnormal visible work-step/tertiary trace tests remain green.
- R15: metadata/runtime version and version assertions are bumped to v2.10.19.

### Delivery

- R16: exact PR-head Test workflow succeeds.
- R17: PR is merged only after R16.
- R18: canonical-main Test succeeds on the merge SHA.
- R19: Release workflow succeeds and publishes v2.10.19 with `chatgpt-auto-confirm.user.js`.
- R20: release readback verifies tag, target/source commit, asset and digest.

## 6. Architecture / implementation plan

No new subsystem.

1. Make `handoffReplySnapshotForCurrentPhase()` conversation-provenance aware by comparing the snapshot source URL with the task's current bound conversation URL.
2. Add a focused helper that retires abnormal carry and old handoff snapshot once a fresh replacement conversation is successfully bound.
3. Call that helper only in the successful send/bind path, after the new `/c/<id>` is proven to contain this task marker.
4. Leave `persistHandoffReplySnapshot()` responsible for writing the newest current-route snapshot during subsequent work/pagehide.
5. Preserve `captureOwnedAbnormalFreshCarry()` source priority, but make the durable snapshot fallback incapable of crossing conversation URLs.
6. Add sequential abnormal-handoff regressions reproducing the exact stale fallback.

## 7. Verification

GitHub Actions `Test` must run:

- `node --check chatgpt-auto-confirm.user.js`
- full `npm test` suite, including the new sequential abnormal-handoff regressions.

No local test/build execution is accepted as release evidence.

## 8. Acceptance criteria

- AC-1: A second/later abnormal interruption never carries the first interrupted conversation as though it were the latest.
- AC-2: Current-conversation snapshot fallback still survives DOM loss/pagehide.
- AC-3: Missing newest work evidence yields no abnormal trace rather than stale trace.
- AC-4: Provenance cannot be rewritten from old URL to new URL by fallback.
- AC-5: Existing ownership/finality/work-step behavior is unchanged.
- AC-6: v2.10.19 is merged, canonical-main tested, released and asset-verified.

## 9. Compliance record

| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R15 / AC-1-AC-5 | pending implementation | This spec records the production root cause and required regression matrix before product code changes. |
| R16-R20 / AC-6 | pending delivery | Requires exact-head GitHub Actions Test, merge, canonical-main Test, Release and release readback. |
