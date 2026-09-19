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

- Exact-head standard CI: run `35411328349` on `6e9729f32ec8933957e5c1e2b6ea00c73c9c9027` — SUCCESS.
- Merge/release source SHA: `84d0d8e7c6703ad399e3f0da0639942f41c8f738`; post-merge main Test run `35411367398` — SUCCESS.
- Release `v2.9.41`: published, latest, non-draft, non-prerelease, target `84d0d8e7c6703ad399e3f0da0639942f41c8f738`.
- Release asset: `chatgpt-auto-confirm.user.js`, 248490 bytes, `sha256:681d50730566bd5f302f3c8b4e5d0ca1e4317951d7c018db565ccb8abf559218`.
