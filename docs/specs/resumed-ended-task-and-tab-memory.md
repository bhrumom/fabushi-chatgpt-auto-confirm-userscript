# Resumed ended tasks and tab memory — Specification

Status: implemented; paired host policy verification pending
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-23
Related incident: user screenshots showing a resumed task stuck at “等待响应” and Chrome tab memory at 3.7 GB

## 1. Context / problem
After resuming an exact-route task, the conversation can be ended with no Stop or final toolbar while the composer already contains the exact recovery prompt `继续完成所有`. `inspect()` currently treats only an empty composer as eligible for ended-without-final recovery, so this known recovery draft blocks the 8-second detector. The task remains waiting.

Memory status reads `performance.memory.usedJSHeapSize`, a V8 JavaScript heap estimate. Chrome's tab hover reports broader renderer/tab memory, so the values can differ substantially. Automatic host discard was previously requested only after repeated `high` JS-heap samples (1.5 GB or 70% threshold); the screenshot's 1.18 GB is `elevated`, so it never called the host. Chrome's `tabs.discard()` cannot discard an active tab, and the host rejects unsafe/in-flight tasks.

## 2. Goal
Resume an exact pending recovery draft after the normal ended-state stability gate, preserve unrelated user drafts, and accurately describe when userscript JS-heap metrics differ from Chrome tab memory and when host discard can work.

## 3. Non-goals
- Do not submit arbitrary user drafts or silently overwrite them.
- Do not claim that a userscript can force V8/native renderer memory back to its initial value while the tab stays active.
- Do not weaken Chrome host safety checks or discard an active/in-flight tab.
- Do not add a Chrome extension permission or change the separately maintained Fabushi host implementation.

## 4. Requirements
- R1: An enabled composer containing exactly `继续完成所有` may count as a recovery-ready composer for an owned, bound ended conversation; all other stability/ownership/final/loading/approval guards remain.
- R2: `sendContinuation()` must persist its pending intent before filling the composer, retry that exact draft after reload, and preserve any unrelated non-empty draft.
- R3: Repeated inspection of the same ended status must not send duplicate continuations; a later distinct ended response can continue again.
- R4: Label `performance.memory` values as JS heap estimates and state that they do not represent Chrome's full tab/renderer memory.
- R5: Explain that host discard unloads a non-active tab for later reload and cannot reduce memory for the currently active tab. Automatic requests remain subject to host capability, safe-state, and pressure gates.
- R6: Record host response reasons and report whether the request was unavailable, denied as active/unsafe, or actually discarded.

## 5. Architecture and ownership
Conversation recovery remains in the userscript's exact task URL + user-boundary logic. Memory reporting remains in the userscript; actual tab process metrics/discard belong to the Fabushi MV3 host. The host is not part of this repository.

## 6. Verification
Add regressions for an exact recovery draft through the 8-second ended gate, unrelated draft preservation, pending intent persistence, and existing duplicate-send guards. Run the repository suite. Review installed host support before claiming process-level reporting or active-tab cleanup.

## 7. Acceptance criteria
- AC-1: A resumed, owned, idle conversation with the exact recovery draft is continued after the stability gate.
- AC-2: Unrelated composer text is never overwritten or submitted by recovery.
- AC-3: A repeated identical status does not produce duplicate sends.
- AC-4: Memory UI explicitly distinguishes JS heap estimate from full tab memory and explains inactive-tab discard behavior.
- AC-5: No active-tab discard or unsafe task unload is attempted.

## 8. References
- `docs/specs/ended-conversation-continue-v2.9.59.md`
- `docs/specs/ended-detection-stale-loader-v2.9.60.md`
- User screenshots and live Chrome tab inspected 2026-09-23.
- Chrome APIs: [tabs.discard](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-discard), [processes API](https://developer.chrome.com/docs/extensions/reference/api/processes).

## 9. Spec compliance record
| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1, AC-1 | passed | Exact recovery composer text is accepted by the existing owned-route/no-final/idle guards and 8-second stable-ended detector; regression passes. |
| R2, AC-2 | passed | Continuation intent is saved before composer fill; exact recovery draft is preserved/retried, and unrelated non-empty drafts block injection; regression passes. |
| R3, AC-3 | passed | Existing pending-send/status-key guard remains, with the same ended state only handled once; same-chat retry and repeat-interruption regressions pass. |
| R4, AC-4 | passed | Settings and README identify the metric as a JS heap estimate and explain why it differs from Chrome tab memory. |
| R5, AC-5 | passed | Repeated elevated/high samples at >=1 GiB now ask the host; userscript retains active/unsafe checks and reports the host's active-tab denial. Chrome `tabs.discard()` does not discard an active tab. |
| R6 | passed | Host response reasons are surfaced separately for actual discard, active-tab, unsafe-state, unavailable, cooldown, and other denials; the active-tab response path is regression-tested with a simulated host. Paired host threshold validation is tracked in the extension repository spec. |
| Test suite | passed | `npm test`: 181 passed, 0 failed, 7 skipped (obsolete fresh-chat-on-interruption assertions). `git diff --check` passed. |
