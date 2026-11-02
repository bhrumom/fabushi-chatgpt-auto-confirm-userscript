# Long chat main thread guard — Specification

Status: active
Owner: Fabushi ChatGPT auto-confirm userscript
Date: 2026-11-03

## Incident and evidence

Chrome marked conversation `6ae8aa5a-7a60-83e8-8a88-f0ad8b50bf85` unresponsive and showed a black tab. Its hover showed about 1.2 GB. Chrome Task Manager showed an unnamed renderer at about 99% CPU, while another named chat renderer used substantially more memory and little CPU. The native sample shows JavaScript executing continuously on the renderer main thread, but does not identify the JavaScript owner or prove the userscript caused the original hang. Chrome's unresponsive dialog explicitly identified this conversation.

The userscript has two source-confirmed costs that grow with long content: `textTail()` walks and queues every preceding sibling before reading a bounded suffix, and tolerant report recovery reparses the full remaining suffix for each `taskId` occurrence. Both run synchronously on the page's main thread. Existing slow-scan metrics cannot observe a scan that never returns.

## Goal and boundaries

Bound the userscript's synchronous work on long transcripts and repeated report examples without changing ownership, authorization, send, final-report, or task-settlement decisions. Preserve complete valid report parsing and the exact response tail. The actual Chrome incident remains a separate live acceptance check; a source fix or CI pass alone does not prove that ChatGPT's own renderer is healthy.

## Requirements and acceptance

- R1: Read a bounded response suffix by traversing from the last child backwards. Work and temporary storage must scale with the suffix and its ancestor depth, not the count of earlier siblings. Preserve exact text and ordering.
- R2: Tolerant report recovery must not repeatedly scan an unbounded full suffix for every historical `taskId` example. Search a bounded number of candidate starts, prioritize the current task identity, and preserve strict JSON report handling.
- R3: A malformed/foreign/partial report must remain unable to finish or advance the task. Existing authorization and ownership gates remain unchanged.
- R4: Add regressions for a very wide transcript tail, many report examples, current-task report recovery and foreign/partial rejection.
- R5: Run generated bundle parity, syntax and full regressions in GitHub Actions on the exact source head. Record live Chrome responsiveness and installed runtime separately.

## Architecture and implementation

The shared DOM tail reader remains in `attachments-and-task-identity`. Report parsing remains in `review-and-settlement`. The tail reader uses a reverse depth-first walk without queuing all preceding siblings. Report recovery examines a bounded set of starts around the first and latest matching field markers, with a current-task marker prioritized; each candidate is parsed at most once. No persisted schema or host contract changes.

## Verification and rollback

Use deterministic DOM/parser regressions and the repository's existing Actions pipeline. If Chrome remains unresponsive after installing the tested build and reloading this conversation, profile the live renderer and isolate ChatGPT, Tampermonkey, and Fabushi host behavior before attributing the cause. Revert this source, tests, and generated bundle together if needed; task storage needs no migration.

## Compliance

| Requirement | Status | Evidence |
| --- | --- | --- |
| R1 | passed | `textTail()` reverse traversal and wide-sibling regression passed in PR Test 41479882568. |
| R2 | passed | Recovery checks at most the first, eight latest and four current-task candidate starts, each within 128,000 characters; repeated-example regression passed in PR Test 41479882568. |
| R3 | passed | Existing ownership/authorization/report regressions and new foreign/partial checks passed in PR Test 41479882568. |
| R4 | passed | Both new regressions passed; Test 41479882568: 705 total, 698 passed, 0 failed, 7 skipped. |
| R5, Actions | passed for source head | Source head `25c7676` passed generated bundle, syntax and full tests in Test 41479882568; this compliance note is a documentation-only follow-up. |
| R5, live | blocked | The original Chrome tab remains black and unresponsive before installation; causal attribution and post-install responsiveness still require live checks. |
