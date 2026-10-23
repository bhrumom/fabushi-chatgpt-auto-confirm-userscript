# Active task composer cleanup — v2.10.74

Status: completed
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
| R1-R3 / AC1-AC3 | passed | Source 2b8d8f65; PR #193; PR Test 39885898004 and main Test 39886137454: parity/syntax and 581 tests, 574 pass / 0 fail / 7 skip. Release 39886359812, asset 667665970, SHA256 a998ef586a5c7d39b1fd8ffc87bae904e85cab49ce9caeb74a3cb48cccb31534. Native installed list confirms 2.10.74 enabled. |

## Live acceptance
Original task 3dd43a37-9f36-4b7a-adac-dfcc87584523 had a diagnostic expression accidentally pasted into its ChatGPT composer by the operator; the draft protection caused the wait. Native UI removed only that known expression without sending it. Task then automatically progressed from /c/6adab4db-6614-83e8-b213-90498f607495 to /c/6adabb8c-98ec-83e8-8924-5086816ff45a. After installing 2.10.74, the same bound task tab was refreshed. A benign unsent verification draft was entered; at 09:52:48 Asia/Shanghai the new cleanup log appeared, the input was empty, and the test text was absent from visible message/log content. The task subsequently showed 正在生成 with Stop visible. No diagnostic or test draft was submitted. Existing connection-interruption classification and continuation policy remained active.

Cloud regression coverage includes textarea/contenteditable editor events and non-disclosure, inspector continuation integration, pause/global stop, foreign route/owner, aborted inspection and attempted/sending/upload protection. No local build/test was run. The first CI attempt failed only on the stale packaged-version assertion; it was corrected before final PR/main green runs.
