# Persistent workbench entry during DOM replacement — Specification

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-11
Related task: Chrome conversation 6acb4adc-0cdc-83e8-8443-031f981df128

## 1. Context / problem
The task runner stays active while the launch button vanishes during ChatGPT refresh/hydration and SPA navigation. mount() appends root once and the active bootstrap guard prevents duplicate injection; no post-mount DOM repair exists.
## 2. Goal
Keep one reachable entry and workbench throughout document DOM replacement without restarting execution.
## 3. Non-goals
No conversation policy changes, automatic navigation/reload for UI repair, new task/runner or task-state migration.
## 4. Requirements
- R1: Recover detached root, stylesheet and launch/desk children after page DOM replacement, including body replacement and initial document-start hydration.
- R2: Reattach the same nodes and closures; preserve panel open state, draft, file previews and handlers. Keep task identity, phase/round, ownership and running status intact; UI repair must never send a prompt.
- R3: Observe only structural mount anchors and root direct children, not the full streamed transcript subtree. Repairs must settle without observer loops or periodic full-page scans.
- R4: Shutdown disconnects the guard before removal; old instances must never resurrect after hot replacement. BFCache pageshow checks attachment without starting a second runner.
- R5: Publish and install verified v2.10.47 and visibly restore the current Chrome entry.
## 5. Current state
main c66cbb3e5a7ac9f5f5d89b1b2145677b250d9ffe, v2.10.46.
## 6. Target state
The existing mounted workbench owns a lightweight attachment guard for its document lifetime.
## 7. Architecture and ownership
Canonical userscript UI lifecycle only. Bootstrap/workspace/runner exclusive locks remain authoritative.
## 8. Interfaces / contracts
Private repair/stop callbacks; no persisted schema or extra global runner API.
## 9. Constraints
Tests/build verification in GitHub Actions only. Deterministic generated-source concatenation allowed locally.
## 10. Failure modes
Root/style removed together; body or document element replaced; launcher removed alone; repeated hydration; shutdown and hot replacement; user draft/files remain untouched.
## 11. Implementation strategy
Attach retained UI elements, observe direct-child changes at document/html/body/root, rebind anchors after replacements, disconnect on shutdown and repair on pageshow.
## 12. Verification strategy
DOM lifecycle regressions for removal/body replacement, same-instance task/input retention, repair settling and shutdown; existing bootstrap/hot-replacement suite. Live Chrome update, accessible launcher and clickable current task panel.
## 13. Acceptance criteria
- AC1: root/style/launcher are restored once after relevant DOM removals.
- AC2: original UI and instance survive, no duplicate send, draft/file state retained.
- AC3: observer stays shallow, shutdown is final and hot replacement remains singular.
- AC4: Actions and release succeed; Chrome has enabled 2.10.47 and restored entry.
## 14. Release / migration / rollback
Canonical main Test/Release pipeline. Roll back userscript to 2.10.46; task data requires no migration.
## 15. Observability / evidence
Actions logs and Chrome accessibility evidence. Source mechanism explains symptom; exact live DOM removal event was not captured.
## 16. References
bootstrap-failure-retry-v2.9.84.md; workbench-localstorage-quota-recovery-v2.10.16.md; supplied screenshot and live Chrome AX confirming absent launcher with active Stop.
## 17. Spec compliance record
Pending verification.
