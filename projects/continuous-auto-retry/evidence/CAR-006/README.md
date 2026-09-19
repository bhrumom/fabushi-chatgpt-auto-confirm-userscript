# CAR-006 evidence — recovery escalation and loading boundary

## Baseline

- Canonical main before change: `d06d83fae890c527237a1f229f0d019d9e621337`
- Released userscript: `v2.9.40`
- User-visible failures: connection interruption could refresh indefinitely/too long; repeated rate-limit cooldowns never escalated to a new conversation; a stale loading spinner could mask an owned conversation whose Stop control had already disappeared.

## Candidate

- Branch: `fix/recovery-escalation-2.9.41-20260919`
- PR: #36
- Target version: `2.9.41`
- Connection interruption: consecutive three-refresh budget, then same-chat `继续完成所有`.
- Rate limit: fourth distinct cooldown episode queues fresh-session resend while preserving goal/phase/round/attachments.
- Loading boundary: owned bound route only treats loading as active generation when Stop is present; no Stop/card/final + usable composer is an abnormal-stop candidate and continues in-chat after 15 seconds.
- Existing message-error same-chat continuation and final-toolbar completion authority remain intact.

## Delivery evidence

- Exact-head standard CI: pending.
- Merge/canonical main: pending.
- Release v2.9.41: pending.
- Release asset digest: pending.
