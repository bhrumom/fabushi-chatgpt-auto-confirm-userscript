# Missing Pro falls back to Extra High — v2.10.93

Status: active
Owner: standalone userscript
Last updated: 2026-11-03

## Context and goal
The user reports a task looping between missing-slider recovery and unsupported Pro. When the active strength slider exposes only indices 0–3, use Extra High (3) for a requested Pro (4).

## Requirements and acceptance
- R1: Only a valid visible enabled slider with min=0/max=3 proves Pro unavailable. Resolve requested index 4 to index 3 before range checks and keyboard adjustment.
- R2: Verify the actual current index is 3 before confirming success; store confirmed index 3. A stuck slider must block sending.
- R3: Keep the saved task preference Pro so later sessions can use Pro when restored. Log fallback explicitly. With max=4 continue selecting Pro.
- R4: Missing, malformed, inactive controls and ranges without Extra High retain existing recovery. Preserve task/token/round and send protection.

## Architecture and implementation
Use the existing ensureTaskReasoningPreset owner, resolving only its local target after authoritative slider acquisition. Keep task model selection, prompt, attachments, dispatch and persistent schema unchanged. No new transport or owner.

## Verification
GitHub Actions only for executable syntax/regression verification. Add four-level successful and stuck-slider cases, five-level Pro case, and range-without-Extra-High case. Generate bundle by source concatenation; no local test/build commands. Release version 2.10.93; rollback by prior bundle.

## Provenance
User request and attached live log, 2026-11-03. Supersedes strict Pro-unavailable waiting in transient-model-reasoning-picker-v2.10.33.md only for R1's proven four-level range.

## Spec compliance record
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R4 | pending | Implementation and exact-head Actions pending |
| Live browser acceptance | pending | Not yet installed |
