# Cross-tab pause and resume revisions

Status: active
Owner: canonical standalone userscript
Date: 2026-10-10

## Problem
A live Android task recognized its final Work reply and navigated to the queued review, but the restored page showed paused. Read-only Chrome storage inspection found an older paused Work phase while recent activity retained the later final/review transition. Source inspection identifies a deterministic cause: non-owning tabs retain a paused copy when its pauseRevision equals the newer active record and can persist that stale copy over canonical task state. Individual pause/resume transitions do not advance task pauseRevision.

## Requirements
- R1: A non-owning workspace must merge a newer persisted task even if its local copy is paused at an equal revision.
- R2: Individual pause and resume must advance the task transition revision. Newer pause remains authoritative; an older pause must never reverse a resumed task or later Work-to-review transition.
- R3: Preserve manual pause for other tasks and retain task identity, attachments, phase, round and result. Do not blindly resume historical paused workspaces.
- R4: Regress with a foreign stale paused copy and a newer review record, and both pause/resume revision directions. Run full tests in GitHub Actions; syntax locally only.

## Architecture
Keep workspace controlRevision for workspace-wide barriers. Use pauseRevision for every task pause/resume transition. Restrict equal-revision local pause protection to the owning workspace.

## Acceptance and compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1 | passed | Actions 38020006318 on 927df6af92581315c2576ef5172423898b34a274 passed the foreign stale pause / Work-to-review regression. |
| R2 | passed | Individual pause and resume increment task pauseRevision; merge rejects older transitions even with later timestamps. Both directions tested in the same successful job. |
| R3 | passed | Existing manual-pause and recovery regressions remain green. Native Chrome: only current Android task continued; unrelated paused workspaces remained paused. |
| R4 | passed | Full Actions: 396 tests, 389 passed, 0 failed, 7 existing skips. Native Fabushi management read back 2.10.42 enabled; original Android tab retained its task and automatically restarted supervision on reinjection. |

The live task subsequently showed actual assistant tool activity in the restored chat, and the workbench showed supervision. Its original corrupting writer is not directly attributed; source plus regression proves the identified overwrite path. ChatGPT credit-exhausted banner and conversation-list HTTP 429 were observed separately; uninterrupted long-duration runtime acceptance remains open.
