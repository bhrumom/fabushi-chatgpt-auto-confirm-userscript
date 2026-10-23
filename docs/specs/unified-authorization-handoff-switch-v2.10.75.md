# Unified authorization handoff switch — v2.10.75

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-23
Supersedes: connection-interruption-continuation-v2.10.69.md exception when the switch is off

## Requirements / acceptance
- R1/AC1: OFF disables all historical-authorization-driven continuation, including explicit/structural/legacy connection interruption. After existing expansion, quiet-window and current-card checks, follow the ordinary fresh handoff. No new same-chat continuation send merely because a connection-interruption intent exists.
- R2/AC2: ON retains exact connection prompt, three-send cap, route ownership and persisted boundary deduplication. OFF must take effect for already pending connection continuation and after reload; do not erase counters/click fences or replay ambiguous sends.
- R3/AC3: Current authorization cards and settlement still block handoff regardless of switch; ordinary active generation is preserved. Switch changes affect historical-card policy only, not authorization grants or automatic-approval permissions.
- R4/AC4: Visible help and new diagnostic logs explain the same ON/OFF behavior. Remove the obsolete off-state connection exception. Preserve workspace-scoped settings and active-task composer cleanup.
- R5/AC5: Actions-only source parity/syntax/full regressions; exact-head release and digest; installed runtime and live OFF readback/task progression. Do not manufacture a current-task network failure for acceptance.

## Implementation plan
Make shared continuation eligibility depend only on the workspace switch. Record the connection-specific prompt intent only while enabled. OFF control clears pending requirement/reason intent in its own workspace while retaining send counters and boundaries. Update both confirmation messages and UI help. Update old connection tests to express the new explicit user override; regress disabled resumed intent and card precedence.

## Persisted-fence reconciliation
Cloud regressions exposed that OFF can clear the pending policy flag before a legacy inherited-Stop timer is initialized. An expired same-boundary send fence must remain evidence independently of that policy flag. During the existing eight-second quiet confirmation, an old final-looking reply on that exact expired boundary must not be parsed as a new final report. Retain original round/carry and deduplication; use direct structural handoff under OFF, acknowledgment-timeout handoff under ON. Test both modes against old blank/error responses, initial-user rollback and legacy aliases/inherited Stop.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R5 / AC1-AC5 | pending | Cloud/release/installed acceptance pending. |
