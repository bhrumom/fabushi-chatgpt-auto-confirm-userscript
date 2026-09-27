# Recovered final toolbar wins stale loading — Specification

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-27  
Related issue/task/PR: User report in Codex

## 1. Context / problem

After Fabushi adopts the only new ChatGPT conversation created by an ambiguous send, ChatGPT may render the user turn without the hidden Fabushi marker. The script records the exact conversation URL and clears the ambiguous-send state, but ordinary recovered identity does not snapshot the visible user boundary. `taskTurnForInspection()` therefore rejects the completed reply even when its response-local Copy plus Share/Feedback/More toolbar is visible. A stale page loading marker then drives route recovery and the task remains in “正在加载”.

## 2. Goal

Recognize a final reply in an exact recovered conversation when the visible user boundary is unchanged and the latest assistant reply has the existing strong final-toolbar evidence, even if the original Fabushi marker was virtualized or never mounted.

## 3. Requirements

- R1: Every recovered identity records the visible latest-user boundary when one is mounted, including automatic recovery identities.
- R2: On the exact task route, with no competing task or route owner, an unchanged recovered user boundary may own a latest assistant reply only when the existing strong final-toolbar detector says it is final.
- R3: A later or changed user boundary must invalidate this fallback.
- R4: Stop, approval cards, route mismatch, foreign task markers, and ambiguous-send state continue to block completion.
- R5: Static natural-language replies without final toolbar remain limited to explicit manual recovery and its existing stability gate.
- R6: Strong recovered final evidence must be evaluated independently of stale page-global loading markers and must prevent route refresh recovery.
- R7: Bump userscript metadata/runtime/README to 2.9.93 and publish only after exact-head verification.

## 4. Implementation strategy

1. Persist `visibleUserBoundaryKey` for every recovered identity, while keeping `allowStaticFinal` exclusive to explicit recovery.
2. Let `taskTurnForInspection()` accept a strong final-toolbar candidate when that persisted boundary is unchanged.
3. Preserve the existing static-reply and changed-boundary guards.
4. Add regressions for stale loading plus final toolbar and for a changed user boundary.

## 5. Acceptance criteria

- AC-1: An automatically recovered marker-virtualized turn with Copy plus a completion action is completed after the existing final stability interval even if a stale loading indicator remains visible.
- AC-2: The same state does not increment route recovery attempts or refresh the page.
- AC-3: Adding a newer user turn after recovery prevents completion from the prior identity.
- AC-4: A recovered reply without final toolbar is not promoted unless explicit manual recovery already permits the bounded static fallback.
- AC-5: Syntax, full regression suite, version consistency, exact-head CI, merge, and v2.9.93 release pass.

## 6. Compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R6 / AC-1-AC-4 | passed | Every recovered identity now snapshots the visible user boundary. Automatic recovery accepts only an unchanged boundary plus the existing strong final toolbar; changed boundaries and bare static replies fail closed. Regression coverage includes stale page loading and route-recovery suppression. |
| R7 / AC-5 | local passed; publication pending | Metadata, runtime, and README are 2.9.93. `node --check chatgpt-auto-confirm.user.js`, `git diff --check`, and the full 235-test suite pass locally (228 passed, 7 skipped, 0 failed). Exact-head CI, merge, and release are completed through the repository workflow. |
