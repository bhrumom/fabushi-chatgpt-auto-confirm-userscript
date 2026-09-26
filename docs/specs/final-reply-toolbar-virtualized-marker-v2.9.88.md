# Final reply toolbar with virtualized task marker — v2.9.88

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Last updated: 2026-09-26
Related issue/task/PR: N/A

## 1. Context / problem

ChatGPT may virtualize (unmount) the user message containing the Fabushi task marker during a long conversation. When the script's own “继续完成所有” continuation becomes the latest mounted user turn, the task-scoped reply detector can fail ownership before it checks the visible action toolbar. The script may then send another continuation even though the assistant reply above Copy, Like/Dislike, Share, Read Aloud and More controls is already final.

## 2. Goal

Recognize the latest completed assistant reply from its own visible action toolbar, even when the original task marker has been virtualized.

## 3. Non-goals / out of scope

- Do not accept an older assistant reply's toolbar as completion for a newer user turn.
- Do not claim a route owned by another task or containing a foreign task marker.
- Do not treat the global composer or unrelated page controls as a reply toolbar.
- Do not change recovery navigation.

## 4. Requirements

- R1: If the exact task conversation URL is current, the original marker is not mounted, no competing task owns the route or has a marker mounted in this document, and the latest mounted user message is the exact “继续完成所有” prompt with a recorded continuation count, use it as the visible reply boundary.
- R2: Inspect only the latest assistant reply following that boundary.
- R3: A visible response-local toolbar containing Copy and at least one completion action (Share, Rate/Feedback, Like, Dislike, Sources, or More), with nonempty reply content and no active Stop button, is positive final evidence.
- R4: A toolbar belonging to an older assistant reply cannot complete a later user turn.
- R5: An active generation, missing/incomplete toolbar, foreign task marker, competing route owner, or empty reply remains non-final.

## 5. Current state

`latestTurn(task)` returns `owned: false` immediately if it cannot find the marker or the exact scripted continuation prompt after that marker. Therefore it never evaluates the latest visible reply toolbar after ChatGPT virtualizes the marker.

## 6. Target state

Use a narrowly bounded exact-route fallback to a recorded scripted continuation when the task marker is absent. The existing latest-assistant selection and per-response action-toolbar classifier remain the final authority.

## 7. Architecture and ownership boundaries

The canonical userscript owns task-boundary and DOM interpretation. The fallback requires the exact persisted conversation URL, an exact recorded scripted continuation, no competing route owner, and no foreign marker. Reply completion must remain associated with the latest assistant turn or its immediate response lane.

## 8. Interfaces / contracts / schemas / data flow

No persisted schema or UI changes. `latestTurn(task)` may use the latest mounted user turn as the reply boundary only when it is the exact recorded scripted continuation on the exact unique route after the original marker was virtualized.

## 9. Constraints and non-functional requirements

- Keep DOM work bounded to the existing task/response scan.
- Preserve conservative behavior on ambiguous routes.

## 10. Failure modes and edge cases

- Earlier completed assistant reply followed by a newer user turn: do not accept the earlier toolbar.
- Latest assistant has Stop/streaming state: remain non-final.
- Only composer-level actions exist: remain non-final.
- A foreign task marker or URL owner exists: remain unowned.

## 11. Implementation strategy

Allow ownership fallback in `latestTurn(task)` only when the marker is absent, a continuation was recorded and the latest mounted user message is exactly the continuation prompt, the live URL matches `task.url`, and there is no competing route owner or foreign marker. Reuse the existing latest reply toolbar checks.

## 12. Verification / test strategy

Run syntax validation and the regression suite before PR; require the exact-HEAD PR Test workflow before merge. Verify the main Test and automatic Release workflows and inspect the published script asset and metadata.

## 13. Acceptance criteria / Definition of Done

- AC-1: On a unique exact route with a virtualized marker, the latest natural-language reply with its own complete toolbar is eligible as final.
- AC-2: An older assistant toolbar cannot satisfy a newer user turn.
- AC-3: Active Stop/streaming and foreign ownership remain non-final.
- AC-4: v2.9.88 is merged to canonical `main` and the automatic GitHub Release includes the matching userscript source.

## 14. Release / migration / rollback

The Test workflow on canonical main triggers the Release workflow, which validates matching metadata/runtime versions and creates the release with `chatgpt-auto-confirm.user.js`. Roll back by installing the prior published version.

## 15. Observability / evidence

Record PR exact-HEAD Test, canonical-main Test, Release run, release asset SHA-256, and source version readback.

## 16. References / provenance

- User browser observation on 2026-09-26: Copy, Like/Dislike, Share, Read Aloud and More appear beneath completed replies; the later “继续完成所有” prompt was emitted by the script after it missed completion.
- `docs/specs/spec-first-ai-development.md`

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 | passed | Fallback requires the exact recorded continuation prompt, matching route, and no competing route owner or mounted foreign marker. |
| R2–R5 | passed (code review) | Existing latest-assistant selection, response-local toolbar, nonempty text, streaming/Stop and competing-owner checks remain in force. |
| AC-1–AC-2 | passed | Focused JSDOM regression confirms marker-virtualized final toolbar is accepted and an older toolbar cannot complete a newer recorded continuation. |
| AC-3 | pending | Exact-HEAD CI full regression is the release gate. |
| AC-4 | pending | Merge to main and automatic Release workflow required. |
