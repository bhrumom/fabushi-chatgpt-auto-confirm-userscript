# Interruption preempts reload hydration — v2.10.21

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-01

## 1. Incident

v2.10.20 recognizes the current English interruption message and introduces a five-minute same-route refresh window. A real post-refresh path still bypasses that detector:

1. A bound conversation previously exposed Stop, so `stopObservedGenerationIdentity` is persisted.
2. The five-minute interruption recovery reloads the exact same conversation.
3. In the new document, ChatGPT visibly renders `Connection interrupted. Waiting for the complete answer`, but the current Stop/transcript ownership surface may not yet be recognized.
4. `inheritedStopObservation && !stopPresent && !inheritedStopAbsenceStable` enters the reload-hydration guard.
5. That guard returns before the later `connectionInterruptedNotice()` branch.
6. The workbench repeats `页面刷新后仍在恢复当前任务内容...` and the explicit interruption can wait indefinitely.

## 2. Required behavior

- An explicit connection-interrupted product notice on the exact bound route is actionable before inherited Stop/reload-hydration early-return logic.
- Approval, blocker and rate-limit states retain their existing precedence.
- On first explicit interruption observation, persist the same bound URL and a dedicated recovery start time.
- If the page has no visible progress for five minutes, refresh the same route without duplicating the task send.
- If the explicit interruption remains after reload, start/continue a new five-minute no-progress window instead of returning forever through reload hydration.
- Do not require the current document's Stop selector to succeed in order to recognize the explicit interruption.
- Do not treat quoted user/assistant text as the product notice; continue using `pageUiTextRecords()` transcript rejection plus the owned-turn path.
- Existing load-failure, final-reply, approval, rate-limit and fresh-handoff behavior remains unchanged.

## 3. Regression

- Reproduce a previous-document Stop observation.
- Render the same exact conversation with a visible English interruption notice and no currently recognized Stop.
- Assert that `inspect()` records interruption recovery instead of the inherited hydration wait.
- Assert original conversation URL/task identity remain intact.
- Assert five quiet minutes schedule a same-route refresh through the existing interruption refresh mechanism.

## 4. Delivery

- GitHub Actions `Test` must pass on exact PR head.
- Merge only after exact-head success.
- Canonical-main `Test` must pass on merge SHA.
- Release workflow must publish `v2.10.21` with `chatgpt-auto-confirm.user.js`.

## 5. Compliance record

| Requirement | Status | Evidence |
| --- | --- | --- |
| Runtime + regression | pending | Await exact-head GitHub Actions Test. |
| Merge/main/release | pending | Await delivery pipeline. |
