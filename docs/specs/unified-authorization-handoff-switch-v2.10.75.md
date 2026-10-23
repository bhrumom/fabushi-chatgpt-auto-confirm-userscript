# Unified authorization handoff switch — v2.10.75

Status: completed
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
| R1-R5 / AC1-AC5 | passed | PR #194 head 45497a74, Test 39888486787; main source e93ec243, Test 39888786113: parity/syntax and 590 tests (583 pass, 0 fail, 7 skip). Release 39888967452 successful, asset 667716196, SHA256 07873c3ccc6f78aaccaf2f724ac94d7758a68dc34418eb9aedf68bd0bffbc776. Installed enabled 2.10.75; live evidence below. |

## Installed and live acceptance
Native Fabushi installed card confirms enabled 2.10.75. Both existing task workspaces were reloaded in place with empty composers and no pending authorization control. Both show the new unified help, 已关闭 and explicit enable=0/disable=1, with 正在生成. The first remains on /c/6adac352-c870-83e8-88b1-93614425d2cb.

The second task (3dd43a37-9f36-4b7a-adac-dfcc87584523) exposed an actual connection-interruption notice after loading the new runtime on /c/6adac435-3e0c-83e8-b175-5013a24675d1. Native workbench logs show: 10:21:05 Asia/Shanghai connection interruption and switch-aware confirmation; 10:21:17 direct abnormal fresh handoff with carried work; 10:21:27 Work send confirmed, round 17; 10:21:34 generating on /c/6adac4a9-04c0-83e8-b0a4-52ffa35c059b. No old-chat no-card continuation appears in this recovery sequence. New assistant work and Stop were observed. No network failure was injected, and no manual Send/Retry/permission click was used.

Deterministic regressions verify OFF structural/explicit/legacy recovery, persisted pending reason after snapshot recovery, current-card precedence, OFF cancellation without deleting counters/fences, ON three-send cap, and both-mode aged-fence/legacy alias/inherited Stop recovery. First cloud run exposed old exception-dependent assertions and the OFF inherited-hydration gap; both were reconciled before final green PR/main runs. No local test/build ran.
