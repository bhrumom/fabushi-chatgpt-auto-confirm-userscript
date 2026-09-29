# Abnormal visible work-trace carry — v2.10.10

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-09-29
Related live incident: an interrupted Work conversation visibly contains dozens of ChatGPT agent progress/activity lines (for example “下载并检查工作流构建产物”, “定位首个根因”, “等待 Rust 编译完成”) interleaved with ordinary assistant prose, while the fresh-session recovery prompt currently carries only the ordinary assistant reply text.

## 1. Context / problem

The current abnormal fresh-chat recovery already captures visible assistant reply text through `visibleAssistantWorkTranscript()` and carries it into the next Work/Review prompt. Current ChatGPT agent rendering, however, exposes a second class of useful visible work context:

`[data-markdown-text-style="assistant-message"][data-markdown-text-tone="tertiary"]`

These tertiary assistant activity summaries are not canonical assistant conversation messages and are intentionally excluded from `conversationRoleNodes('assistant')` so they do not affect final-reply recognition. On the live authenticated Mac page, the current Work response contains many such visible lines inside the same `data-content-search-turn-key` as the active response, interleaved with ordinary assistant prose.

As a result, when that conversation ends abnormally, the carry can say only the latest prose/status while dropping the concrete execution trace that tells the replacement session what has already been attempted, waited on, inspected, built, or verified.

## 2. User-required outcome

If the current Work or Review conversation ends abnormally, the next fresh conversation must receive the visible work already performed in that interrupted response, including both:

1. ordinary visible assistant reply/progress prose; and
2. visible ChatGPT agent activity/work-step summaries such as repository inspection, artifact download, root-cause analysis, CI polling, build waiting, test verification, and similar tertiary status lines.

The replacement conversation must continue from that combined work trace instead of receiving only the ordinary assistant reply.

## 3. Goals

1. Capture visible tertiary assistant work-step summaries together with existing visible assistant reply text.
2. Preserve the document order in which prose and work-step summaries appeared.
3. Carry the combined trace through all existing abnormal fresh-session recovery paths and pagehide snapshot fallback.
4. Keep final-reply detection unchanged: tertiary activity text is context only and never finality/ownership evidence by itself.
5. Keep task/route isolation fail-closed.
6. Publish the verified behavior as v2.10.10.

## 4. Non-goals

- Do not treat tertiary activity text as a normal assistant final reply.
- Do not copy raw hidden tool payloads, tool call arguments, browser chrome, Fabushi logs, user prompts, sidebar text, or inaccessible/hidden DOM.
- Do not include activity from older/foreign task responses.
- Do not weaken exact-route, marker, foreign-owner, authorization, rate-limit, blocker, or ambiguous-send guards.
- Do not change the v2.10.9 review-final ownership fix.
- Do not change the v2.10.8 explicit conversation-load 30-second × 7 recovery policy.
- Do not make the carry unbounded.

## 5. Live renderer evidence

Direct authenticated Mac DOM inspection on 2026-09-29 confirmed:

- userscript version on the live page: v2.10.9;
- current Work response outer turn: `data-content-search-turn-key="fallback-turn-0"`;
- visible work-step summaries use `data-markdown-text-style="assistant-message"` plus `data-markdown-text-tone="tertiary"`;
- example tertiary nodes include “完成 GitHub PR #20 并检查 CI 任务构件”, “下载并检查工作流构建产物”, “定位首个根因”, “等待 Rust 编译完成”, and many CI polling/build/test lines;
- the existing conversation-role selector recognizes primary assistant messages but deliberately does not classify tertiary activity nodes as canonical assistant messages.

This is exactly why current abnormal carry misses those work steps.

## 6. Requirements

### Capture

- R1: Add a dedicated selector/helper for visible tertiary assistant activity summaries.
- R2: Activity capture is allowed only on the exact canonical current task route.
- R3: When the task marker/current user boundary is mounted, reject capture if a newer user turn exists.
- R4: If the marker is virtualized, retain the existing exact-route fallback guard: no foreign Fabushi marker and no other task route owner.
- R5: Capture only visible, connected, non-Fabushi, non-hidden tertiary assistant-message nodes.
- R6: Scope activity to the current response boundary. Prefer the same current content-search response turn when available; do not sweep older conversation turns.
- R7: Keep existing ordinary assistant transcript extraction.
- R8: Merge ordinary assistant transcript entries and tertiary activity entries in DOM document order.
- R9: De-duplicate nested or repeated entries and avoid duplicating tertiary text that is already inside an ordinary assistant message container.
- R10: Preserve short status/wait lines such as “等待了20秒” or “等待 Rust 编译完成”; the user explicitly wants these execution steps carried.
- R11: Strip only the existing standalone interruption/network error boilerplate; do not strip substantive work-step text.
- R12: Keep the existing bounded carry limit.

### Persistence and prompt

- R13: `captureOwnedAbnormalFreshCarry()` persists the combined work trace before clearing the old dispatch.
- R14: `persistHandoffReplySnapshot()` also persists the combined work trace so a page reload/unload cannot lose activity context.
- R15: Work abnormal-recovery prompts explicitly describe the section as an interrupted **work trace** containing visible reply plus work steps.
- R16: Review abnormal-recovery prompts carry the same combined trace without changing `taskId`/`round` parsing rules.
- R17: A later-round Work recovery continues to include both the previous completed Work result and the current interrupted combined trace.
- R18: The combined trace remains supporting context; current-round instruction/`next` and original goal remain authoritative.

### Safety / compatibility

- R19: Tertiary activity nodes must not enter `latestTurn().text`, `turn.final`, final toolbar detection, review JSON parsing, or normal completed Work result storage.
- R20: A tertiary node from another content-search turn/older response is not carried when the current response turn is identifiable.
- R21: Foreign route/task marker blocks exact-route fallback activity capture.
- R22: Existing v2.10.9 review-final, v2.10.8 load-error, authorization, rate-limit, attachment, memory, and stalled-page regressions remain green.
- R23: Bump metadata/runtime/README/tests to v2.10.10.
- R24: Deliver only after exact-head Test succeeds, merge, canonical-main Test succeeds, Release succeeds, and the v2.10.10 asset is verified.

## 7. Target data flow

Current task response
→ ordinary primary assistant prose appears
→ tertiary activity summaries appear between/around prose
→ abnormal end / Stop-disappearance / connection recovery / load recovery / pagehide snapshot
→ exact task response boundary is established
→ collect ordinary assistant prose + visible tertiary work steps
→ sort in DOM order
→ de-duplicate and bound
→ persist as abnormal carry / durable handoff snapshot
→ clear old dispatch identity
→ fresh Work or Review conversation
→ prompt contains current instruction + prior completed Work result (when applicable) + interrupted combined work trace + original goal
→ replacement model continues actual work from the interruption point.

## 8. Architecture / ownership

No new subsystem.

- `conversationRoleNodes('assistant')`: remains canonical message/finality input and continues to exclude tertiary activity.
- `visibleAssistantWorkTranscript()`: abnormal-handoff-only extractor; extended to merge safe visible activity summaries.
- `assistantTurnContent()`: unchanged for final reply semantics.
- `captureOwnedAbnormalFreshCarry()` and `persistHandoffReplySnapshot()`: continue to own persistence.
- `workPrompt()` / `plannerPrompt()`: continue to own prompt assembly.

## 9. Implementation strategy

1. Introduce an activity selector for `assistant-message + tertiary`.
2. Factor the current task/route boundary resolution used by `visibleAssistantWorkTranscript()` so ordinary assistant and activity extraction share the same ownership decision.
3. Identify the current response turn when available from the latest canonical assistant/activity node and its `data-content-search-turn-key`.
4. Build trace entries for:
   - canonical assistant message units using `assistantTurnContent()`;
   - visible tertiary activity nodes using normalized visible text.
5. Reject tertiary nodes contained by an already-captured canonical assistant message unit to prevent duplicate legacy content.
6. Sort entries by DOM order, de-duplicate exact repeated text, strip interruption boilerplate, and apply `boundedConversationLengthCarry()`.
7. Update prompt wording to say “实时工作记录（可见回复 + 工作步骤）”.
8. Add focused regressions matching the live fallback-turn renderer.
9. Bump to v2.10.10.

## 10. Verification strategy

Focused tests must prove:

1. A fallback content-search turn with primary prose → tertiary steps → primary prose → tertiary steps produces one combined carry in the same order.
2. The combined carry includes short waiting/polling activity lines.
3. Tertiary activity is absent from `latestTurn(task).text` and cannot make a turn final.
4. If the same tertiary text is nested inside an already captured legacy assistant message, it is not duplicated.
5. When marker is virtualized but exact route is uniquely owned, current-turn activities are still captured.
6. A foreign task marker/route owner blocks fallback activity capture.
7. A prior content-search turn's activities are not included when the current response turn is identifiable.
8. `workPrompt()` contains current instruction, previous completed Work result when applicable, combined interrupted work trace, then original goal.
9. `plannerPrompt()` includes combined interrupted work trace while preserving current `taskId`/`round` contract.
10. Existing v2.10.9/v2.10.8 focused regressions and full suite remain green.
11. Userscript syntax check passes.

## 11. Acceptance criteria

- AC-1: The live class of tertiary work-step lines shown in the user's screenshot can be captured.
- AC-2: Abnormal fresh-session prompt includes both ordinary assistant prose and those work steps, in visible order.
- AC-3: The new session receives enough execution context to know what has already been inspected/built/waited/tested instead of only the latest prose response.
- AC-4: Final reply recognition and review parsing do not consume tertiary activity as final content.
- AC-5: Task/route isolation remains fail-closed.
- AC-6: Pagehide/reload durable carry preserves the richer trace.
- AC-7: Exact-head CI, canonical-main CI, Release and asset verification succeed for v2.10.10.

## 12. Release / rollback

No migration. New behavior reuses the existing bounded string fields `abnormalFreshCarry` and `handoffReplySnapshot`.

Rollback target is v2.10.9. Rolling back only removes tertiary activity from abnormal carry; persisted strings remain compatible.

## 13. Observability / evidence

Record:

- live DOM selector/turn evidence;
- exact PR head;
- exact-head Test run;
- merge SHA;
- canonical-main Test run;
- Release run;
- v2.10.10 release target;
- release asset size and SHA-256;
- main metadata/runtime readback.

Do not log or persist extra raw tool payloads; only the already-visible bounded work trace is carried.

## 14. Compliance record

| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R23 / AC-1-AC-6 | pending implementation | Live Mac DOM inspection reproduced the missing tertiary-work-step class and confirmed v2.10.9 excludes it from canonical assistant roles. |
| R24 / AC-7 | pending delivery | Requires exact-head Test, merge, canonical-main Test, Release and asset verification. |
