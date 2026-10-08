# Content-independent authorization-card recognition — v2.10.38

Status: implementation
Owner: Fabushi ChatGPT auto-confirm
Last updated: 2026-10-08

## 1. Context / problem

v2.10.37 fixed a resume-time authorization miss by adding a semantic fallback around copy such as `允许 ChatGPT 使用 GitHub？`. That wording is only one observed connector card. Authorization cards can represent different connectors, tools, capabilities, locales, and product copy, so authorization presence must not depend on one title pattern or provider name.

The product requirement is broader: **if ChatGPT is showing an authorization / approval card, Fabushi must recognize that card before loading recovery, Stop-disappearance recovery, or Send logic continues.**

## 2. Goal

Make authorization-card **presence recognition content-independent**. Card detection should primarily use ChatGPT authorization-surface structure and approval-control topology, not connector names or title wording.

## 3. Non-goals

- Do not classify every ordinary `Allow` button on the page as authorization.
- Do not treat user/assistant transcript text, quoted examples, code, or Fabushi UI as a live authorization card.
- Do not weaken the existing conversation-scoped-only auto-approval policy.
- Do not select persistent/global authorization.
- Do not change reply ownership or final-answer attribution.

## 4. Requirements

- R1: Any visible explicit authorization/approval/permission card surface recognized through product DOM metadata must count as authorization presence regardless of its visible text or connector/provider name.
- R2: Structural metadata recognition must include the existing `approval-card` forms and generic approval/authorization/permission card test-id/class variants used by renderer revisions.
- R3: Outside an explicit authorization surface, a compact live product surface containing a real Allow/Approve control plus at least one independent approval-control signal — Reject/Deny or a split/options control — must count as authorization presence regardless of title wording.
- R4: A complete Reject + Allow + split/options cluster keeps the existing actionable-card behavior.
- R5: A partial structural authorization card (for example Allow + Reject while split menu is still hydrating, or Allow + split/options while Reject is remounting) counts as present but non-actionable.
- R6: If only one bare Allow button exists and there is no explicit authorization surface and no second approval-control signal, remain fail-closed against false positives; do not infer authorization from arbitrary page controls.
- R7: Title/copy matching may remain only as a compatibility hint. It must never be required for recognition of a structurally identifiable authorization card.
- R8: Resume-time exact-route scanning, pre-Send scanning, normal inspection, Stop-disappearance rechecks, and global auto-approval scans must all consume the same content-independent `cards()` presence result.
- R9: User/assistant transcript, blockquote, code, composer, navigation, and Fabushi-owned UI remain excluded from structural fallback.
- R10: Auto-approval still requires a safe actionable card and still selects only a conversation-scoped grant.
- R11: Non-actionable authorization presence keeps the exact conversation and reuses the existing same-route unavailable-authorization recovery; it must not produce a fresh-chat handoff or duplicate Send.
- R12: All tests/builds run only in GitHub Actions.

## 5. Current state

v2.10.37 recognizes:
- explicit `approval-card` / authorization / permission test-id surfaces;
- complete Reject + Allow + split-menu clusters;
- a classless partial surface only when nearby copy matches a narrow ChatGPT grant-title regex.

The third path is content-dependent and therefore incomplete.

## 6. Target state

Authorization detection has this precedence:

1. explicit renderer authorization-card metadata → present, independent of copy;
2. complete approval control cluster → present/actionable;
3. partial structural approval topology (Allow + Reject or Allow + split/options) on live product chrome → present/non-actionable;
4. optional semantic text compatibility fallback → present/non-actionable;
5. isolated ordinary Allow control → not authorization.

## 7. Architecture / ownership boundaries

`cards()` remains the single authorization-presence authority. All lifecycle paths call the same detector. Actionability remains a property of a detected card, not a prerequisite for presence.

## 8. Implementation strategy

1. Broaden explicit authorization surface selectors to content-independent approval/authorization/permission card metadata variants.
2. Add a structural partial-surface resolver around Allow/Approve controls.
3. Keep complete-card matching first so actionability behavior is unchanged.
4. Use partial structural evidence before semantic title matching.
5. Add regressions with arbitrary/non-GitHub titles and localized/random card copy.
6. Keep ordinary Allow false-positive tests and transcript exclusions.
7. Bump userscript/runtime/docs to v2.10.38.

## 9. Verification

GitHub Actions only.

Focused regression coverage must prove:
- an explicit authorization card with arbitrary title/provider copy is detected;
- an explicit authorization card with only an Allow control is still present/non-actionable;
- a classless card with arbitrary title and Allow + Reject is present/non-actionable;
- a classless card with arbitrary title and Allow + split/options is present/non-actionable;
- a complete arbitrary-title card remains actionable;
- ordinary isolated Allow, Reject+Allow without card topology, transcript examples, and unrelated dialogs remain excluded;
- resume and pre-Send paths recognize these generic authorization cards;
- existing approval settlement, same-route refresh, Stop-disappearance, foreign-route ownership, and conversation-scoped grant tests remain green.

## 10. Acceptance criteria

- AC-1: Recognition does not depend on `允许 ChatGPT 使用 GitHub？`, `Allow ChatGPT to use GitHub?`, connector name, or equivalent title text.
- AC-2: Any structurally identifiable ChatGPT authorization card blocks Send/destructive recovery immediately.
- AC-3: Partially hydrated authorization cards remain present but non-actionable.
- AC-4: Ordinary page controls and transcript content do not become authorization cards.
- AC-5: Existing conversation-scoped-only auto-approval safety is unchanged.
- AC-6: Exact-head GitHub Actions Test succeeds before integration.

## 11. Release / rollback

No persisted-state migration is required. Rollback is a normal revert of the structural detection extension, tests, docs, and version metadata.

## 12. References

- `docs/specs/resume-authorization-surface-presence-v2.10.37.md`
- `docs/specs/live-approval-surface-stop-handoff-v2.10.14.md`
- `docs/specs/partial-authorization-card-periodic-refresh-v2.10.28.md`
- User clarification, 2026-10-08: authorization-card recognition must not depend on one card's text.

## 13. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R12 | pending | Implementation and exact-head GitHub Actions evidence pending. |
| AC-1-AC-6 | pending | Implementation and exact-head GitHub Actions evidence pending. |
