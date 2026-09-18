# CAR-003 evidence — strict final-completion boundary

## Incident

- User-provided live ChatGPT screenshots on 2026-09-18 show an active GitHub authorization card while the Fabushi task log reports a Stop-loss abnormal-end transition and starts a fresh-session resend.
- Root cause in source v2.9.38: `classify` could return `no-final-reply` solely because Stop had disappeared for 15 seconds; `latestTurn` also allowed renderer static markers to act as final evidence.

## Candidate

- Baseline: source main `d07fd543096662f7a02d45bfb09cd6aa7c28e6ed` (v2.9.38).
- Branch: `fix/strict-final-completion-2.9.39-20260918`.
- Target version: `2.9.39`.
- Source changes: toolbar-only final authority; remove bound Stop-loss/no-final transition; authorization transition fail-closed; preserve same-URL 3-minute stall refresh.
- Extra behavioral/E2E testing: not requested and not used as a publication gate.

## Delivery evidence

- PR: pending.
- Exact-head CI/status: pending.
- Protected merge: pending.
- Canonical main readback: pending.
- Release `v2.9.39`: pending.
- Release asset/provenance: pending.
