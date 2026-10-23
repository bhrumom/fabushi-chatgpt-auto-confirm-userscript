# Active task composer cleanup — v2.10.74

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-23
Related: expired-continuation-hydration-v2.10.73.md

## Context and goal
The recovered task stopped progressing because an operator diagnostic expression was accidentally pasted into the ChatGPT composer. The existing draft guard correctly preserved it, but the user now explicitly requests clearing encountered input instead of protecting it. This supersedes earlier unrelated-draft preservation only for an actively supervised, owned bound task conversation.

## Requirements and acceptance
- R1/AC1: At the start of active bound-conversation inspection, clear nonempty ChatGPT composer text using normal editor events, then continue ordinary classification. Never log or submit the removed text. No timer or repeated preservation wait.
- R2/AC2: Keep inactive/paused/global-paused/terminal tasks, foreign/unbound routes, other task owners, and pending initial dispatch/upload intent protected. Do not touch the workbench task-goal editor or attachments. Preserve send-intent fencing, cards, approval settlement and the three-continuation cap.
- R3/AC3: Regress actual diagnostic-style draft and generic textarea/contenteditable text. Verify active owned cleanup and continued inspection, plus paused/foreign/dispatch protection. Actions-only parity/syntax/full regressions, exact source/release digest, installed version and live original-task progression. Remove the known diagnostic draft using native UI immediately; do not send it.

## Plan and boundaries
Add a guarded composer cleanup helper at the inspector's validated-route entry, before collapsed-response and pending-continuation early returns. A queued initial prompt is handled by the existing sender; a persisted attempted dispatch is left to acknowledgment handling. No broad selector, authorization bypass or task-state mutation. Rollback reverts source/bundle/version together.

## Compliance
| Requirement / AC | Status | Evidence |
| --- | --- | --- |
| R1-R3 / AC1-AC3 | pending | Cloud/release/installed acceptance pending. |
