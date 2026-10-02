# Review visible-report extraction — v2.10.26

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-02
Related live incident: current Review visibly produced an exact `status:"next"` report, the recent-work snapshot retained the full JSON, but the runtime classified the conversation as ended without a final reply and opened another Review conversation.

## 1. Problem

v2.10.23 added semantic Review final recognition for exact current `taskId` + `round`, but the promotion path still depends on current turn ownership or a previously observed Stop/generation identity.

The live v2.10.25 incident proves a remaining split-brain path:

1. `visibleAssistantWorkTranscript(..., { allowExactRouteFallback:true })` can read and persist the exact current Review JSON from the task's canonical conversation even after the marker-bearing user turn is virtualized.
2. `persistHandoffReplySnapshot()` records that visible report as the current phase/round snapshot.
3. Final recognition still evaluates `turn.owned` / Stop-bound recovery and therefore may never pass that same text into `currentReviewReport()` / `parseReview()`.
4. The abnormal no-final path then wins and creates another Review conversation although the visible report already contains a valid `next`.

The parser is not the failure: the captured JSON is valid and contains the exact current identity. The failure is that the visible-report extraction path and the final-result consumption path use different evidence sources.

## 2. Goal

Make Review final recognition consume the same exact-route visible assistant transcript that recovery already trusts for task-scoped carry, but only when the transcript itself contains a valid exact current Review report.

A current Review report is allowed to become final semantic evidence even when:
- the original Fabushi user marker has been virtualized; and
- this document did not previously persist a Stop/generation observation.

This exception is Review-only and is justified by the report's embedded exact task identity, not by route equality alone.

## 3. Required safety gates

Visible-transcript Review promotion requires all of:

1. task phase is `review`;
2. live canonical conversation URL exactly equals the task URL;
3. task is not in an ambiguous/unbound send state;
4. no foreign Fabushi task marker is mounted;
5. no other task owns the canonical route;
6. Stop is absent;
7. no current streaming/busy response is active;
8. no authorization card or settlement latch is active;
9. no blocker, rate-limit, or retryable error is active;
10. the enabled composer is idle/empty before completion;
11. the current exact-route visible assistant transcript parses through the existing `currentReviewReport()` / `parseReview()` path;
12. parsed `taskId` and `round` exactly match the current task.

Route equality, generic assistant prose, an old snapshot, or a mismatched report is never sufficient.

## 4. Runtime behavior

During `inspect()`:

- keep the normal marker-owned `turn.text` path first;
- if Review is exact-route but marker ownership is unavailable, obtain the current response with `visibleAssistantWorkTranscript(task, { allowExactRouteFallback:true })`;
- validate that text with `currentReviewReport(text, task)`;
- when all safety gates hold, expose that same text as the inspection sample's semantic Review final candidate;
- preserve the existing final stability window before `finish()`;
- pass the exact captured report text to `finish()`, which remains the only phase-transition owner;
- `status:"next"` must populate `task.next`, increment `round`, switch to Work and queue it;
- `status:"complete"` must finish the task.

The abnormal no-final handoff must not run while this exact valid Review report is stabilizing.

## 5. Regression requirements

Focused tests must prove:

1. a marker-virtualized exact-route Review with no stored Stop identity can still read the exact visible report;
2. `status:"next"` survives the normal stability gate, increments the round, stores `next`, and queues Work;
3. `status:"complete"` finishes normally through the same path;
4. a mismatched taskId/round remains fail-closed;
5. malformed/non-JSON Review prose remains in the bounded no-final path;
6. a foreign task marker or another route owner prevents promotion;
7. active Stop, streaming, approval, blocker, rate-limit, non-empty composer, or ambiguous send prevents promotion;
8. Work behavior is unchanged.

## 6. Version and delivery

- Bump metadata/runtime/README to `2.10.26`.
- No local test/build execution.
- Verify only with GitHub Actions or htch-runtime.
- Exact PR HEAD Test must succeed before merge.
- After merge, canonical `main` Test and Release must succeed.
- Published Release `v2.10.26` must target the merged main commit and contain `chatgpt-auto-confirm.user.js`.

## 7. Acceptance criteria

- AC-1: The supplied live failure class no longer logs ended-without-final after already capturing a valid current Review report.
- AC-2: The captured report is actually consumed by `parseReview()` and drives the next Work round.
- AC-3: No route-only or natural-language completion relaxation is introduced.
- AC-4: Exact identity and all existing safety boundaries remain enforced.
- AC-5: Exact-head CI, canonical-main CI, and Release evidence are recorded before delivery is claimed.

## 8. Spec compliance record

| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| Runtime + regressions | pending | Implementation and exact-head GitHub Actions required. |
| Version + release | pending | Merge, canonical-main Test and v2.10.26 Release required. |
