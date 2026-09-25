# Loading-failure recovery and scan cost — Specification

Status: active
Owner: ChatGPT auto-confirm userscript (host handoff requires paired Fabushi host change)
Last updated: 2026-09-25
Related issue/task/PR: user live report 2026-09-25

## 1. Context / problem

When ChatGPT displays a loading failure, a host may open a replacement tab without the active task attached. The existing userscript has explicit recovery tickets and task-transfer tickets, but the host implementation is maintained outside this repository; a bare new tab cannot safely take a task from a still-live owner without a coordinated transfer. Separately, recurring page-loading inspection redundantly scans nested `main`, `body`, and `html` scopes, increasing work on large conversations.

## 2. Goal

Reduce avoidable DOM work in recurring supervision, preserve strict task ownership during document recovery, and define the host contract required for a replacement tab to actually resume a failed tab's task.

## 3. Non-goals / out of scope

- Do not automatically duplicate or re-dispatch a task into a second tab while its original owner may still be running.
- Do not weaken task URL, workspace lock, recovery-token, phase/round, or dispatch-identity checks.
- Do not open popups from a timer and assume the browser permits them.
- Do not modify or claim behavior for the separately maintained Fabushi browser-extension host without its repository and exact host contract.
- Do not claim userscript JS-heap estimates represent total Chrome tab memory.

## 4. Requirements

- R1: Loading-state classification must query one containing page scope rather than independently rescanning nested `main`, `body`, and `html` subtrees.
- R2: Existing loading semantics remain intact for semantic loaders, visible spinners, visible conversation turns, and incomplete documents.
- R3: An explicit host-created replacement tab must receive a one-time task-bound transfer/recovery ticket; a generic ChatGPT tab must never guess among multiple owners.
- R4: A replacement may supervise only after exclusive workspace/task ownership is established; if the old owner remains live, keep the task with that owner and report the handoff as unavailable rather than racing sends.
- R5: If a ticketed fresh-document recovery fails to unload the current document, stop its runner and release its workspace lock so the host's replacement tab can claim the original task instead of opening as an empty, conflicting workspace.
- R6: Add regression coverage for loading detection and failed-document handoff; retain all existing task ownership and recovery tests.
- R7: Record the measured userscript scan duration as an estimate of instrumented work only, not total browser lag.
- R8: Limit recurring loader detection to the primary conversation surface when available, avoid enumerating every SVG solely to discover animated loaders, and avoid per-element visibility/layout checks for all historic turns when only a bounded transcript tail is needed.
- R9: While an assistant turn is actively streaming, recurring supervision must inspect only a bounded tail of its rendered text; full response extraction is reserved for a stable, non-streaming turn or an explicit handoff.
- R10: Do not normalize or copy an entire growing assistant response just to calculate a progress fingerprint; obtain only the bounded suffix needed for progress detection.
- R11: Add rate-limited privacy-safe performance diagnostics to task logs when an inspection is slow. Include total/stage durations, message-node counts, and inspected text-length estimates; never log message text, prompt/task content, URLs, tokens, or attachment data.
- R12: Avoid redundant full-document authorization-card scans from both the task inspection and the global-approval timer when the global-approval feature is disabled; preserve authorization detection when enabled and during active task inspection.
- R13: Add regression tests for large/growing assistant content and diagnostics, and ensure instrumentation is throttled so it does not itself cause frequent persistence or rendering work.
- R14: Restoring or updating one task must not parse the entire persisted workbench once per rendered task row; one paint uses one already-merged workspace snapshot.
- R15: Rebuild the task sidebar only when its visible task/workspace model changes, and bound the visible task-log tail while retaining the complete durable log.
- R16: Expose content-free workbench-paint timing/rebuild counters and add a regression with many archived tasks proving resume-time storage reads and visible log nodes remain bounded.
- R17: Request-frequency inspection must test each page text node before walking its ancestors, and ancestor text reads must be bounded; expose content-free timing/call counters and cover large unrelated page text in regression tests.
- R18: One synchronous task inspection must share at most one lazily-created page-UI text snapshot across its status classifiers. Classifiers must filter direct text before visibility/ancestor work, and must not materialize large ancestor `textContent` values merely to reject them; preserve detection semantics for short product notices.

## 5. Current state

`pageLoadingState()` searches `main`, `body`, and `documentElement`, even though these scopes nest; it repeats loader, SVG, and message queries. The userscript already supports a `fabushi-resume` recovery URL and `fabushi-assign-task` explicit transfer URL. The paired extension source is available locally at `work/fabushi-chrome-extension`; its recovery watchdog opens the exact ticketed recovery URL after the same-tab attempt. A failed same-tab document navigation previously resumed its old runner after eight seconds, leaving the replacement's workspace lock contested. A separate live reproduction showed that task resume also synchronously rebuilt the complete workbench: each task row reparsed the full persisted queue before constructing its move menu, while the selected task feed reinserted the full durable log tail. A subsequent live trace showed 14–16 second inspections with almost all time outside previously measured stages. Code inspection traced the gap to request-frequency classification rereading each page text node's full ancestors before checking whether that text could match a rate-limit notice.

## 6. Target state

The userscript performs one bounded page-scope loading scan per inspection. During active streaming it reads only a bounded text suffix and avoids rescanning full transcript content; expensive inspections emit a throttled, content-free stage timing record in the task log. All page-UI status classifiers within one synchronous inspection reuse one lazy text snapshot; short notice fallback reads stop once their subtree exceeds the allowed text budget. Request-frequency checks filter candidate text before ancestor inspection, bound ancestor reads, and expose their own duration and counters. Workbench paints reuse one merged workspace snapshot, memoize the sidebar model, and render only the recent durable-log tail. If its explicit fresh-document navigation does not unload the current page, that page yields the runner and workspace lock while retaining the persisted task and recovery ticket. Host-mediated recovery opens a replacement with that task-bound ticket; the replacement claims the workspace before continuing. Ordinary route-refresh failures retain the existing same-tab supervision behavior.

## 7. Architecture and ownership boundaries

The userscript owns task state, exact conversation URL, recovery/transfer ticket validation, and exclusive workspace locks. The Fabushi extension host owns Chrome tab creation and passes the validated `fabushi-resume` ticket URL. A failed document-recovery navigation explicitly relinquishes the old runner and workspace lock; otherwise the old page retains ownership. ChatGPT owns route/render state.

## 8. Interfaces / contracts / schemas / data flow

Existing ticket contracts remain unchanged: `fabushi-resume=<token>` for a proven recovery workspace and `fabushi-assign-task=<token>` for an explicit cross-tab transfer. The current host recovery worker validates and opens the ticket URL. Bare `chatgpt.com/` is insufficient when the former owner heartbeat is fresh.

## 9. Constraints and non-functional requirements

- Keep recovery single-owner and idempotent.
- Do not add repeated retries or busy polling.
- Loading inspection must preserve visibility and semantic loader checks while eliminating redundant subtree walks.
- Browser popup restrictions and Chrome background timer throttling remain external constraints.

## 10. Failure modes and edge cases

- Native Chrome network-error documents may not run the userscript; recovery then requires the extension host.
- ChatGPT application-level loading errors may leave the userscript alive and its heartbeat fresh; a second tab must not steal ownership based only on a failed-looking page.
- Expired, missing, or mismatched tickets must not attach an unrelated task.
- Multiple stale workspaces remain ambiguous and require explicit recovery selection.
- Large conversations may still cause significant work in message extraction, approval-card classification, and the page renderer even after duplicate loading scans are removed.

## 11. Implementation strategy

1. Add this Spec before product code.
2. Collapse loading-state discovery to one root containing scope, prefer `main`, and drop the unbounded all-SVG animation fallback while preserving semantic and class-based loader checks.
3. Add bounded tail-text extraction for active assistant streams; keep full extraction for settled replies and explicit carry handoffs.
4. Add rate-limited, content-free scan-stage timing and node/length metrics; skip global approval scans unless the feature is enabled.
5. Add/adjust regression tests for loader detection, long growing replies, authorization behavior, and diagnostic privacy/throttling.
6. On a failed `document-recovery` navigation watchdog, stop the old runner and release its lock without pausing or clearing the task; keep the durable host recovery lease available.
7. Review the paired host's ticket-validation and replacement-tab code, run the full userscript suite, and document that live Chrome recovery/performance remains unverified.

## 12. Verification / test strategy

Run focused loading/recovery tests, the complete `npm test` suite, syntax validation, and `git diff --check`. Review the paired host implementation before marking replacement-tab transfer complete. Live Chrome CPU comparison is not available from deterministic JSDOM tests and must remain explicitly unverified.

## 13. Acceptance criteria / Definition of Done

- AC-1: Loading classification preserves existing positive/negative semantics while walking a single containing page scope.
- AC-2: Full repository tests and syntax/diff checks pass.
- AC-3: No code path creates a second active task owner on an ambiguous/live workspace.
- AC-4: A failed ticketed document handoff cannot leave the original page supervising or holding the workspace lock.
- AC-5: Paired host continuity uses its existing validated recovery ticket; live Chrome acceptance is not claimed without a local runtime reproduction.

## 14. Release / migration / rollback

No persisted schema change is planned for the local scan optimization. Do not publish a new version from this change until exact-head CI and the required delivery workflow succeed. Roll back by reverting the scan-scope change; task data and tickets remain backward compatible.

## 15. Observability / evidence

Record local test and source checks below. `measurements.totalScanMs` is a local userscript inspection-duration estimate; it does not measure total renderer CPU, Chrome memory, or host-extension work.

## 16. References / provenance

- `AGENTS.md`
- `docs/specs/spec-first-ai-development.md`
- `docs/specs/current-tab-workspace-recovery-identity.md`
- `docs/specs/resumed-ended-task-and-tab-memory.md`
- User report and live task log on 2026-09-25.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R2 / AC-1 | passed | `pageLoadingState()` now queries the containing page once; existing loading regressions pass in the full suite. |
| R3-R4 / AC-3 | passed | Paired host `chatgpt-vps-control/chrome-platform/extension/userscript-recovery.js` opens the stored validated `recoveryURL`; regression confirms the failed old document releases the matching workspace lock while preserving task owner, state, and ticket. |
| R5 / AC-4 | passed | `failed fresh-document recovery yields the workspace lock for the ticketed replacement tab` passes. |
| R6-R7 / AC-2, AC-5 | passed | `npm test`: 213 total, 206 passed, 0 failed, 7 skipped; `node --check chatgpt-auto-confirm.user.js` and `git diff --check` pass. Live Chrome recovery and CPU comparison remain unverified. |
| R8 | passed locally | `pageLoadingState()` prefers `main` and no longer enumerates all SVGs; `visibleConversationProgressFingerprint()` limits layout visibility checks to its final eight transcript nodes. Loader positive/negative DOM tests remain green. |
| R9-R13 | passed locally | `npm test`: 222 total, 215 passed, 0 failed, 7 skipped; added a 60,000-repeat streamed-message test proving at most 6,000 assistant characters are read per inspection, replaced quadratic nested-root filtering with ancestor-set filtering, bounded page-level status scans by rejecting transcript subtrees, and made authorization-card scans label-filter before layout checks. Slow-scan logs contain stage timings/counts but no transcript or task text. Existing global approval scanning already returns before enumerating cards when disabled; active task inspection still detects authorization cards. Live Chrome performance and release CI remain pending. |
| R14-R16 | passed locally | A 73-task resume regression confirms durable-workbench reads remain bounded, status-only log updates do not rebuild the sidebar, and the visible feed never exceeds 30 message bubbles. Paint duration and rebuild counts are exposed without task text. `npm test`: 223 total, 216 passed, 0 failed, 7 skipped; `node --check chatgpt-auto-confirm.user.js` and `git diff --check` pass. Live Chrome acceptance remains pending. |
| R17 | released | A page with 500 unrelated labels and a 20,000-repeat transcript confirms request-frequency checks do not read the full `<main>` text. Full `npm test`: 224 total, 217 passed, 0 failed, 7 skipped; syntax and diff checks pass. Test run [36141709516](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36141709516) and Release run [36141773411](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36141773411) passed for `39e7a42d2841009e4c31025ac8d6458e4ab1d8af`. Published v2.9.82 asset SHA-256: `bcf3d73c92df41864c07a768ea9b050b0a920d510e270fe3fa0fa00e1665a726`. Live Chrome retest remains pending. |
| R18 | released | One lazy page-UI snapshot is shared by the four inspection classifiers; conversation-length detection filters direct text before layout checks, skips leaf-parent fallback reads, and uses per-parent cached bounded text extraction (600 characters) only for nested containers. Regressions assert one page text traversal per inspection and no full reads of large unrelated containers. Local `npm test`: 225 total, 218 passed, 0 failed, 7 skipped; syntax and diff checks pass. Exact-HEAD Test run [36161307859](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36161307859) and Release run [36161369304](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36161369304) succeeded for `ce4902000472ae1eb6c504d3e4e43f2708d34cf1`. Published [v2.9.83](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/tag/v2.9.83); asset SHA-256: `a14efa788b56c2078c5380678d95d28c9fcf3abd41149fd80c7b6b71dcfd2018`. Live Chrome comparison remains pending. |
