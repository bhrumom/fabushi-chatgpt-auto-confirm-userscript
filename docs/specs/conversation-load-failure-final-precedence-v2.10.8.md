# Explicit conversation-load failure recovery and final-reply precedence — v2.10.8

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-09-29
Related live report: a bound ChatGPT conversation remained on “无法加载此 ChatGPT 对话” after the existing renderer-recovery budget was exhausted, and completed replies could still be bypassed by the historical Stop-disappearance fresh-chat rule.

## 1. Context / problem

Two live failures were reproduced by inspecting the user's authenticated ChatGPT renderer on the Mac device.

### 1.1 Explicit conversation-load failure can stall forever

The affected bound route visibly renders:

- “无法加载此 ChatGPT 对话”
- a visible “重试” button
- “正在加载聊天”

while the actual ChatGPT composer and conversation message units are absent. The only textarea present on that page belongs to the Fabushi workbench and is hidden.

The current runtime does not classify this as a dedicated route failure. It falls into the inherited-Stop / shell-hydration path. That path waits 30 seconds, delegates to the generic same-route renderer recovery, and that generic recovery is capped at two loads. Once `rendererRecoveryExhausted` is set, the script remains bound to the broken route and keeps supervising it without another transition.

This behavior is appropriate for an ambiguous blank renderer, but not for an explicit ChatGPT conversation-load error.

### 1.2 A real completed reply can lose to the historical Stop-disappearance rule

A current completed ChatGPT conversation was inspected directly. The current renderer exposes:

- the user turn through `data-content-search-unit-key="...:user"` / `data-chatgpt-search-unit-key="...:user"`;
- the assistant turn through `data-content-search-unit-key="...:assistant"` / `data-chatgpt-search-unit-key="...:assistant"`;
- response-local buttons whose accessible names are `复制`, `评价回复`, `分享`, and `朗读`;
- no Stop button and no “处理中” state;
- a visible contenteditable composer inside the ChatGPT form.

The existing `latestTurn()` semantic action recognizer already accepts the current plain `复制` label and correctly binds it to the latest assistant lane. However, `inspect()` evaluates the v2.9.97 Stop-observed → Stop-absent fresh-session handoff before normal final classification. Therefore, when the same dispatch previously observed Stop, a genuine latest-owned final reply can be handed off instead of completed.

## 2. Goals

1. Treat the explicit ChatGPT conversation-load error as a dedicated recoverable state.
2. In that state, refresh the same bound conversation at 30-second intervals, at most seven times.
3. If the explicit load failure still exists after the seventh same-route refresh, abandon only that failed dispatch identity and continue the same task in a fresh ChatGPT conversation using the existing task/carry mechanism.
4. Never duplicate-send into the broken old conversation.
5. Make strong latest-owned final UI evidence take precedence over the historical Stop-disappearance fresh-chat handoff.
6. Preserve existing route ownership, approval, rate-limit, blocker, attachment, task phase/round, and carry safety boundaries.
7. Keep the generic 15-minute no-progress policy and the generic blank-renderer recovery policy unchanged for states that are not the explicit load-error page.

## 3. Non-goals

- Do not click the page's Retry button as the recovery mechanism; recovery remains a deterministic same-route reload.
- Do not shorten the generic 15-minute stall watchdog.
- Do not turn an arbitrary blank route into a fresh-chat trigger.
- Do not accept an older response toolbar as final.
- Do not treat Copy from a user turn, sidebar, workbench, or foreign response as final.
- Do not infer finality from text alone when strong task ownership is absent.
- Do not reset or drop attachments, phase, round, goal, next instruction, or safe abnormal carry during the fresh-session transition.

## 4. Requirements

### 4.1 Explicit load-failure detection

- R1: Detect a visible current-page notice matching the ChatGPT conversation-load failure, including Chinese “无法加载此 ChatGPT 对话” and equivalent English “Unable to load … conversation/chat” wording.
- R2: The notice is actionable only on the exact task conversation route and only when no visible conversation transcript is mounted.
- R3: A matching visible Retry control is corroborating evidence; historical quoted text, task logs, the Fabushi panel, hidden DOM, or user/assistant transcript text must not satisfy the detector.
- R4: Approval, rate-limit, hard blocker, paused/cancelled state, or an ambiguous send continues to win over load-failure recovery.

### 4.2 30-second × 7 recovery contract

- R5: The first explicit load-failure observation starts a 30-second wait; it does not reload immediately.
- R6: If the same explicit failure remains after the deadline, reload the exact same conversation and increment a persisted attempt counter.
- R7: Repeat at most once per 30 seconds.
- R8: Perform no more than seven same-route refresh attempts for the same task conversation generation.
- R9: A successful mounted conversation transcript clears the explicit-load-failure counter.
- R10: A document reload alone does not reset the explicit-load-failure counter.
- R11: After seven refresh attempts, if the explicit failure is still present, queue the existing safe fresh-session handoff immediately.
- R12: The fresh handoff must preserve the task, phase, round, goal/next, attachments, and any safely captured current work; it must clear the failed conversation dispatch identity so the next send creates a new durable conversation.
- R13: The old failed page must never receive another Send click as part of this recovery.

### 4.3 Final-reply precedence

- R14: A latest task-owned assistant reply with response-local Copy, no Stop, and no active streaming state is strong final UI evidence.
- R15: When a dispatch previously observed Stop and now satisfies R14, do not queue the Stop-disappearance fresh-session handoff.
- R16: Let the existing final stability window and normal `finish()` path complete that reply.
- R17: If Stop disappears without strong latest-owned final evidence, the existing fresh-session handoff behavior remains available.
- R18: Route-only/virtualized ownership is not enough to use this final-precedence exception.

### 4.4 Compatibility

- R19: Existing current content-search-unit renderer support remains valid.
- R20: Existing legacy response structures remain supported.
- R21: Generic `ROUTE_HYDRATION_TIMEOUT_MS` / `ROUTE_RECOVERY_LIMIT` behavior remains unchanged for blank/shell-only hydration failures.
- R22: Generic `STALLED_REFRESH_MS` remains 15 minutes.
- R23: Existing rate-limit, authorization, connection-interruption, conversation-length, transient-local-route, and attachment regressions remain green.
- R24: Publish as v2.10.8 only after exact-head Test succeeds, the change is merged, canonical-main Test succeeds, Release succeeds, and the release asset is readable.

## 5. Current state

The generic renderer-recovery path has:

- `ROUTE_HYDRATION_TIMEOUT_MS = 30000`
- `ROUTE_RECOVERY_LIMIT = 2`

After two unsuccessful same-route renderer recoveries it sets `rendererRecoveryExhausted` and intentionally stops refreshing.

The generic no-progress path remains:

- `STALLED_REFRESH_MS = 15 * 60 * 1000`
- two same-route refreshes;
- the third 15-minute unchanged window queues a fresh-session carry.

The current final detector already supports semantic Copy labels, including plain Chinese `复制`. The ordering bug is in `inspect()`: the Stop-disappearance fresh-handoff branch runs before final classification.

## 6. Target architecture

No new subsystem is introduced.

- `conversationLoadFailure()` owns narrow recognition of the explicit ChatGPT load-error surface.
- `recoverConversationLoadFailure()` owns the persisted 30-second × 7 state machine and delegates to the existing `queueInterruptedFreshRetry()` after exhaustion.
- `inspect()` gives that explicit failure state an early, bounded recovery branch before inherited shell-hydration recovery.
- `latestTurn()` remains the owner of response-local final UI evidence.
- `classify()` remains the owner of final stability.
- Stop-disappearance recovery remains in `inspect()`, but only when no strong latest-owned final reply is present.

## 7. Persisted state

Add task-scoped fields:

- `conversationLoadFailureURL`
- `conversationLoadFailureAttempts`
- `conversationLoadFailureAt`

They are bound to the current canonical conversation URL. They are cleared when:

- a visible conversation transcript mounts;
- a new dispatch identity is prepared/cleared;
- the task moves to a fresh conversation;
- the current URL no longer matches the failed route.

No transcript contents are persisted by these fields.

## 8. Failure modes and edge cases

- Error notice disappears and real messages mount: clear the fast-recovery state and continue normal supervision.
- Error notice disappears temporarily into a loading shell after reload: preserve the attempt count; do not treat reload alone as success.
- A quoted “无法加载此 ChatGPT 对话” appears inside a user/assistant message: reject it.
- A stale or hidden Retry button exists elsewhere: reject it.
- A real final reply appears during a pending navigation/recovery decision: final evidence cancels the fresh handoff.
- Copy belongs to an older response: existing lane association rejects it.
- Stop remains visible: never finish from Copy.
- Strong final reply appears after inherited Stop from an older document: completion uses the normal final stability gate.
- Seven failed reloads with no safely extractable assistant work: create a fresh session with the same task context, but do not fabricate carry text.

## 9. Implementation strategy

1. Add narrow explicit-load-error constants, detector, reset helper, and recovery state machine.
2. Insert explicit-load-error handling before inherited-Stop shell hydration in `inspect()`.
3. Reset the dedicated state only after real transcript recovery or dispatch reset.
4. Change Stop-disappearance precedence so `turn.owned && turn.final && turn.text` suppresses that fresh handoff and flows into ordinary final classification.
5. Add current-renderer regression fixtures using content-search user/assistant units and plain `aria-label="复制"`.
6. Add explicit load-error regressions for 30-second cadence, persisted reload count, seven-attempt exhaustion, transcript recovery reset, and no old-chat Send.
7. Bump userscript metadata/runtime/README/tests to v2.10.8.

## 10. Verification strategy

Focused regressions must prove:

1. Explicit “无法加载此 ChatGPT 对话” starts a wait and does not refresh before 30 seconds.
2. Each 30-second deadline performs exactly one same-route reload.
3. Reload count survives a reconstructed document/task state.
4. Attempts 1–7 remain on the exact old route and never click Send.
5. The still-failing page after attempt 7 queues a fresh session.
6. Mounted conversation messages reset the explicit failure state.
7. The generic shell-only renderer still uses the existing two-recovery budget.
8. The generic 15-minute stall constants/behavior are unchanged.
9. A live-shape content-search assistant reply with plain `复制` is final.
10. Stop observed → Stop absent + strong latest-owned Copy does not queue a new chat and completes after the existing 4-second stability window.
11. Stop observed → Stop absent without strong final evidence still queues a fresh handoff.
12. Old/foreign Copy controls cannot satisfy finality.
13. Full `npm test` and userscript syntax check pass in GitHub Actions.

## 11. Acceptance criteria / Definition of Done

- AC-1: The live screenshot state can no longer settle into permanent `rendererRecoveryExhausted` waiting.
- AC-2: The explicit load-error route refreshes every 30 seconds, up to seven times.
- AC-3: A still-broken route after the seventh refresh moves the same task to a fresh session with no duplicate old-chat send.
- AC-4: A current completed ChatGPT reply using content-search units and plain `复制` is recognized as final.
- AC-5: Strong latest-owned final evidence wins over the old Stop-disappearance handoff.
- AC-6: Non-final Stop disappearance and all safety guards retain their existing behavior.
- AC-7: Generic 15-minute stall and generic two-load renderer-recovery behavior remain unchanged outside the explicit error state.
- AC-8: Exact-head Test, canonical-main Test, Release, tag, and v2.10.8 asset readback all succeed.

## 12. Release / migration / rollback

No destructive migration is required. Newly introduced task fields are optional and default to zero/empty. Older persisted tasks gain the new behavior when the explicit error is next observed.

Rollback target is v2.10.7. Rolling back may re-expose the permanent explicit-load-error stall and the Stop/final precedence bug, but does not require state conversion.

## 13. Observability / evidence

Log only bounded state, never transcript text:

- first explicit load failure and the 30-second deadline;
- refresh attempt `N/7`;
- successful transcript recovery and counter clear;
- seven-attempt exhaustion and fresh-session transition;
- final-precedence path remains visible through the existing final/completion logs.

Delivery evidence must record the exact PR head, exact-head Test run, merge SHA, canonical-main Test run, Release run, tag, release asset size/digest, and a post-release Mac live revalidation when available.

## 14. References / provenance

- Direct Mac browser inspection on 2026-09-29 of the failing route showing “无法加载此 ChatGPT 对话” + Retry and no ChatGPT composer.
- Direct Mac browser inspection on 2026-09-29 of a completed current-renderer conversation showing content-search `:user`/`:assistant` units and response actions `复制`, `评价回复`, `分享`.
- `docs/specs/final-reply-structure-recognition-v2.10.3.md`
- `docs/specs/stop-disappeared-fresh-session-v2.9.97.md`
- `docs/specs/same-tab-stalled-route-recovery-v2.9.87.md`
- `docs/specs/three-stalled-windows-fresh-chat-carry-v2.9.92.md`

## 15. Supersession

This specification supersedes v2.9.97 only for the narrow case where the same exact dispatch now has strong latest-owned final UI evidence. v2.9.97 remains authoritative when Stop disappears without such final evidence.

The 30-second × 7 rule is specific to an explicit ChatGPT conversation-load failure. It does not replace the generic 15-minute no-progress policy or the generic blank-renderer two-load recovery policy.

## 16. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R23 / AC-1-AC-7 | implemented, pending CI verification | Userscript now has explicit load-error detection, a persisted 30-second × 7 same-route recovery state machine, transcript-based reset, fresh-session exhaustion handoff, and strong-owned-final precedence over Stop disappearance. Focused JSDOM regressions cover the live content-search renderer shape and recovery boundaries. |
| R24 / AC-8 | pending delivery | Requires exact-head Test, merge, canonical-main Test, Release, tag, asset readback, and live revalidation. |
