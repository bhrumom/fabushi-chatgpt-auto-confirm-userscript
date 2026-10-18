# Automatic reveal of collapsed authorization — v2.10.59

Status: active
Owner: standalone userscript authorization adapter
Date: 2026-10-18

## Context and live evidence
Conversation 6ad4acf9-ace4-83e8-a3e3-a2f7c6fa1a3c showed only Previous activity and Answer completed. The workbench continued scanning but stayed at approval. Manually expanding Previous activity exposed an actual pending Allow once card; the already-enabled auto-approval script then clicked it itself and the same conversation resumed with Stop and waiting/generating state. No goal was resent.

## Requirements and acceptance
- R1: When automatic approval is already enabled, reveal a detected current pending authorization card hidden by its own disclosure. Do not toggle any auto-approval setting.
- R2: Only open closed ancestor details or a visible enabled non-permission disclosure whose aria-controls explicitly owns the detected card. No label-only guessing, unrelated activity/menu/Allow/Reject clicks, historical user turns, paused/foreign/competing task ownership.
- R3: Revealing is separate from granting: return to the scheduler and re-scan the live DOM on the next pass before the existing primary Allow once/Allow handler runs. Respect abort, pause, route/owner changes, remounts, submission settlement and grant deduplication. Bound repeated disclosure attempts to once per control per 15 seconds.
- R4: Preserve task identity, phase, round, URL, send token, attempted state and attachments. Manual approval mode retains its Locate action and does not auto-open or grant.
- R5: A hidden card that has no provable owner must enter existing bounded unavailable-approval recovery instead of silently returning forever. No memory-only reload or broad browser repair for this healthy-page case.
- R6: Release 2.10.59 after exact PR and main CI, verify asset equals tested source, update the existing enabled script record and retain the running task. Host 0.7.2 remains compatible; host runtime does not own page disclosure semantics.

## Architecture and implementation
Refactor existing locate disclosure code into a shared card-reveal helper. authorize invokes it only for hidden controls under enabled automation, exact owned current route and current user boundary. The helper never approves or mutates task identity. Existing visible authorization path, manual locate action and task/global scanners remain owners. No new dependencies, permissions or persistence schema.

## Verification
Regression fixtures reproduce CSS-hidden mounted cards, disclosure remount, closed details, unrelated disclosure, old user boundary, manual modes, pause/abort/foreign owner, settlement, missing relationship and repeated scans. Existing full suite and generated parity remain required.

## Release and rollback
Publish immutable additive version through existing workflow or authenticated CLI after main Test. Import verified asset into same script record. Prior version remains available for rollback. Record test/CI/asset/installation separately from live recovery evidence.

## Compliance
R1-R5: passed in 14 focused regressions, including the ordinary inspect path, remount/fresh scan, closed details, manual/global modes, pause/abort/foreign/competing route, historical boundary, pacing and missing disclosure recovery. Task round/token/URL/phase/attachments remain unchanged. Full regression and exact-head CI remain delivery gates.
R6: blocked pending exact-head PR/main checks, publication and installed readback.
Live incident recovery: passed; expansion caused existing enabled automation to approve and resume the original conversation without manual Send.
