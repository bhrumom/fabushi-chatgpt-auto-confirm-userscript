# Interrupted visible-reply carry — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-22
Related issue/task/PR: user incident 2026-09-22 / PR #62 / v2.9.53

## 1. Context / problem

The userscript already stores `abnormalFreshCarry` and the fresh Work prompt already has the required three-part structure. In the live failure reported on 2026-09-22, however, a connection-interrupted ChatGPT conversation visibly contains substantial assistant work while the next fresh conversation still receives no usable copy of that work.

The existing capture path reads `turn.text` or the unscoped `latestTurn()`. Both are latest-turn oriented. Current ChatGPT agent/work rendering can split one response across multiple assistant-authored DOM segments, mount a final status/error assistant segment after earlier work text, or temporarily expose only a small/empty latest assistant content node. In those states the page visibly contains the interrupted work but the carry can be empty or incomplete.

## 2. Goal

Before abandoning an exact task conversation because of connection interruption or another proven abnormal fresh-chat recovery, copy the visible assistant work for that interrupted response into the task carry and include it in the next prompt so the new chat continues from the real work already performed.

Publish the verified fix as userscript v2.9.53.

## 3. Non-goals / out of scope

- Do not scrape another task or another conversation.
- Do not treat arbitrary page text as assistant work.
- Do not weaken final-reply detection or task ownership.
- Do not copy user prompts, sidebar text, toolbar labels, Fabushi logs, or the standalone interruption notice into the carry.
- Do not change the required three-part Work prompt ordering.

## 4. Requirements

- R1: Keep marker-owned `turn.text` as valid input, but do not assume one `data-message-author-role="assistant"` node contains the complete visible interrupted work.
- R2: On an exact task route, collect visible assistant-authored content belonging to the current response in document order, including multiple assistant DOM segments after the current owned/visible user turn.
- R3: If the marker-bearing user turn is virtualized away, exact-route fallback may collect visible assistant segments only when no other task owns the URL and no foreign Fabushi task marker is mounted.
- R4: Prefer semantic message-content nodes such as `.markdown` / `[data-message-content]`; fall back to assistant text only when necessary. Avoid duplicate nested content.
- R5: Remove standalone connection-interruption text from the carry and ignore empty/status-only assistant segments. Keep the existing bounded carry size.
- R6: Preserve the order of substantive assistant work so the next model can understand what was completed and what was in progress.
- R7: Persist the captured carry before clearing the old dispatch identity and before navigating to the fresh chat.
- R8: The next Work prompt must still contain, in this order: (1) final current-round review instruction/current task prompt, (2) interrupted conversation assistant work, (3) original goal.
- R9: Review-phase abnormal recovery must retain the same captured assistant context without changing taskId/round identity rules.
- R10: Add regressions for a multi-segment assistant response where the latest assistant segment is only the interruption status/empty shell, plus marker-virtualized exact-route recovery.
- R11: Bump userscript metadata/runtime version to 2.9.53 and deliver only after exact-head CI succeeds.

## 5. Current state

`captureOwnedAbnormalFreshCarry()` primarily reads `turn.text`; its route fallback calls `latestTurn()`, which selects only the last assistant node. Existing tests model the assistant reply as a single assistant node and therefore do not reproduce the live split-response failure.

## 6. Target state

A dedicated interrupted-work extractor returns the substantive visible assistant transcript for the current task response. It can combine multiple assistant segments, de-duplicate nested semantic content, strip the interruption status, and fail closed when route/task ownership is ambiguous.

## 7. Architecture and ownership boundaries

Canonical repository: `bhrumom/fabushi-chatgpt-auto-confirm-userscript`.

Ownership order:
1. Exact canonical task conversation URL.
2. Marker-owned current user turn when mounted.
3. Exact-route fallback only under existing no-foreign-owner/no-foreign-marker guards.
4. Assistant-only DOM extraction scoped after the current user boundary when that boundary is available.
5. Existing phase/round-bound `abnormalFreshCarry` persistence and prompt generation.

## 8. Interfaces / contracts / schemas / data flow

No external schema change.

Internal extractor contract:
- Input: task plus optional owned turn/current DOM.
- Output: bounded visible assistant work text and source kind.
- It must not mutate task ownership.
- It must not make a reply final.
- `captureOwnedAbnormalFreshCarry()` remains responsible for persisting source URL, phase, round, reason and timestamp.

## 9. Constraints and non-functional requirements

- Fail closed across tasks/routes.
- Preserve current single-tab multi-task isolation.
- Do not use OCR, screenshots, or browser clipboard APIs for runtime extraction.
- Avoid copying action/toolbars where semantic assistant message content exists.
- Heavy verification remains in GitHub Actions.

## 10. Failure modes and edge cases

- Multiple assistant segments after one user turn: concatenate substantive segments.
- Latest assistant segment contains only `连接已中断。正在等待完整回复。`: retain earlier assistant work and drop the status.
- Latest assistant segment is empty/streaming shell: retain earlier substantive work.
- Marker user turn virtualized: exact-route guarded fallback may still extract visible assistants.
- Foreign task marker or another persisted owner: do not route-fallback capture.
- Nested `.markdown` / message-content nodes: do not duplicate text.
- Extremely long visible output: preserve beginning and latest edge via existing bound.

## 11. Implementation strategy

1. Add a semantic assistant-content reader that extracts non-overlapping message content from one assistant node.
2. Add a task-scoped visible assistant transcript helper that identifies the current user boundary when possible and gathers following assistant nodes in document order.
3. Use the richer transcript in `captureOwnedAbnormalFreshCarry()` before falling back to the old single-turn text.
4. Keep all existing route/foreign-task guards.
5. Add JSDOM regressions for split assistant segments and fresh-prompt handoff.
6. Bump to v2.9.53.

## 12. Verification / test strategy

- `node --check chatgpt-auto-confirm.user.js`
- repository `npm test`
- GitHub Actions `Test` on exact PR head
- canonical-main `Test` after merge
- read back main metadata/runtime version and extractor implementation

## 13. Acceptance criteria / Definition of Done

- AC-1: Given visible assistant work split across several assistant nodes and a final status-only interruption node, the persisted carry contains all substantive work in order and excludes the interruption notice.
- AC-2: The fresh Work prompt contains that carry in section two between the current-round instruction and original goal.
- AC-3: Marker virtualization on the exact task route still carries visible assistant work when no foreign owner/marker exists.
- AC-4: Foreign task ownership/marker blocks exact-route fallback.
- AC-5: Existing final detection and review identity tests remain green.
- AC-6: Exact-head CI passes before merge.
- AC-7: Canonical main reports version 2.9.53 and post-merge CI passes.

## 14. Release / migration / rollback

Release: merge the verified PR to `main`; stable userscript `@updateURL`/`@downloadURL` already track raw canonical main. Publish/record the canonical GitHub Release using the repository's tested delivery workflow.

Migration: none.

Rollback: revert the v2.9.53 merge. Stored carry fields remain backward compatible.

## 15. Observability / evidence

Record branch/head SHA, PR number, exact-head test run, merge SHA, canonical-main test run, release/tag if produced, and final source readback.

## 16. References / provenance

- `AGENTS.md`
- `docs/specs/spec-first-ai-development.md`
- `docs/specs/recovered-final-reply-identity.md`
- `projects/continuous-auto-retry/source/2026-09-21-abnormal-reply-carry.md`
- User screenshot and explicit requirement on 2026-09-22.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R11 | passed | PR #62 implements the visible assistant transcript extractor, split-response carry, exact-route marker-virtualization fallback, three-part Work prompt preservation, review identity preservation, and version bump. Exact-head `c0fb73f547ba5b6afed75de42f511035b9662cfe` passed Test run `35683780271`. |
| AC-1-AC-5 | passed | `test/workbench.test.mjs` covers split assistant segments with status-only interruption, marker virtualization with a retained user boundary, foreign marker rejection, three-part prompt ordering, and the pre-existing final/review identity regressions. All tests passed on the exact PR head and canonical main. |
| AC-6 | passed | PR #62 exact-head Test run `35683780271` succeeded before squash merge. |
| AC-7 | passed | PR #62 squash-merged as canonical main `9745c14531b97542a7f0aae671e4b5bc3d9bb107`; canonical-main Test run `35683823051` succeeded. Main readback reports metadata/runtime version `2.9.53`. Release run `35683855653` succeeded and published `v2.9.53` targeting the merge SHA with asset `chatgpt-auto-confirm.user.js` SHA-256 `928a422b3dfda8c008cf80b108cbab46bf72c29c44db806e9c13a7d81213fdca`. |
