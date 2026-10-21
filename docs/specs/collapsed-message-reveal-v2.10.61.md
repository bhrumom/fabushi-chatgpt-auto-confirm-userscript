# Collapsed current message reveal — Specification
Status: active
Owner: standalone userscript conversation adapter
Last updated: 2026-10-21

## Context / goal
At main e87c6f5f345087b44796af61da60ca5356ae9ba1 (2.10.60), the original Chrome conversation 6ad8507f-bdc8-83e8-91ce-8fc4b2843734 stays waiting with a truncated latest user bubble and 显示更多. Expanding it manually exposes more message text. A task marker at the end of a lazily rendered message cannot be read until expanded. The existing authorization disclosure helper requires an already-mounted card and does not own message truncation.

## Requirements / acceptance criteria
- R1 / AC1: Automatically open the current message's exact 显示更多 / 展开更多 / 阅读更多 / Show more / Read more / See more control, including Traditional Chinese, before send confirmation or response classification. Latest user expansion may precede marker recovery only on an already-bound exact task route. Then re-read on a fresh scheduler pass. Expansion itself never establishes ownership, completion or successful send.
- R2 / AC2: Only the latest user and the latest assistant following it qualify. No earlier user when an own marker contradicts the latest boundary, competing task/marker, foreign route, paused/cancelled/terminal task, stopped runner, abort, navigation, pending host memory operation or approval settlement. Never click menu More, collapse, links, quoted/code controls, composer, sidebar or grant controls.
- R3 / AC3: One control per inspection; pace a stable route/message/control identity at 15 seconds, including remounts, cap at three attempts, bound bookkeeping, then let ordinary recovery proceed. Clear stale observations when a control is activated. Preserve task ID, phase, round, token, URL, attempted and attachment state; no Send, new tab or reload is part of reveal.
- R4 / AC4: Add positive and adversarial DOM regressions, full exact-head GitHub Actions tests, generated-source parity, PR/main verification, release asset equality, and update the existing enabled installed record where UI access allows. Record live evidence separately.

## Architecture / data flow
Conversation adapter owns a bounded transient disclosure-attempt map and semantic current-message scope selection. The runner calls it before ambiguous-send confirmation, and inspect calls it after exact-route navigation but before snapshots/classification. Activate only a local non-menu button with an exact one-way expansion label; no broad text match. Return to the existing scheduler after a click, so React remounts and the next read uses fresh nodes. Existing ownership, approval and abnormal recovery remain authoritative. No dependency, permission or persistence changes.

## Failure modes / constraints
Missing marker may be caused by truncation: allow only harmless latest-user expansion on a uniquely bound route, never final attribution. A remounted unresponsive button cannot cause an endless wait. Shared fallback turn containers require message-order filtering; sibling assistant disclosures cannot be opened as a user disclosure. A real completed assistant still uses ordinary final evidence after reveal. UI activity/thinking disclosures are outside this change unless they use the explicit message expansion labels; existing authorization reveal remains separate.

## Implementation / verification
Add helper, integrate both read paths, bump to 2.10.61 and regenerate concatenated source. Test lazy tail marker, assistant lazy report, remount/pacing, preserved identity, paused/foreign/competing/settlement states, old turns, shared turn DOM and misleading menus/quotes. Run full suite via GitHub Actions; verify PR and main exact SHA and immutable published bytes.

## Release / rollback / evidence
Publish additive 2.10.61 through existing tested-main release workflow. Update same installed userscript ID; preserve existing workspaces. Roll back with 2.10.60 asset if needed. Live screenshot and native AX prove the incident and manual reveal only, not automatic operation of the new version.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R3 / AC1-AC3 | blocked | Implementation and CI pending. |
| R4 / AC4 | blocked | CI, release, installed readback and live verification pending. |
