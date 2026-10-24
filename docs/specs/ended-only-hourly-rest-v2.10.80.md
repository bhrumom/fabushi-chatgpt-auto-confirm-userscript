# Hourly rest only at an ended, card-free fresh-session boundary — v2.10.80

Status: active
Date: 2026-10-24
Owner: standalone userscript runner
Supersedes: v2.10.78 two-minute live-step detection; v2.10.79 preserves response ownership only.

## Problem / goal
The user reports premature rest while a conversation is still executing, including a page waiting for a GitHub authorization card. Work steps without a reply do not prove the session ended. Sleep only when existing recovery has concluded the conversation must move to a new session, with no live authorization and no reply body.

## Requirements / acceptance
- R1: Remove the live two-minute trigger and its early-return suppression of normal inspection. Running Stop/streaming, tool execution and pending approval stay on normal supervision and authorization paths.
- R2: Start the hour only within queueInterruptedFreshRetry after existing new-session/authorization gates pass, with task-owned steps-only evidence, no Stop/streaming, no pending/settling approval, no draft/blocker/rate limit and an idle composer. Preserve existing no-card continuation settings; no hourly-policy bypass.
- R3: Keep a fixed durable hour, repeat without cap for subsequent ended steps-only sessions, and retain task/round/goal/attachments/current trace. Recheck actual page state before expiry handoff. A real reply, resumed generation or live approval cancels rest so normal supervision resumes; passive checks never send/navigate/refresh during rest.
- R4: Old v2.10.78/79 rest deadlines must be ignored and cleared without user action. Add a policy identity to distinguish a valid ended-only rest. Old state must not defer scheduler, navigation, send, inspection or memory recovery.
- R5: Preserve response ownership/virtualization guards. Pending cards and drafts do not become new-session authority. Version/source/bundle parity, full exact-head Actions, main tests and release provenance are required. Record actual installation separately from a real hour-long acceptance cycle.

## Architecture / contract
stepsOnlyResponse classifies content only. queueInterruptedFreshRetry owns the fresh-session boundary and calls handleStepsOnlyRest only after requireConversationAuthorization. No independent timer or second scheduler. Persist stepsOnlyRestPolicy='ended-no-approval-v1', stepsOnlyRestUntil, boundary and start time; stepsOnlyRestCheckAt is a passive current-page check deadline. taskDeferredUntil uses the hour off-route and bounded passive checks on the resting route. Legacy unqualified fields never authorize delay. On expiry normal inspection must reconfirm the existing fresh-session transition before the same handler permits handoff.

## Verification / failure modes
DOM/fake-clock regressions: more than two minutes of active steps never rest; pending/disabled cards never rest even without Stop; idle alone without a fresh transition never rest; existing stop-absence safety window precedes rest; historical card-continuation setting is honored; durable hour and repeated sessions; late grant/Stop/body cancels sleep; old-policy migration; isolation, drafts and virtualized ownership; no navigation/send/refresh during rest. CI only, deterministic local bundle concatenation permitted.

## Delivery / rollback / observability
Normal PR → exact-head Test → merge → main Test → Release, then browser version readback. Logs state the session ended and has no card/body. Previous version is reference only: rollback reintroduces the premature-sleep bug. Post-release compliance evidence is recorded in the PR description. Live hour-long expiry remains unverified unless actually observed.

## Compliance at authoring
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R5 | blocked | Implementation / CI pending; final review will be recorded in the PR description. |
