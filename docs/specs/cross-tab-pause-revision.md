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
Pending implementation, exact-head CI and installed version readback. Native investigation proves the inconsistent persisted state but does not by itself prove its original writer.
