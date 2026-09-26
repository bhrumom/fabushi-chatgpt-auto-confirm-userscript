# Userscript bootstrap failure recovery — Specification

Status: active
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-26
Related issue/task/PR: live Chrome report, `fabushi-resume` route; N/A

## 1. Context / problem

The 2.9.83 userscript claims a document-wide bootstrap marker before its first awaited workspace-lock operation. The active-instance record and visible workbench are created much later. If an awaited startup operation rejects in that gap, the marker remains without an active instance. A later injection sees the marker and exits as a duplicate, leaving the ChatGPT page open with no script UI or task supervision. On a ticketed `fabushi-resume` route, that can leave the recovered page apparently stuck indefinitely.

The supplied live screenshot shows the ChatGPT shell/composer with a persistent loading spinner, and Fabushi Marketplace reports the canonical userscript v2.9.83 installed and matching the GitHub release. The evidence does not identify the exact exception from that Chrome run; the stale-marker failure is a code-path root cause capable of producing the reported symptom.

## 2. Goal

Make failed userscript startup recover visibly and retry safely instead of leaving a stale bootstrap marker that permanently suppresses reinjection.

## 3. Non-goals / out of scope

- Do not bypass Web Locks or weaken exclusive workspace/task ownership.
- Do not send, duplicate, or re-dispatch a task solely because bootstrap failed.
- Do not change ChatGPT loading-state classification or its server-side conversation load behavior.
- Do not claim the screenshot proves which browser API threw.

## 4. Requirements

- R1: If an asynchronous bootstrap attempt fails before the active instance is installed, remove only that attempt's marker, release any workspace lock it acquired, and preserve a task-bound route ticket until workspace ownership is successfully claimed.
- R2: Retry bootstrap a small bounded number of times without reloading or navigating the ChatGPT conversation.
- R3: If retries fail, show a small in-page diagnostic with a manual retry action; do not leave the failure silent.
- R4: Stale marker recovery must not permit simultaneous workbench mounts; markers from a live recent bootstrap remain authoritative.
- R5: Task execution remains gated by existing workspace and runner locks; failure recovery must not create duplicate sends.
- R6: Bump the userscript metadata/runtime and README version to 2.9.84 and record this specification.

## 5. Current state

The script inserts `fabushi-auto-confirm-bootstrap-v1` and then awaits `claimWorkspace()`. Rejection has no top-level catch. The guard treats any pre-existing marker without an active instance as a concurrent bootstrap forever. The workbench is mounted only at the end of initialization.

## 6. Target state

Bootstrap rejection is handled by an outer retry controller. It cleans up the attempt-owned marker, performs bounded retries, and then displays a retryable diagnostic if initialization still fails. A stale marker with no active instance can be reclaimed after a conservative timeout. Existing lock ownership checks remain unchanged.

## 7. Architecture and ownership boundaries

The bootstrap controller owns only startup attempts and the startup marker. The userscript workspace lock continues to own tab task data and the runner lock continues to own execution. The error UI contains only a safe, truncated error message and a retry button.

## 8. Interfaces / contracts / schemas / data flow

No task-storage schema or external interface changes. The bootstrap marker gains a start timestamp. The in-page failure message exposes no task text, URL, token, or attachment data.

## 9. Constraints and non-functional requirements

- No page reloads or navigation during automatic retry.
- Retry count and delay are bounded.
- A recovery failure must not spin or create repeated storage writes.

## 10. Failure modes and edge cases

- Workspace lock acquisition rejects once then succeeds: one workbench mounts and startup proceeds normally.
- Startup keeps failing: one diagnostic UI is shown and a user can retry.
- Another fresh bootstrap is active: duplicate injection exits without removing its marker.
- Stale marker from an older crashed startup: later injection may reclaim it.

## 11. Implementation strategy

Wrap startup in an outer controller, clean marker/lock state on pre-mount failure, retry with bounded backoff, and mount a small diagnostic/retry affordance after exhaustion. Give markers a start time and reclaim only old markers with no registered active instance. Add source-level regression coverage through the existing workbench harness when allowed.

## 12. Verification / test strategy

Verify syntax and inspect the diff. The intended regression injects a one-time Web Locks rejection on a `fabushi-resume` URL and verifies that retry mounts exactly one workbench while retaining the route and task ownership. Also verify persistent failure shows one retry affordance and no runner starts without its lock.

## 13. Acceptance criteria / Definition of Done

- AC-1: A rejected first workspace claim no longer leaves a permanent bootstrap marker or a blank, silent userscript state.
- AC-2: A retry succeeds without changing the ChatGPT conversation URL or allowing duplicate workbench/runner ownership.
- AC-3: Persistent failure is visible and manually retryable; no reload is performed.
- AC-4: Metadata/runtime/README show 2.9.84 and the diff passes syntax review.

## 14. Release / migration / rollback

No persisted task migration. Publish through the canonical verified PR and release workflow. Rollback by reverting the bootstrap controller and version bump.

## 15. Observability / evidence

The failure affordance reports a concise startup error and retry action only. The supplied screenshot supports the symptom and installed version, but the precise live exception remains unobserved.

## 16. References / provenance

- User-provided Chrome screenshot, 2026-09-26: `chatgpt.com/c/...#fabushi-resume=...`, spinner and composer visible; Marketplace reports 2.9.83 installed/current.
- `chatgpt-auto-confirm.user.js`: bootstrap marker guard, workspace-lock await, and delayed `mount()`.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 / AC-1-AC-2 | passed | New regression forces the first `fabushi-resume` workspace lock request to reject and proves retry claims the original owner, retains then consumes the recovery ticket, and mounts exactly one workbench. |
| R2-R5 / AC-2-AC-3 | passed | Two bounded retries and a manual retry diagnostic are implemented; existing concurrent-injection and runner-lock regressions remain green. Full `npm test`: 226 total, 219 passed, 7 skipped, 0 failed. |
| R6 / AC-4 | passed | Userscript metadata/runtime and README report 2.9.84. `node --check chatgpt-auto-confirm.user.js` and `git diff --check` pass. |
