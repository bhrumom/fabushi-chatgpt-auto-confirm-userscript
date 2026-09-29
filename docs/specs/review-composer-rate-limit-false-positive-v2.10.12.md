# Review composer request-frequency false positive v2.10.12 — Specification

Status: active
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-29
Related issue/task/PR: user-reported review/planning-session false request-frequency detection; PR pending

## 1. Context / problem

The standalone userscript can enter its five-minute request-frequency cooldown while it is preparing or recovering a planning/review session even though ChatGPT has not rendered a request-rate-limit notice.

The reported live state shows a planning/review prompt already present in the ChatGPT composer, while the visible ChatGPT page only shows the workspace quota banner ("工作空间额度已耗尽") and no request-frequency warning. The task log nevertheless repeatedly records "检测到 ChatGPT 请求过于频繁", waits five minutes, increments the episode count, and after the fourth episode abandons the current conversation for a fresh chat.

Current `pageUiTextRecords()` is intended to enumerate ChatGPT page-notice text. It excludes conversation messages and the Fabushi panel, but it still walks editable composer descendants. A review prompt embeds the full Work result and abnormal handoff context, so user-authored prompt text can itself contain phrases such as "请求过于频繁". `rateLimitNotice()` can then misclassify that draft text as ChatGPT chrome/status UI. Work sessions are less likely to contain that phrase because their prompt does not embed the previous Work result in the same way.

## 2. Goal

Make request-frequency detection provenance-safe: text authored or injected into the ChatGPT composer must never count as a ChatGPT page-level rate-limit notice, while genuine visible ChatGPT request-rate-limit notices must continue to trigger the existing cooldown/recovery behavior.

## 3. Non-goals / out of scope

- Do not remove the genuine request-rate-limit cooldown, episode counter, or fourth-episode fresh-chat recovery.
- Do not change the separate history-only access-throttle popup handling except to preserve it.
- Do not treat the workspace quota / auto-recharge banner as a request-rate-limit event.
- Do not alter Work/review task identity, prompt contents, attachments, final-reply recognition, or abnormal-session carry semantics.
- Do not use private ChatGPT APIs or network interception.
- Do not run tests or builds locally; verification is GitHub Actions only.

## 4. Requirements

- R1: `pageUiTextRecords()` must exclude user-authored editable composer/input surfaces from page-notice records.
- R2: The exclusion must cover the live ChatGPT editor variants used by this userscript: `#prompt-textarea`, `textarea`, `input`, `[contenteditable="true"]`, and `[role="textbox"]`.
- R3: A planning/review draft containing "请求过于频繁", "too many requests", or equivalent rate-limit wording must not make `rateLimitNotice()` return a rate-limit notice.
- R4: A genuine visible ChatGPT page-level alert/status/dialog containing request-rate-limit wording outside user-authored input must still be detected.
- R5: The existing history-only request-frequency popup remains non-blocking, is acknowledged when possible, and does not enter request cooldown.
- R6: The visible workspace quota/auto-recharge banner remains unrelated to request-rate-limit detection.
- R7: False composer text must not increment `rateLimitEpisodes`, set `cooldownUntil`, or force a new chat.
- R8: Add a deterministic regression test reproducing the review-composer condition and a positive-control real alert.
- R9: Bump userscript metadata and runtime version together to `2.10.12`.
- R10: Run syntax and regression verification only through the repository GitHub Actions `Test` workflow.

## 5. Current state

Canonical `main` at discovery time is `7c5b0d1f90e4f111448b03ceb21e0b1aaed17de7`, userscript v2.10.11.

`pageUiTextRecords()` rejects Fabushi-owned subtrees, conversation-role subtrees, blockquotes, `pre`, and `code`, but it does not reject the ChatGPT composer. `rateLimitNotice()` trusts matching visible records from that source unless they belong to the separately recognized history-only access-throttle popup.

## 6. Target state

The page-notice scanner has a clear provenance boundary:

```text
ChatGPT chrome/status/dialog text
        │
        ├─ visible + outside transcript + outside Fabushi + outside authored inputs
        ▼
 pageUiTextRecords()
        ▼
 rateLimitNotice()/other notice consumers

ChatGPT composer / textarea / contenteditable / textbox
        └────────────── excluded at scan boundary
```

This makes review and Work behavior consistent even when their prompt text contains error phrases.

## 7. Architecture and ownership boundaries

- Notice provenance owner: `pageUiTextRecords()`.
- Request-frequency classification owner: `rateLimitNotice()`.
- History-only popup exception owner: `historyAccessThrottleContainer()` / `historyAccessThrottlePopup()`.
- Cooldown/recovery owner: `restForRateLimit()`; its genuine-rate-limit behavior remains unchanged.
- Regression owner: `test/workbench.test.mjs`.
- Verification owner: `.github/workflows/test.yml`.

The fix belongs at the shared page-notice scan boundary rather than adding a review-only exception, because user-authored editable text is not system notice provenance for any phase.

## 8. Interfaces / contracts / schemas / data flow

No persisted schema or public API changes.

Internal contract change:

`pageUiTextRecords()` returns visible page-level text records only after rejecting:
1. Fabushi-owned UI,
2. conversation-role/quoted/code content,
3. editable user-authored input/composer descendants.

`rateLimitNotice()` continues to consume that function without phase-specific knowledge.

## 9. Constraints and non-functional requirements

- Fail closed against false automation triggers: user-authored prompt text must not be interpreted as ChatGPT system state.
- Preserve genuine request-rate-limit handling.
- Keep traversal bounded and avoid additional whole-page text flattening.
- The new exclusion should reduce, not increase, scanner work.
- No local tests/builds; GitHub Actions only.
- Preserve the stable raw `@updateURL` / `@downloadURL` release path.

## 10. Failure modes and edge cases

- Review prompt quotes prior logs that say "请求过于频繁": ignored because it is authored composer content.
- Contenteditable descendants are nested several levels deep: the subtree is rejected at the editable root; text descendants never become page records.
- Textarea/input renderer variant: excluded.
- ARIA textbox renderer variant without `contenteditable=true`: excluded.
- Real `role=alert` outside composer: still detected.
- History-only request-frequency popup: still ignored by `rateLimitNotice()` and acknowledged by modal cleanup.
- Workspace quota banner: still not matched by request-rate-limit wording.
- Fabushi log says "检测到 ChatGPT 请求过于频繁": remains excluded by `own()`.

## 11. Implementation strategy

1. Add one shared selector/guard for user-authored editable surfaces near the page UI scanner.
2. Reject those element subtrees in `pageUiTextRecords()` and defensively reject text records whose parent is inside such a surface.
3. Add a regression fixture with a review-like composer draft containing request-frequency wording plus the workspace quota banner; assert no rate-limit detection and no cooldown mutation.
4. Add a positive-control real ChatGPT alert outside the composer; assert detection remains active.
5. Bump metadata/runtime version to v2.10.12.
6. Push through a PR and use GitHub Actions `Test` as the only syntax/regression gate.
7. Merge only after PR Test succeeds; then verify canonical-main Test and the automatic Release workflow.

## 12. Verification / test strategy

GitHub Actions only:

- `node --check chatgpt-auto-confirm.user.js` via `Test`.
- `npm test` via `Test`.
- Regression asserts review-composer text cannot trigger `rateLimitNotice()`.
- Regression asserts a real external alert still triggers.
- Regression asserts the false-positive fixture leaves `cooldownUntil == 0` and `rateLimitEpisodes == 0`.
- Existing history-only, plugin-log/conversation-text, quota-banner, genuine rate-limit cooldown, and fourth-episode recovery tests remain green.
- After merge: canonical-main `Test` must succeed, then `Release` must publish v2.10.12.

## 13. Acceptance criteria / Definition of Done

- AC-1: The reported review/planning composer condition does not enter request cooldown.
- AC-2: A review draft can literally contain "请求过于频繁" without becoming system-state evidence.
- AC-3: Genuine visible page-level request-rate-limit UI still enters the existing cooldown path.
- AC-4: Existing history-only popup and quota-banner behavior remains correct.
- AC-5: PR exact-head GitHub Actions Test is green.
- AC-6: Canonical-main GitHub Actions Test is green after merge.
- AC-7: GitHub Release v2.10.12 is created from the tested canonical source with `chatgpt-auto-confirm.user.js`.

## 14. Release / migration / rollback

No persisted-state migration is required. Existing false `cooldownUntil` values naturally expire; once v2.10.12 is loaded, the unchanged scanner will no longer re-arm them from composer text.

Release follows the repository `workflow_run` release gate: only a successful canonical-main Test can publish the versioned asset. Rollback is a normal revert to v2.10.11 behavior, although doing so would reintroduce this false-positive condition.

## 15. Observability / evidence

Record:
- exact implementation commit / PR head,
- PR Test run and conclusion,
- merge SHA,
- canonical-main Test run,
- Release workflow run,
- v2.10.12 release/tag/asset readback.

## 16. References / provenance

- User screenshots and task log from 2026-09-29 showing a populated review composer, workspace quota banner, no visible request-frequency warning, and repeated five-minute false cooldowns.
- `AGENTS.md`
- `docs/specs/spec-first-ai-development.md`
- `docs/specs/tested-github-release-delivery.md`
- `chatgpt-auto-confirm.user.js`: `pageUiTextRecords()`, `rateLimitNotice()`, `plannerPrompt()`, `restForRateLimit()`
- `test/workbench.test.mjs`: existing rate-limit/history-popup/quota tests

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1–R10 | blocked | Implementation and GitHub Actions evidence pending on the feature branch. |
| AC-1–AC-4 | blocked | Regression implementation/verification pending. |
| AC-5 | blocked | PR exact-head Test pending. |
| AC-6 | blocked | Canonical-main Test requires merge after PR gate. |
| AC-7 | blocked | v2.10.12 Release requires canonical-main Test success. |
