# Bounded authorization recovery — v2.10.56 (v2.10.55 follow-up)

Status: active
Owner: standalone userscript runtime
Updated: 2026-10-17
Provenance: user conversation 6ad2b544-0c64-83e8-bad0-454023150fef (continue all work); PRs #171 and #172; observed main 68d75ff; PR head 9f9ba447.

## Context, goal and current state
The supplied Chrome screenshots show authorization waiting, a completed reply that did not advance Work, and a message transport timeout. PR #171 persisted grant identity and bounded refreshes. PR #172 permits recovery for attempted Work sends. The latter has passed Actions but is unmerged. No durable v2.10.55 spec was present. This spec repairs that gap before further implementation. A remounted Allow button also needs protection during the settlement window.

## Scope and non-goals
Finish v2.10.56 recovery, regression verification and delivery. Preserve existing final report recognition and report-repair carry from v2.10.54. Do not grant permanent authorization, replay ambiguous sends, navigate to a new conversation for authorization recovery, or alter unrelated product repositories. This specific bounded grant-recovery policy supersedes the older CAR-R1 automatic fresh retry policy only for exhausted authorization recovery.

## Delivery correction from installation facts
On 2026-10-17 the existing Chrome Fabushi Marketplace visibly reported installed 2.10.55 and current stable-source parity. This is a read-only installation observation, not local acceptance. Since raw main has already distributed that version, publish this follow-up as 2.10.56 so version-based update checks cannot skip changed bytes. Keep the historical spec filename for provenance.

## Requirements and target state
- AR-R1: A current-action Allow click persists route, token, phase and round with submission time before subsequent scans can approve that identity again. Recreated DOM nodes must not bypass this protection, during or after the 12-second settlement window.
- AR-R2: While settlement is active, retain the bound conversation and suppress recovery. After settlement, a persistent card enters an identity-bound recovery episode. Refreshes require at least 60 seconds between attempts.
- AR-R3: An attempted send can refresh only if persisted submission route/token/phase/round matches the current task and route. Missing or mismatched identity must not refresh. Pause, cancel, blocked and autoApprove=false suppress refresh.
- AR-R4: Permit at most three same-route refreshes. The next due attempt blocks with actionable manual-recovery guidance, retaining URL/token/attempted/goal/phase/round and attachment metadata. Subsequent scans cannot restart that episode automatically.
- AR-R5: Card removal after settlement clears the submission/recovery episode. Disabled cards are not successful grants. Existing final report completion, next-round handoff and malformed report carry remain covered by regression.
- AR-R6: Source fragments and generated bundle match; exact PR HEAD and canonical main pass Actions build:check, syntax and full regression. All executable checks run only in Actions or htch-runtime; no local generation/test/acceptance.
- AR-R7: Publish the exact tested main bundle as v2.10.56, preserve existing releases, verify tag/source/asset digest and stable update URL. Do not store a workstation OAuth credential as a repository secret. A credentialed GitHub CLI release operation is an allowed delivery fallback after main CI passes; it is not evidence that automatic publishing is configured.
- AR-R8: Record installation and live final-reply/next-round recovery separately. Only an allowed runner with an authenticated browser may establish live acceptance; unavailable runtime/account is blocked.

## Architecture, contracts and implementation plan
Existing owners remain dom-and-turn-adapter (submission identity, bounded recovery), reply-and-approval (current-action grant), review-and-settlement (card/final classification), and Test/Release workflows (verification/delivery). Persisted task fields are additive; older tasks without submission fields cannot use the attempted-send exception. No new scheduler or transport. Read spec, strengthen task-identity guard in authorize, add remount/mismatch/exhaustion cases, edit the corresponding generated fragment, then use Actions to check exact equality and full regression.

## Failure modes and constraints
Different routes, tokens, phases or rounds fail closed. A remounted button must not generate another click for the retained submission identity. Reload failure retains identity and consumes a bounded attempt. Rate limits, blockers and genuine finals retain existing inspection precedence. Manual pause/cancel remains authoritative. Local Mac/Windows observation is read-only and cannot count as acceptance.

## Verification and acceptance
- AR-AC1: One click across button remount inside settlement and after settlement; same-route attempted recovery succeeds at the due time.
- AR-AC2: Missing and each mismatched identity, paused/cancelled/blocked state and disabled automation cannot refresh an attempted send.
- AR-AC3: Three refreshes then blocked; retained task fields/attachments are unchanged and no further refresh is possible.
- AR-AC4: Exact PR and main Actions checks succeed with commands, counts, exit status and run links recorded; full suite includes final-reply/report-repair handoff coverage.
- AR-AC5: v2.10.56 release asset/tag and stable update source are verified against tested source. Automatic release credentials are recorded independently if unavailable.
- AR-AC6: Installed runtime version and authenticated live same-conversation recovery, no duplicate dispatch, final reply and next-round handoff are observed on Actions/htch-runtime. Otherwise explicitly blocked.

## Release, migration, rollback and observability
Merge after exact-head checks; verify main CI; release immutable bundle. No destructive migration. Rollback through a reviewed revert and a higher version rather than replacing an existing release. Record source SHA, Actions commands/counts, release tag/digest and blocked configuration. Runtime logs identify same-route recovery count and exhaustion without credential values.

## Compliance record
AR-R1–R8 / AR-AC1–AC6: pending final evidence. PR #172 pre-extension head 9f9ba447 passed Actions 38985652277: 435 total, 428 passed, 7 skipped, 0 failed. That run does not accept the subsequent changes. htch-runtime is offline in current device discovery; live acceptance is blocked. Repository secret RELEASE_TOKEN is absent; automatic publishing is not configured.
