# Null DOM scope during interrupted-turn recovery — Specification

Status: active
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-23
Related issue/task/PR: live Chrome report, 2026-09-23

## 1. Context / problem

After the 15-minute no-progress refresh, ChatGPT can temporarily render a route with a task ownership mismatch. `latestTurn(task)` intentionally returns `article: null` in this fail-closed case. If an interruption notice is still visible outside the conversation turn, `inspect()` recognizes it and passes the null article to the scoped DOM query helper. The resulting `Cannot read properties of null (reading 'querySelectorAll')` throws out of supervision and incorrectly enters automatic fresh-chat recovery instead of continuing the recorded conversation.

The live browser transcript also confirms that the prior `继续完成所有` text was already sent as a user message; the failure happened later while recovering after reload.

## 2. Goal

Make scoped DOM queries safely return no results when their explicit scope is absent, so an interrupted-turn recovery can continue through the existing document-level fallback without throwing or replacing the conversation.

## 3. Non-goals / out of scope

- Do not change when or how `继续完成所有` is sent.
- Do not change interruption retry limits, ownership rules, or final-reply detection.
- Do not create a new conversation or resend a continuation as part of this guard.

## 4. Requirements

- R1: The DOM query helper must handle an explicitly null scope without throwing; it returns an empty result for that scope.
- R2: The interrupted-turn path must still fall back to the document-level assistant status lookup and send the continuation in the bound conversation.
- R3: An ownership-mismatch reload state with a visible page-level interruption must not throw or trigger fresh-chat recovery.
- R4: Preserve existing same-conversation continuation, stop-before-send, ownership and route recovery behavior.
- R5: Bump userscript metadata/runtime to 2.9.70 and document the fix.

## 5. Current state

`nodes(selector, scope = document)` directly invokes `scope.querySelectorAll`. The default handles an omitted argument, but explicit `null` is possible during `latestTurn(task)` ownership mismatch. The interruption branch calls `nodes(..., turn.article)` before its document fallback, so the null exception prevents the fallback from running.

## 6. Target state

`nodes()` returns an empty array for a null/non-queryable explicit scope. The interruption branch then uses its existing document-level fallback to inspect the page, preserve the current route, and send the continuation as designed.

## 7. Architecture and ownership boundaries

The query helper remains a pure, local DOM utility. Missing scope does not broaden a scoped query into a document query; only call sites that already request document scope may inspect the whole page. Task ownership and conversation route remain enforced by `inspect()`.

## 8. Interfaces / contracts / schemas / data flow

No external interfaces or persisted schemas change. For `nodes(selector, scope)`, omitted `scope` still defaults to `document`; an explicit null scope yields `[]`.

## 9. Constraints and non-functional requirements

- Do not add polling or DOM scans.
- Keep recovery bounded and preserve the same conversation URL and task identity.

## 10. Failure modes and edge cases

- A null article during route hydration does not throw.
- The page-level fallback still sees an actual interruption notice.
- An absent interruption notice continues through ordinary loading/ownership handling.

## 11. Implementation strategy

1. Make the shared query helper return `[]` for a non-queryable explicit scope.
2. Add a regression reproducing a null owned article plus page-level interruption after reload.
3. Bump version metadata/runtime and README.
4. Run focused and full tests, syntax and diff checks.

## 12. Verification / test strategy

- Regression test asserts null scopes return no matches and do not throw.
- Integration regression asserts interrupted recovery sends once in the bound conversation despite `turn.article === null`.
- `node --check chatgpt-auto-confirm.user.js`
- `npm test`
- `git diff --check`

## 13. Acceptance criteria / Definition of Done

- AC-1: Null scoped lookup does not throw and does not silently search the document.
- AC-2: The reproduced interrupted-recovery case sends its continuation once and retains the original URL/token.
- AC-3: Full test suite passes and both version declarations report 2.9.70.

## 14. Release / migration / rollback

No storage migration. Rollback by reverting the implementation commit. Publish through the canonical verified PR → main test → automatic GitHub Release path.

## 15. Observability / evidence

The recovery path remains on the task's current conversation URL and does not record the null DOM error or fresh-chat handoff.

## 16. References / provenance

- Live Chrome conversation `https://chatgpt.com/c/6ab3a61d-3380-83e8-b847-0d94308d009f`, inspected 2026-09-23; transcript contains the sent continuation and the page currently shows `停止回答`.
- `docs/specs/active-assistant-suppresses-recovery-v2.9.69.md`

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 | passed | `nodes()` returns an empty list when an explicit scope has no `querySelectorAll`; it does not broaden that query to `document`. |
| R2–R4 | passed | New regression reproduces an ownership-mismatch `article: null` plus page-level interruption and verifies one continuation send with original URL/token/phase/round retained. Existing interruption tests remain in the full suite. |
| R5 | passed | Userscript metadata/runtime and README report 2.9.70. |
| AC-1–AC-3 | passed | `node --check`, `git diff --check`, and `npm test` passed; 204 tests, 197 passed, 7 skipped, 0 failed. The regression confirms one continuation send and retained task route/identity after the null-scope reload state. |
