# Reduce ChatGPT page stalls during userscript supervision — Specification

Status: active
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-26
Related issue/task/PR: user report: temporary unresponsive page during script operation; N/A

## 1. Context / problem

The current supervision path can synchronously block Chrome's main thread while scanning a large ChatGPT page. A visible runner tick called popup dismissal and request-rate detection before task dispatch; inspecting an existing conversation then scanned page status again. A separate popup timer also ran while the runner was active. Authorization detection enumerated controls across the full document, including historical turns. These repeated full-page operations can delay input and painting, especially on long conversations or under memory pressure.

## 2. Goal

Reduce the synchronous DOM and layout work performed by each visible supervision slice so ordinary operation does not make the ChatGPT page temporarily unclickable, while preserving safe task ownership, page-notice handling, and authorization recognition.

## 3. Non-goals / out of scope

- Do not change task scheduling, task identity, send authorization, or recovery semantics.
- Do not weaken approval matching or automatically approve broader permission scopes.
- Do not claim a userscript scan metric measures all ChatGPT renderer or Chrome work.
- Do not modify ChatGPT itself or the separately maintained extension host.

## 4. Requirements

- R1: Reuse at most one lazily built page-UI text snapshot across popup handling and status classifiers within one inspection.
- R2: Avoid running the independent popup-dismiss DOM scan while the task runner is active; the runner owns that work during active task supervision.
- R3: Do not perform a standalone rate-limit page scan before inspecting or sending a task when the inspect/send path already performs the same safety check. Retain checks for ambiguous sends that have not yet bound a conversation.
- R4: Restrict page text scanning to the primary ChatGPT surface and small semantic overlay roots where available, while continuing to exclude transcripts and the Fabushi panel.
- R5: Restrict authorization-card button inspection to the latest bounded conversation surface plus visible semantic dialogs/overlays. Do not read labels or layout for historical message controls.
- R6: Preserve detection of current authorization cards, page-level error/rate-limit notices, and history-only rate-limit popups; preserve all existing task/send safety rules.
- R7: Keep document scanning synchronous and bounded per runner slice; do not introduce a mutation observer that performs unbounded work in response to streaming DOM mutations.
- R8: Document performance evidence and limitations; no persisted task/workspace schema changes.

## 5. Current state

The task runner polls every four seconds while visible. It calls `dismissUnexpectedModals()` and `rateLimitNotice()` before dispatch. `dismissUnexpectedModals()` scans all page buttons and page text; `inspect()` then scans cards and builds a second lazy page-text snapshot for classifiers. A five-second popup timer also calls the page scan while the runner is active. `cards()` currently reads labels from every button in the document.

## 6. Target state

The active task path performs its page-notice and overlay checks inside the same post-navigation inspection context and shares one lazy text and approval snapshot. Send paths retain their own pre-send checks. Ambiguous unbound send confirmation retains a rate-limit check. The popup timer yields after a recent runner scan. Page text is read from the main content and compact semantic overlays; approval labels/layout are checked only in recent conversation turns and overlays.

## 7. Architecture and ownership boundaries

The userscript runner owns active task supervision and its status checks. The global popup timer handles idle-page cleanup only. ChatGPT owns the page DOM; its transcript is never treated as a page-chrome notice. The workbench continues to own its own DOM subtree and durable task model.

## 8. Interfaces / contracts / schemas / data flow

No persisted data or host message contracts change. Scan-context data is ephemeral to one inspection and is discarded afterward.

## 9. Constraints and non-functional requirements

- Avoid repeated body-wide text walks and layout reads on every timer source.
- Keep current-task inspection safe across route changes and async navigation.
- Keep approval detection inclusive of current response cards and explicit dialogs without searching every historic response toolbar.

## 10. Failure modes and edge cases

- A current approval card outside the assistant article: inspect bounded siblings near the latest turn and semantic overlay roots.
- A page notice rendered outside `main`: inspect alert/status/live-region and dialog roots outside the primary surface.
- No `main` exists: fall back to the document body.
- DOM changes while an async route navigation is in progress: build the scan context only after navigation and route ownership are rechecked.

## 11. Implementation strategy

1. Create an ephemeral page scan context after route validation and share its lazy text and approval snapshots within the synchronous inspection phase.
2. Move overlay dismissal to the appropriate task path; remove duplicate scheduler-level rate-limit scans and retain an explicit guard only for ambiguous unbound sends.
3. Suppress the popup timer's active-runner duplicate work.
4. Bound page-text roots and authorization-card scopes to the primary surface, recent turns, and semantic overlays.
5. Preserve the existing lifecycle, ownership, and permission checks.

## 12. Verification / test strategy

Use existing regression coverage for page notice filtering, rate limits, authorization cards, and task ownership. Inspect source/diff for duplicate full-page scan paths and ensure syntax remains valid. Live Chrome CPU and interaction latency require real-browser profiling and are not established by source-level inspection alone.

## 13. Acceptance criteria / Definition of Done

- AC-1: An active bound-task slice builds no more than one page text snapshot and shares it across applicable classifiers.
- AC-2: The active runner does not compete with the popup timer for repeated page scans.
- AC-3: Authorization detection does not inspect historical message controls and still includes the current turn and explicit overlays.
- AC-4: Existing notice and task-safety behavior remains intact.
- AC-5: The measured browser responsiveness is not overstated without live Chrome profiling.

## 14. Release / migration / rollback

No storage migration. Release requires the canonical repository's tested-release workflow. Roll back by reverting the scan-context and scan-scope changes; persisted workspaces remain compatible.

## 15. Observability / evidence

Existing slow-scan counters measure only instrumented synchronous userscript work. They exclude ChatGPT renderer work, browser style/layout work outside measured sections, extension-host work, and OS scheduling.

## 16. References / provenance

- `AGENTS.md` and `docs/specs/spec-first-ai-development.md`.
- `docs/specs/loading-failure-recovery-and-scan-cost.md` (R17-R18).
- User report: page becomes temporarily unresponsive during script operation.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R5, R7-R8 / AC-1-AC-3 | passed | Source review confirms the bound-task runner no longer does its duplicate scheduler-level rate-limit/popup scans; `inspect()` shares one lazy page-text and authorization snapshot with popup handling; the active popup timer yields after a recent runner scan; notice and card searches are limited to main/semantic overlays and the latest eight message surfaces. |
| R6 / AC-4 | blocked | Existing regressions cover rate limits, page alerts, authorization cards, and ownership, but this turn did not run the test suite. The existing matchers and ownership checks were retained by source review. |
| AC-5 | passed | No live Chrome CPU or click-latency measurement is claimed. Only `node --check` and `git diff --check` were run; both passed. |
