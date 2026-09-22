# Interrupted visible-content host recovery — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related issue/task/PR: user live incident 2026-09-22 / PR #64 / v2.9.54

## 1. Context / problem

Userscript v2.9.53 added multi-segment interrupted-assistant carry, but the live ChatGPT page can still show substantial assistant work before a connection interruption while the next fresh conversation receives no copy of that work.

Static inspection of the v2.9.53 extractor shows an uncovered renderer shape: visibleAssistantWorkTranscript() filters the outer data-message-author-role=assistant host with the global visible() predicate, and assistantSegmentContent() also rejects the host when it has no own client rectangle. A ChatGPT assistant host can be layout-neutral or otherwise have no measurable box while a nested .markdown, data-message-content, or selection-overlay content node is visibly rendered. In that shape the rich transcript extractor returns nothing. The legacy latest-turn fallback can then see only the final interruption status, which is stripped to empty, so no abnormalFreshCarry reaches the next prompt.

The existing JSDOM fixture gives every non-hidden HTMLElement a client rectangle, so the v2.9.53 regression suite cannot reproduce this live failure.

## 2. Goal

Treat visibly rendered semantic assistant descendants as the visibility authority even when their outer assistant-role host has no own layout box. Persist the substantive interrupted reply and inject it into the next fresh Work/review prompt without weakening task/conversation ownership boundaries.

Publish the verified fix as userscript v2.9.54.

## 3. Non-goals / out of scope

- Do not scrape another task, another conversation, hidden/inert content, sidebar text, controls, or Fabushi logs.
- Do not change the three-part abnormal Work prompt ordering.
- Do not weaken final-reply detection, route ownership, marker ownership, or foreign-task fail-closed behavior.
- Do not infer missing assistant work from screenshots or OCR at runtime.
- Do not change unrelated retry, rate-limit, attachment, approval, or scheduler behavior.

## 4. Requirements

- R1: An outer assistant-role host must not be rejected solely because getClientRects().length === 0 when it contains visible semantic assistant content.
- R2: Prefer visible non-overlapping .markdown, data-message-content, and data-selected-text-overlay-target descendants and preserve their document order.
- R3: If no semantic descendant is available, use the assistant host text only when the host itself is visible or it contains a visible rendered descendant; hidden/inert hosts remain excluded.
- R4: visibleAssistantWorkTranscript() must enumerate task-scoped assistant-role hosts without pre-filtering away layout-neutral hosts; content extraction decides whether each host contributes.
- R5: Continue stripping the standalone connection-interruption notice while preserving substantive prose before it.
- R6: Preserve exact-route, phase/round, foreign-marker, foreign-owner, and newer-user-turn safety guards.
- R7: Persist carry before clearing the interrupted dispatch and before navigating to the fresh chat.
- R8: The next Work prompt must remain ordered: (1) current review/next instruction, (2) interrupted assistant work, (3) original goal.
- R9: Review-phase fresh recovery must retain the captured context while preserving current taskId/round identity.
- R10: Add regression coverage in which the assistant-role host has zero client rects but its nested semantic message content is visible.
- R11: Add a negative regression proving hidden/inert semantic content is not copied merely because its assistant host is present.
- R12: Bump metadata and runtime version to 2.9.54 and deliver only after exact-head CI succeeds.

## 5. Current state

v2.9.53 correctly handles multiple visible assistant role nodes and marker virtualization when those role nodes themselves satisfy visible(). The test fixture globally mocks every non-hidden HTMLElement as having a client rectangle. Therefore role-host visibility and child-content visibility are accidentally equivalent in tests, unlike the live renderer.

## 6. Target state

Assistant transcript extraction is content-visible rather than host-box-visible. A layout-neutral assistant host contributes its visible semantic descendants, while hidden/inert or foreign content remains excluded. The interrupted reply is stored in abnormalFreshCarry and section two of the fresh prompt.

## 7. Architecture and ownership boundaries

Canonical repository: bhrumom/fabushi-chatgpt-auto-confirm-userscript.

Ownership remains:
1. exact canonical task conversation URL;
2. marker-owned/current user boundary when available;
3. exact-route fallback only when no foreign task marker or URL owner exists;
4. assistant content after that boundary;
5. phase/round-bound carry persistence.

Visibility changes only inside assistant-content extraction. It must not grant conversation ownership.

## 8. Interfaces / contracts / schemas / data flow

No external schema change.

Internal extraction:
- input: one task-scoped assistant-role host;
- output: visible semantic assistant text or empty string;
- visible semantic descendants can validate rendered content even if the host has no box;
- task persistence fields remain abnormalFreshCarry*.

Data flow:
interruption detection → task/route ownership proof → visible assistant transcript extraction → carry persistence → old dispatch clearing → fresh-chat prompt generation.

## 9. Constraints and non-functional requirements

- Fail closed across tasks/routes.
- Keep bounded carry size.
- Do not add clipboard/OCR/screenshot dependencies.
- Heavy verification and release gate use GitHub Actions.
- Avoid broad DOM text scraping when semantic assistant content exists.

## 10. Failure modes and edge cases

- Assistant role host uses display: contents / zero client rect while nested Markdown is visible.
- Nested semantic roots overlap; outermost visible roots should avoid duplication.
- Final status-only assistant host follows substantive hosts; status is removed without deleting earlier work.
- Host and descendants are hidden/inert; no carry.
- Marker is virtualized; exact-route guarded fallback still works.
- A foreign task marker/owner is present; no fallback capture.
- Long output remains bounded by the existing carry limit.

## 11. Implementation strategy

1. Add an assistant-content visibility helper that can detect visible semantic descendants independently of the role host's own box.
2. Refactor assistantSegmentContent() to read visible semantic roots first and only use host text as a guarded fallback.
3. Remove role-host .filter(visible) from visibleAssistantWorkTranscript().
4. Add deterministic zero-rect-host and hidden/inert regressions.
5. Bump userscript metadata/runtime version to 2.9.54.

## 12. Verification / test strategy

- GitHub Actions repository Test on the exact PR head.
- Existing npm test suite executes syntax/runtime regressions through the workflow.
- Regression must model a zero-client-rect assistant host with a visible semantic descendant.
- Regression must assert abnormalFreshCarry and generated fresh Work prompt contain the substantive interrupted work and exclude the interruption notice.
- Negative regression must assert hidden/inert content is not captured.
- After merge, canonical-main Test must pass and release workflow must publish/read back v2.9.54.

## 13. Acceptance criteria / Definition of Done

- AC-1: Zero-rect assistant host + visible semantic child yields the substantive interrupted carry.
- AC-2: The generated fresh Work prompt contains that carry in section two between current instruction and original goal.
- AC-3: Standalone interruption status is absent from the carry.
- AC-4: Hidden/inert semantic content is not copied.
- AC-5: Foreign-task and final/review identity regressions remain green.
- AC-6: Exact-head CI passes before merge.
- AC-7: Canonical main contains v2.9.54, post-merge Test passes, and GitHub Release v2.9.54 is published from the tested source.

## 14. Release / migration / rollback

Release through the existing tested-main release workflow. No data migration is required. Existing persisted carry fields are backward compatible.

Rollback by reverting the v2.9.54 behavior-changing merge. No schema rollback is necessary.

## 15. Observability / evidence

Completion evidence:

- Implementation PR: #64.
- Exact tested PR head: `bdd567229dff689db311d0d5613f1efd0ea724c4`.
- Exact-head Test workflow: run `35684468559`, conclusion `success`; regression suite `165/165 PASS`, `0 FAIL`.
- The immediately preceding run `35684416892` failed only because the packaging test still asserted v2.9.53; commit `bdd567229dff689db311d0d5613f1efd0ea724c4` updated that assertion to v2.9.54 before the successful exact-head gate.
- Protected delivery action: PR #64 squash-merged only after the exact tested head was green.
- Canonical main source merge SHA: `13a3f0bc4c24ee2502cfd23d330bf11bb4bd5f38`.
- Canonical-main Test workflow: run `35684521310`, conclusion `success`; regression suite `165/165 PASS`, `0 FAIL`.
- Release workflow: run `35684552169`, conclusion `success`.
- GitHub Release: `v2.9.54`, published 2026-09-22T03:49:22Z from target `13a3f0bc4c24ee2502cfd23d330bf11bb4bd5f38`.
- Release asset: `chatgpt-auto-confirm.user.js`, 276545 bytes, digest `sha256:0a3f223b1ed6dde4c20b96d789b9d590019fc5aaea9cf7f84a5761326c10dcad`.
- Final source readback at the canonical merge SHA reports both userscript metadata `@version 2.9.54` and runtime `VERSION = '2.9.54'`.

## 16. References / provenance

- AGENTS.md
- docs/specs/spec-first-ai-development.md
- docs/specs/interrupted-visible-reply-carry.md (v2.9.53)
- chatgpt-auto-confirm.user.js v2.9.53
- test/workbench.test.mjs
- User live screenshot and explicit report on 2026-09-22 that the interrupted assistant work is still absent from the next prompt.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R9 | passed | PR #64 implements content-visible extraction for layout-neutral assistant hosts while preserving route/task/phase-round boundaries and existing three-part prompt ordering. |
| R10-R11 | passed | `test/workbench.test.mjs` adds deterministic zero-rect positive coverage plus hidden/inert negative coverage; both are included in the 165/165 passing exact-head and canonical-main suites. |
| R12 | passed | Metadata/runtime version is 2.9.54; exact-head Test run 35684468559 passed before merge. |
| AC-1 | passed | Zero-rect assistant host with visible semantic descendants is captured by the new regression and the exact-head/main suites. |
| AC-2 | passed | Regression asserts the next Work prompt contains the captured work in section two between the current instruction and original goal. |
| AC-3 | passed | Regression asserts the standalone connection-interruption notice is removed from the persisted carry. |
| AC-4 | passed | Hidden and inert assistant content is excluded by the negative regression. |
| AC-5 | passed | Full 165-test regression suite passed at both exact PR head and canonical main, including foreign-task and final/review identity coverage. |
| AC-6 | passed | Exact-head Test run 35684468559 succeeded on bdd567229dff689db311d0d5613f1efd0ea724c4 before PR #64 merged. |
| AC-7 | passed | Canonical main SHA 13a3f0bc4c24ee2502cfd23d330bf11bb4bd5f38 passed Test run 35684521310; Release run 35684552169 published v2.9.54 with the recorded asset digest. |
