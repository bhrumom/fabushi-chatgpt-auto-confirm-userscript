# Start the userscript before ChatGPT finishes loading — Specification

Status: active
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-26
Related issue/task/PR: user live report after v2.9.84; N/A

## 1. Context / problem

After v2.9.84 was published, the user clarified that during refresh the script does not appear until the ChatGPT page finishes loading. The userscript metadata still says `@run-at document-idle`, which defers the first injection until the document is idle. That directly explains the observed wait even when no bootstrap error occurs.

## 2. Goal

Inject and mount the Fabushi workbench while ChatGPT is still loading, so a slow conversation hydration does not hide the script UI until the page finishes.

## 3. Non-goals / out of scope

- Do not change ChatGPT's server-side conversation loading or spinner behavior.
- Do not weaken workspace, runner, route-ticket, or send-safety locks.
- Do not start a task solely because early injection occurred.

## 4. Requirements

- R1: Change userscript scheduling from `document-idle` to `document-start`.
- R2: Mount the workbench while `document.readyState` is still `loading`; safely use the document root when `body` has not been created.
- R3: Preserve existing bootstrap retries and task/workspace safety behavior.
- R4: Add a regression proving the userscript is configured for early injection and its workbench mounts before document completion.
- R5: Bump metadata/runtime and README to 2.9.85; publish only after the repository's main-branch tests pass.

## 5. Current state

v2.9.84's metadata uses `@run-at document-idle`. The `mount()` helper already falls back to `document.documentElement` when `document.body` is absent, but injection itself is delayed until idle.

## 6. Target state

The userscript begins at `document-start`; existing initialization and workspace ownership checks run as before, and the fixed workbench root is appended to `documentElement` if `body` is not yet present.

## 7. Architecture and ownership boundaries

Only the userscript manager injection lifecycle changes. DOM workbench owns its own root and style elements; it does not depend on ChatGPT's React root. Workspace locks continue to guard task ownership and execution.

## 8. Interfaces / contracts / schemas / data flow

No persisted or external data format changes. Userscript metadata's `@run-at` declaration changes from `document-idle` to `document-start`.

## 9. Constraints and non-functional requirements

- Avoid waiting for the load event or a full-page completion signal before mounting.
- Keep early page queries null-safe and preserve bounded startup/retry behavior.

## 10. Failure modes and edge cases

- `document.body` is absent: append the workbench to `document.documentElement`.
- ChatGPT is still hydrating: the script UI is visible; task inspection continues to observe loading and does not infer completion.
- Workspace acquisition rejects: existing retry logic preserves the resume ticket and prevents duplicate ownership.

## 11. Implementation strategy

Set `@run-at document-start`, update runtime and README versions, add an early-readyState regression, run syntax and full tests, then merge to main and verify automatic release asset identity.

## 12. Verification / test strategy

- Assert metadata declares `document-start`.
- In the JSDOM fixture while `document.readyState === 'loading'`, assert exactly one workbench root exists after bootstrap.
- Run `node --check chatgpt-auto-confirm.user.js`, `npm test`, and `git diff --check`.
- Verify the v2.9.85 release and downloaded userscript match the merged source.

## 13. Acceptance criteria / Definition of Done

- AC-1: On a still-loading document, the workbench mounts without waiting for `load` or `document-idle`.
- AC-2: Existing loading classification and task-lock regressions remain green.
- AC-3: v2.9.85 is released after canonical main CI succeeds, and its asset matches source.

## 14. Release / migration / rollback

No storage migration. Merge through the canonical PR workflow; successful main Test triggers automatic v2.9.85 Release. Roll back by reverting the injection metadata and version bump.

## 15. Observability / evidence

The regression observes the workbench root while the document is still loading. The exact page-load delay in live Chrome is not available from the screenshot; early injection behavior is covered by test and release verification.

## 16. References / provenance

- User's latest clarification: refresh shows no script until the page fully loads.
- v2.9.84 release metadata: `@run-at document-idle`.
- v2.9.84 bootstrap-retry specification and code.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R4 / AC-1-AC-2 | passed | Userscript now declares `document-start`; regression holds JSDOM `readyState` at `loading` and verifies exactly one workbench root has mounted. Full `npm test`: 227 total, 220 passed, 7 skipped, 0 failed. |
| R5 / AC-3 | pending | |
