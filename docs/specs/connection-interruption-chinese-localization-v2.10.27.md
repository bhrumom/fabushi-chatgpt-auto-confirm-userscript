# Chinese connection-interruption localization — v2.10.27

Status: completed
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-10-02
Base: `ef6a482cddbd0edd5890c0c902481a9e63cc6647` (main, v2.10.26)
Related live incident: ChatGPT Chinese UI displayed `连接已中断，正在等待完整答复`, while the userscript recognized the English interruption notice and an older Chinese wording using `完整回复`.

## 1. Problem

The connection-interruption recovery path is intentionally strict because it can abandon the current conversation and open a fresh handoff after the authorization-safety gate.

Current v2.10.26 recognizes the older Chinese product wording:

- `连接已中断。正在等待完整回复。`
- punctuation-equivalent variants using `完整回复`

The current ChatGPT Chinese UI can instead render:

- `连接已中断，正在等待完整答复`

Because the detector requires the whole standalone product notice to match, `答复` is not currently accepted and the abnormal-interruption handoff does not start for that localized UI.

The carry cleaner has the same vocabulary gap, so simply broadening detection without broadening cleanup could copy the product banner into the next recovery prompt.

## 2. Goal

Recognize the observed Chinese interruption notice with `完整答复` with the same semantics and safety gates as the already-supported English and Chinese `完整回复` variants.

Detection and carry cleanup must use the same narrow notice grammar so a recognized product banner is not preserved as work context.

## 3. Non-goals

- Do not broaden interruption detection to arbitrary text containing `连接` or `中断`.
- Do not treat user quotations, assistant discussion, code/blockquote examples, or Fabushi workbench text as product notices.
- Do not change the authorization settlement latch or the two-scan destructive handoff gate.
- Do not change generic stall, rate-limit, conversation-load, attachment, Review, or final-reply policy.
- Do not run tests/builds locally.

## 4. Detection contract

The simplified-Chinese product notice is actionable only when the existing ownership/safety boundaries pass and the standalone normalized text matches:

- prefix: `连接已中断`
- separator: Chinese/ASCII punctuation and/or whitespace
- suffix: `正在等待完整回复` or `正在等待完整答复`
- optional terminal punctuation

The existing English grammar remains accepted:

- `Connection interrupted. Waiting for the complete answer`
- existing `full/complete response/answer` equivalents already supported by v2.10.26

The detector remains anchored to the complete normalized notice.

## 5. Recovery behavior

When the new Chinese wording is detected, behavior is identical to the existing connection-interruption policy in `connection-interruption-fresh-handoff-v2.10.25.md`:

1. remain on the exact current task conversation;
2. check for approval/authorization surfaces;
3. if absent, start the existing >=8-second no-approval confirmation;
4. scan again;
5. only after the second empty scan, preserve attributable visible work and queue a fresh conversation for the same task/phase/round;
6. never click Stop and never send the legacy continuation phrase in the broken conversation.

The interruption banner itself must be removed from carried assistant/work text.

## 6. Implementation strategy

- Extend `connectionInterruptedPattern` to accept `完整答复` while retaining `完整回复`.
- Keep punctuation handling narrow but compatible with the observed comma form.
- Extend `cleanAbnormalFreshReply()` with the same Chinese vocabulary.
- Align the English carry-cleaning expression with the detector's existing `full|complete` + `response|answer` grammar.
- Bump metadata/runtime/README version to `2.10.27`.

## 7. Regression requirements

Exact-head GitHub Actions must prove at least:

1. `连接已中断，正在等待完整答复` is recognized as page chrome.
2. The same observed wording is recognized in the current owned assistant response.
3. The older `连接已中断。正在等待完整回复。` wording remains recognized.
4. A user quotation of the new wording does not trigger interruption recovery.
5. A longer assistant discussion/blockquote containing the wording does not trigger.
6. A real fresh-handoff path using the new wording starts the existing authorization-safe confirmation and then queues a fresh chat without clicking Stop or sending in the old conversation.
7. Carried visible work excludes the new localized interruption banner.
8. Existing English coverage remains green.

## 8. Version and delivery

- Version: `2.10.27`.
- Verification authority: GitHub Actions or htch-runtime only.
- Exact PR HEAD Test must succeed before merge.
- After merge, canonical-main Test and Release workflows must succeed.
- Published release must contain the tested `chatgpt-auto-confirm.user.js`.

## 9. Acceptance criteria

- AC-1: The live screenshot wording `连接已中断，正在等待完整答复` triggers the same abnormal-interruption recovery as English.
- AC-2: Existing `完整回复` detection does not regress.
- AC-3: Quote/discussion false-positive boundaries remain intact.
- AC-4: Recovery carry excludes the localized status banner.
- AC-5: No authorization-safety or handoff semantics are weakened.
- AC-6: Exact-head PR CI, canonical-main CI, and release evidence are recorded before delivery is claimed.

## 10. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| Detection + cleanup implementation | passed | PR #144 final head `2884d30833dfefc24323a4fbbbb4b86271776590` was exact-head verified and squash-merged as canonical main `79f6af0568097acd2c7c6feaebfd23ac52c99079`; runtime/README are v2.10.27. |
| Regression coverage | passed | Final PR-head Test run `37004431583` succeeded for `2884d30833dfefc24323a4fbbbb4b86271776590`; canonical-main Test run `37004516855` succeeded for merge `79f6af0568097acd2c7c6feaebfd23ac52c99079`. |
| Authorization/handoff invariants | passed | Both exact-head suites passed the existing authorization-safe interruption coverage plus the new `完整答复` detection, false-positive and fresh-handoff/carry-cleaning regressions. |
| Canonical-main + release delivery | passed | Release run `37004583260` succeeded after canonical-main Test. GitHub Release `v2.10.27` targets `79f6af0568097acd2c7c6feaebfd23ac52c99079` and contains `chatgpt-auto-confirm.user.js` (449323 bytes, `sha256:8591fa8489b42970d0e0743673743be8872d508965d0e867c85e9fee89537405`). |
