# Connection interruption fresh-chat handoff — v2.10.25

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-02

## 1. Policy

A visible ChatGPT product notice matching `Connection interrupted. Waiting for the complete answer` or `连接已中断，正在等待完整回复` is an abnormal termination signal for the current Fabushi dispatch.

It MUST NOT enter the old dedicated same-conversation five-minute recovery loop. It MUST transition to a fresh-conversation recovery handoff after the authorization safety gate.

## 2. Detection boundary

The interruption notice is actionable only when all existing task-bound guards still pass:

- the live route belongs to the current task;
- the task is not in an ambiguous unbound Send;
- no active approval settlement is in progress;
- no blocking page challenge is present;
- no rate-limit state is active;
- the notice is recognized either inside the current owned assistant response or as page chrome, never from quoted task/user text.

## 3. Authorization safety gate

Because fresh-chat handoff is destructive to the current conversation binding, interruption recovery keeps the existing two-scan authorization invariant:

1. Perform a wide live authorization-card scan.
2. If any card is present, remain in the current conversation and process authorization normally.
3. If no card is present, persist a task/phase/round/token/document-bound confirmation signature.
4. Wait at least eight seconds.
5. Perform a second wide live authorization-card scan.
6. If a card appeared, cancel handoff and remain in the current conversation.
7. Only if the second scan is also empty may the interruption handoff proceed.

Disabled/remounting authorization surfaces still count as presence according to the existing card detector. The interruption policy must never bypass approval settlement.

## 4. Fresh handoff

After the safety gate:

- preserve the current conversation URL in history;
- capture the latest safely attributable assistant/work transcript, including visible work/activity segments;
- remove the interruption banner text from the carry;
- persist a handoff snapshot when available;
- clear the old dispatch URL/token/attempt state;
- mark `connectionInterruptedFreshDispatch = true`;
- queue the same phase and same round in a fresh ChatGPT conversation;
- preserve goal, `next`, previous Work result, attachments, reasoning preset, and task identity;
- bypass the ordinary inter-dispatch cooldown for this one recovery send;
- never type or send `继续完成所有` in the broken conversation.

The new Work/Review prompt must include the abnormal conversation's visible work as already-completed context so execution resumes from the interruption point instead of restarting blindly.

## 5. Stop semantics

A visible Stop control does not override the product-level interruption notice. Once the interruption notice is confirmed and the authorization safety gate passes, the old conversation is abandoned even if Stop remains visible.

The script does not click Stop as part of this policy.

## 6. Legacy state migration

Older versions may have persisted `pendingContinuationReason`, `pendingContinuationURL`, `pendingContinuationSince`, or probe/refresh fields from the former five-minute interruption loop.

Those records must not resume the old policy. On the next eligible inspection they are upgraded to the same authorization-safe abnormal fresh-chat handoff. Legacy probe deadlines must not defer scheduling.

## 7. Unchanged recovery policies

This change is specific to the explicit connection-interrupted product state. The following remain unchanged:

- generic no-visible-progress stall: five-minute same-route refresh, then bounded fresh handoff according to the existing generic stall policy;
- conversation load failure: 30-second retry cadence, up to seven same-route refreshes before fresh handoff;
- rate-limit cooldown/escalation;
- authorization settlement latch and approval selection;
- Review settlement/final recognition;
- conversation-length handoff;
- ambiguous Send confirmation;
- attachment persistence and resend rules.

## 8. Recent activity

The v2.10.24 rolling two-hour activity log remains active. Interruption recovery should record:

- first abnormal-interruption detection / authorization confirmation start;
- any authorization card that blocks the handoff;
- the final fresh-handoff transition;
- preserved assistant/work snapshot when available.

The UI may show the short authorization-safety countdown, but must not show a five-minute interruption refresh countdown.

## 9. Regression requirements

Exact-HEAD CI must prove at least:

1. English and Chinese interruption notices remain recognized.
2. First detection starts the eight-second no-approval confirmation and does not send in the old conversation.
3. After confirmation, interruption with Stop still visible clears the old binding and queues a fresh chat.
4. Interruption without Stop also queues a fresh chat.
5. Visible work before the interruption is carried to the fresh prompt and the interruption banner itself is excluded.
6. A card appearing during the confirmation cancels handoff and leaves the task in approval state.
7. Legacy interruption state is upgraded to fresh handoff rather than same-route refresh.
8. Virtualized task-response shapes still fail closed on foreign ownership while preserving the exact task route until the handoff is authorized.
9. Generic five-minute stall recovery remains unchanged.
10. No runtime code path retains the obsolete dedicated same-route interruption supervisor/probe.

## 10. Acceptance

Only GitHub Actions or htch-runtime results bound to the exact PR/main HEAD count as verification. No local test/build result is authoritative.
