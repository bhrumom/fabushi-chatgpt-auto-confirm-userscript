# Read reasoning value from hidden semantic thumb — Specification

Status: active
Owner: standalone ChatGPT auto-confirm userscript
Last updated: 2026-10-22

## 1. Context / problem
v2.10.64 still repeats model preflight. Actual Chrome DOM has a visible enabled menuitem `[data-reasoning-slider=true]` receiving keyboard events and a descendant `span[role=slider][aria-hidden=true]` exposing aria-valuemin=0, aria-valuemax=4, aria-valuenow=1. The hidden thumb is deliberately excluded from accessibility; it is the value carrier, not the interaction target. v2.10.64 incorrectly requires that value node be visible. Live keydown on its outer menuitem changed 1 -> 2 -> 3 and trigger effort medium -> high -> max. Inactive radio views remain mounted with data-active=false/aria-hidden=true.
## 2. Goal
Select and verify model and strength at the start of a dispatch, then advance without repeated model selection during same-intent Send UI retries.
## 3. Non-goals / out of scope
No quota workaround, automatic fallback model, account changes or unrelated conversation mutations.
## 4. Requirements
- R1: Select only an active visible enabled strength owner. Read integer aria values from its nested thumb even when the thumb itself is aria-hidden or zero-size; send keyboard events exclusively to the owner.
- R2: Hidden/inactive/disabled outer controls remain ineligible; missing/malformed thumb values fail closed. Do not interpret a hidden semantic thumb as an inactive picker view.
- R3: Cache successful model proof only in document memory, bound to the same task object, nonempty prepared token, goal revision, requested model, route and exact connected trigger. Reuse only when closed trigger still identifies that model, no radio popup is active, and task confirmation remains intact. Hints alone cannot create proof.
- R4: New token/model/goal/route/trigger, ambiguous label, popup open, or cleared confirmation invalidates reuse and requires normal authoritative preflight. Reasoning remains verified before Send.
- R5: Preserve chosen GPT-6/extreme strength, task round/token/content and no duplicate sends. Resume the task paused for investigation after installing the fix.
## 5. Current state
v2.10.64 filters the thumb itself through pickerControlVisible, producing perpetual missing-slider recovery; every send retry repeats model verification.
## 6. Target state
Outer owner visibility governs eligibility; semantic thumb supplies values. Successful per-intent model proof avoids reopening an unchanged model menu.
## 7. Architecture and ownership boundaries
composer-and-model owns value observation and ephemeral model proof; existing send/attachment/ownership gates remain.
## 8. Interfaces / contracts / schemas / data flow
WeakMap keyed by task with token/revision/route/trigger/model. No persistent schema or exported runtime API changes.
## 9. Constraints and non-functional requirements
Local source editing and generated-source synchronization allowed; executable build/tests only GitHub Actions. Bounded existing keyboard loop and authoritative post-event re-read.
## 10. Failure modes and edge cases
Hidden semantic thumb; inactive owner; stale cached proof; user model change; remount; prompt token change; missing slider values; ignored keyboard event.
## 11. Implementation strategy
Spec, correct thumb eligibility, ephemeral model proof, real-DOM-shape behavioral regressions, CI, release/install, resume original dispatch and observe model/strength/send.
## 12. Verification / test strategy
GitHub Actions full suite and bundle/syntax checks. Native Chrome before/after DOM and automatic dispatch observation on original task. No manual strength adjustment after installing and resuming.
## 13. Acceptance criteria / Definition of Done
- AC-1: Hidden thumb test advances 1 -> 3 through outer owner and confirms strength; inactive outer owner cannot satisfy it.
- AC-2: Same prepared intent reuses real model proof without extra trigger/submenu/target clicks; relevant invalidations force re-verification.
- AC-3: PR/main CI, release digest and installed runtime version verified.
- AC-4: Original task resumes with GPT-6/extreme and automatically dispatches once without manual menu assistance.
## 14. Release / migration / rollback
v2.10.65; revert by normal release; no migration.
## 15. Observability / evidence
DOM role/aria/data-active observations, CI results, release digest, runtime version, original task ID/round/token/route.
## 16. References / provenance
AGENTS.md; model-picker-close-v2.10.64.md; per-task-model-selector-v2.10.31.md; live Chrome DOM and synthetic owner keyboard events, 2026-10-22.
## 17. Spec compliance record
Pending verification.
