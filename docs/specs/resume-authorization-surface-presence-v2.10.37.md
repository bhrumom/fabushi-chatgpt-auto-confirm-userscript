# Resume authorization-surface presence and fail-closed recovery — v2.10.37

Status: implementation
Owner: Fabushi ChatGPT auto-confirm
Last updated: 2026-10-08

## 1. Context / problem

A paused Fabushi task can be resumed on its exact already-bound ChatGPT conversation while a connector authorization surface is visibly present. The reported production state shows the GitHub grant prompt on screen, but the task resumes into loading/send recovery and later logs that Send is unavailable instead of entering authorization handling.

The existing authorization detector still equates "authorization exists" with the complete legacy three-control structure (Reject + Allow/Allow once + split-menu) inside one of its known scopes. ChatGPT can now expose a valid authorization surface before that entire control cluster is discoverable, or in a surface whose class/test-id no longer matches the old approval selectors. This means a visible authorization can be misclassified as absent.

## 2. Goal

Separate authorization **presence** from authorization **actionability** so resume, inspection, and pre-Send recovery fail closed whenever a trustworthy connector grant surface is already visible.

## 3. Non-goals

- Do not broaden automatic authorization beyond the existing conversation-scoped grant.
- Do not select persistent/global authorization.
- Do not infer final-reply ownership from a route-only authorization surface.
- Do not treat quoted authorization wording inside user/assistant transcript content as a live authorization card.
- Do not change genuine connection-interruption or Stop-disappearance recovery once authorization is proven absent.

## 4. Requirements

- R1: Preserve the existing structural authorization detector for fully actionable cards.
- R2: Add a strong semantic authorization-surface detector for live UI that combines:
  - an actual Allow/Allow once control; and
  - nearby surface copy matching a ChatGPT connector grant title such as `允许 ChatGPT 使用 GitHub？` or `Allow ChatGPT to use GitHub?`.
- R3: Semantic discovery must ignore controls inside ordinary user/assistant transcript content, blockquotes, code, the composer, and Fabushi-owned UI.
- R4: A trusted explicit/semantic authorization surface counts as **present** even if Reject or the split-menu trigger is temporarily missing. Such a card is non-actionable, remains on the same conversation, and participates in the existing unavailable-authorization recovery rather than being treated as absent.
- R5: If the full Reject + Allow + split-menu cluster is present, existing actionability and conversation-scoped authorization behavior remain unchanged.
- R6: When explicitly resuming a paused task on its exact bound route, immediately perform a wide authorization presence scan. If a trusted authorization surface is already visible and no competing task owns the route, restore directly into `approval` state instead of loading/send recovery.
- R7: Before any fresh-root Send, use the wide authorization presence scan. A trusted partial authorization surface must block Send before model/reasoning/attachment/send-button work.
- R8: Existing exact-route ownership boundaries remain fail closed: a foreign task marker or competing route owner prevents task-specific resume attribution.
- R9: Auto-approval disabled still waits for the user without clicking or periodic refresh.
- R10: Auto-approval enabled reuses the existing 60-second same-route unavailable-authorization recovery for trusted partial surfaces; it never escalates solely because the authorization controls are incomplete.
- R11: Existing Stop-disappearance wide recheck and 8-second no-approval confirmation remain unchanged.
- R12: All verification runs only in GitHub Actions; no local build/test is used.

## 5. Current state

`authorizationCardScopes()` knows approval-card selectors, dialogs, recent turns, and bounded siblings. `cards()` only returns a card after finding Allow plus Reject plus an approval arrow inside one container. Therefore an authorization title + Allow control with a changed wrapper or temporarily incomplete sibling controls is indistinguishable from no authorization.

`restorePausedTask()` restores task state and identity but does not immediately classify a visible authorization surface. `send()` performs only the normal `cards()` check.

## 6. Target state

Authorization discovery has two layers:

1. **presence:** explicit approval surface or strong semantic grant surface with a real Allow control;
2. **actionability:** complete safe Reject + Allow + split-menu structure and enabled controls.

Presence blocks destructive/send paths. Actionability alone permits the existing safe automatic conversation-scoped grant flow.

## 7. Architecture / ownership boundaries

The detector remains entirely inside the userscript. Route ownership is still decided by canonical task URL, task markers, and competing route owners. Semantic authorization detection never promotes assistant content to owned/final content.

## 8. Implementation strategy

1. Add semantic grant-title matching and discover nearby bounded authorization containers from live Allow controls.
2. Mark explicit/semantic scopes as trusted authorization surfaces.
3. Let `cards()` return a non-actionable partial card for trusted surfaces when the complete structural cluster is not yet available.
4. Add resume-time exact-route wide authorization classification.
5. Use wide authorization presence checking at the pre-Send boundary.
6. Add focused regressions for semantic partial presence, transcript false positives, immediate resume classification, and pre-Send blocking.
7. Bump userscript/runtime/docs to v2.10.37.

## 9. Verification

GitHub Actions only.

Focused regression coverage must prove:

- a classless live-style `允许 ChatGPT 使用 GitHub？` + `允许一次` surface is detected even before Reject/split-menu is available;
- the same partial surface is returned as non-actionable;
- quoted/assistant transcript text cannot synthesize an authorization surface;
- a paused exact-route task restores directly to `approval` when that surface is already visible;
- a fresh-root Send is rejected while a trusted partial authorization surface exists;
- existing complete-card, disabled-card, marker-virtualized, Stop-disappearance, settlement, and 60-second refresh regressions remain green.

## 10. Acceptance criteria

- AC-1: The reported resume state cannot progress into send-button recovery while the visible GitHub authorization surface is present.
- AC-2: Authorization presence no longer depends on the complete three-control cluster.
- AC-3: Missing/disabled authorization controls retain the same conversation and are non-actionable.
- AC-4: Resume detects a currently visible authorization immediately on the exact bound route.
- AC-5: Pre-Send detection fails closed on the same trusted authorization presence.
- AC-6: Transcript/ordinary Allow UI does not become an authorization card.
- AC-7: Existing conversation-scoped-only authorization safety remains intact.
- AC-8: Exact-head GitHub Actions Test succeeds before integration.

## 11. Release / rollback

No persisted-state migration is required. Rollback is a normal revert of the semantic presence layer, resume classification, pre-Send wide guard, tests, and v2.10.37 metadata.

## 12. References

- `docs/specs/resume-visible-approval-card.md`
- `docs/specs/live-approval-surface-stop-handoff-v2.10.14.md`
- `docs/specs/partial-authorization-card-periodic-refresh-v2.10.28.md`
- User-provided production screenshot, 2026-10-08.

## 13. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R12 | pending | Implementation and exact-head GitHub Actions evidence pending. |
| AC-1-AC-8 | pending | Implementation and exact-head GitHub Actions evidence pending. |
