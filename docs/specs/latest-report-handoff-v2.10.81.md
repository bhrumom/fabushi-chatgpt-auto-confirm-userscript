# Latest final report settlement and fresh prompt — v2.10.81

Status: active
Owner: standalone userscript
Date: 2026-10-24

## Problem and goal
Live task 9a70a374 remained on round 79 across fresh conversations. Logs show finish recognized a final reply, then historical authorization policy sent another continuation instead of consuming its next. The next session repeated the old execution instruction; another ended session remained waiting. Consume the current valid report before historical no-card continuation or abnormal fresh dispatch, and generate the next prompt from its next and latest result.

## Requirements / acceptance
- R1: A valid exact task/round report settles through finish even if no historical authorization was seen or the three-send cap is exhausted. This supersedes v2.10.75's historical no-card requirement for valid final reports only. Pending cards and authorization settlement continue to block.
- R2: Before abnormal fresh dispatch, inspect the current latest assistant reply on the exact owned route, with no competing owner/marker, no active send/Stop/streaming/draft/blocker/rate limit. A valid report must stabilize for FINAL_REPLY_STABILITY_MS and settle instead of replaying the old prompt. A pending unacknowledged continuation boundary cannot consume its old report.
- R3: Pending historical continuation in inspect must not send over an already valid current final report. Invalid/mismatched/incomplete prose retains existing recovery policy.
- R4: next increments round once, clears prepared send/carry, stores latest report, and supplies report.next as next prompt's execution section; complete finishes. Goal revisions and attachments keep existing semantics. No cross-task report adoption.
- R5: Add DOM regressions for the live ended-report sequence with the authorization switch enabled, exhausted cap, actual pending card/settlement, fresh recovery, wrong identities, Stop/draft/unacknowledged boundaries and next-prompt contents. Run full parity/syntax/regression checks on exact-head Actions, merge and release v2.10.81. Record installation separately.

## Architecture and implementation
finish remains the sole settlement owner. Its historical gate is skipped only for parseable current reports; live cards and settlement are checked first. A small current-live-report guard at queueInterruptedFreshRetry reuses existing report validation, route ownership and continuation fences, waits four seconds on unchanged report identity, then calls finish. inspect uses the live-report guard before historical no-card continuation; conversations already qualified by authorization keep the existing observation/stability path. No new scheduler or stored report authority, no mutation of already sent messages. Runtime/config metadata and bundle remain identical.

## Failure modes / verification
Live current text only at the fresh boundary; snapshots and prompt templates are never settlement evidence. Any active guard cancels the boundary stabilization. A foreign report never advances. Goal revision races retain existing finish behavior. The next report's round makes repeated settlement invalid. CI-only verification; deterministic local bundle generation is permitted.

## Release / observability / rollback
PR, exact-head Test, main Test, automatic Release, asset readback and browser update. Logs identify a found final report and stability wait. Prior release is rollback reference; it retains this bug.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R5 | blocked | Implementation and exact-head CI pending. |
