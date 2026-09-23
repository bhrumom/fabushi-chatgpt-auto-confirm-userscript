# Task Drag-and-Drop Between Tab Workspaces — Specification

Status: completed
Owner: Fabushi ChatGPT Auto-confirm Userscript
Last updated: 2026-09-23
Related issue/task/PR: N/A

## 1. Context / problem
Users need to assign existing workbench tasks to browser-tab workspaces and combine multiple tasks in one tab. A userscript page cannot receive native Chrome tab-strip drops: page drag/drop events are confined to the page DOM, while Chrome's `chrome.tabs` API exposes tab operations/events but no tab-strip drop-target callback. The extension is a separate repository and must not embed the userscript.

## 2. Goal
Provide a clear drag-and-drop workflow in the Fabushi workbench that assigns tasks to an existing live tab workspace, including multiple tasks per workspace, or opens a new ChatGPT tab assigned to one task. A workspace's existing fair scheduler continues to rotate its tasks' conversation URLs.

## 3. Non-goals / out of scope
- Intercept native Chrome tab-strip or blank tab-strip drops from page JavaScript.
- Change the extension or embed userscript source into it.
- Allow two workspaces to own or schedule the same task concurrently.

## 4. Requirements
- R1: Task rows can be dragged and dropped onto a visible live tab-workspace target; the task's owner changes to that workspace and it joins its queue.
- R2: A workspace accepts multiple tasks; existing scheduler rotates and monitors their separately recorded conversation URLs.
- R3: A dedicated “新标签页” drop target opens ChatGPT and transfers only the dropped task to the new tab's workspace.
- R4: Terminal tasks cannot accidentally resume by reassignment; user-paused tasks stay paused.
- R5: Provide a keyboard-accessible assignment control for the same targets.
- R6: Explain in the UI that Chrome's native tab strip is not itself a drop target; use the in-page target adjacent to workspace list.

## 5. Current state
Tasks persist in shared localStorage with `ownerTabId`; each tab holds a Web Lock for its workspace. `tabTasks()` filters by owner, and the scheduler already rotates among tasks/conversation URLs. Workbench renders current and other workspaces; other workspace restoration is currently an all-workspace operation.

## 6. Target state
Task rows expose drag handles and assignment menus. A workspace target can accept multiple moved tasks. A new-tab target records a short-lived task-specific transfer ticket and opens a ChatGPT tab that claims a new workspace and consumes that ticket. No task is duplicated; its task ID, phase, round, target/next, URL, token, and attachment metadata remain unchanged.

## 7. Architecture and ownership boundaries
The userscript remains authoritative for workbench UI and task ownership. Shared storage is the transfer rendezvous. Web Locks serialize task transfers and workspace assignment changes. The destination script adopts the task only after obtaining its own workspace lock; source pages stop considering it owned at the next synchronization boundary. The extension remains unchanged.

## 8. Interfaces / contracts / schemas / data flow
Transfer ticket: version, opaque nonce, task ID, source owner ID, target owner ID (or new-workspace marker), created time, and expiry. It contains no task prompt or attachment bytes. The task stays in the canonical task list and changes owner once. New-tab initialization consumes and deletes the ticket after claiming the new workspace.

## 9. Constraints and non-functional requirements
No polling loops beyond existing scheduler/heartbeat cadence. Drag interactions must not dispatch a task by themselves beyond its existing state policy. Existing user pause and task state must be preserved. Native Chrome tab-strip drop is not represented as supported.

## 10. Failure modes and edge cases
Reject stale/missing ticket, missing/removed task, invalid destination, or failed new-tab open without losing the task. If assignment cannot be verified, report an error and preserve existing owner. Multiple rapid drops must be serialized. Attachments remain in the existing IndexedDB store.

## 11. Implementation strategy
Add a durable transfer ticket and startup adoption path; render accessible workspace targets and per-task assignment controls; serialize owner mutation; add focused JSDOM tests for task-only reassignment, multi-task grouping, pause preservation, new-tab ticket adoption, and expired ticket handling.

## 12. Verification / test strategy
Run syntax check and focused/full userscript regression suite. Inspect UI structure and keyboard assignment controls in JSDOM. Live Chrome drag/drop verification remains necessary after local install, specifically for the in-page target/new-tab handoff; native Chrome tab-strip targeting is explicitly unsupported by platform APIs.

## 13. Acceptance criteria / Definition of Done
- AC-1: Drag or keyboard-assign a task to an existing workspace and confirm exactly one owner; destination scheduler can select it.
- AC-2: Multiple tasks can share a workspace and retain distinct conversation URLs.
- AC-3: New-tab transfer carries only the chosen task and preserves its execution state and attachments.
- AC-4: Existing and new regression tests pass.
- AC-5: Spec compliance table records evidence for every requirement and criterion.

## 14. Release / migration / rollback
No schema migration is required; existing `ownerTabId` remains the task ownership key. A short-lived transfer ticket is removed after consumption or expiry. Publish as userscript patch v2.9.67 when release checks pass; extension release is out of scope.

## 15. Observability / evidence
Assignment actions append a task log entry identifying source/destination workspace labels without copying task content into transfer tickets. UI reports failed or expired transfers.

## 16. References / provenance
- User request and supplied screenshot, 2026-09-23.
- Chrome Tabs API: https://developer.chrome.com/docs/extensions/reference/api/tabs
- Repo source: `chatgpt-auto-confirm.user.js`, `docs/specs/spec-first-ai-development.md`.

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 | passed | Synthetic dragstart/drop regression moves one task onto another live workspace and verifies one canonical owner. |
| R2 | passed | Existing `tabTasks()` and supervision scheduler remain unchanged; existing multi-task URL rotation regression passes. |
| R3 | passed | New-tab ticket is task-scoped, short-lived, and consumed after destination workspace lock claim; startup regression preserves URL/token/phase/round/attachments. |
| R4 | passed | Assignment regression confirms a paused task stays paused and retains its state. |
| R5 | passed | Task rows expose an accessible assignment selector; UI regression asserts selector and new-tab drop target. |
| R6 | passed | Sidebar helper text explicitly states native Chrome tab strip is not a webpage drop target. |
| AC-1 | passed | `dragging a task row onto another live workspace transfers that task` plus `task reassignment changes only ownership...` pass. |
| AC-2 | passed | Regression confirms destination workspace contains the pre-existing task and moved task; existing fair scheduler tests pass. |
| AC-3 | passed | `new tab claims the transfer workspace and adopts only the ticketed task` passes. |
| AC-4 | passed | `node --check chatgpt-auto-confirm.user.js`; `npm test`: 192 passed, 0 failed, 7 skipped. |
| AC-5 | passed | This compliance record covers all requirements and acceptance criteria. |
