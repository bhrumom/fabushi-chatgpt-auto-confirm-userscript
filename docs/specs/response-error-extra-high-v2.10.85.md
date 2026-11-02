# Response error → Extra High continuation

Status: completed (implementation delivered in PR; not released or installed)
Owner: standalone Fabushi userscript
Last updated: 2026-11-02

## Context and goal
The supplied Chrome conversation ends in the native error “Hmm...something seems to have gone wrong.” while using Pro. The user requires selecting 极高 (Extra High), then sending exactly “继续完成所有” in the original conversation. Live manual recovery confirmed Extra High and a new generating response on the original route.

## Scope and requirements
- R1/AC1: Recognize the standalone native response error in the owned latest assistant response or page chrome. Exclude quoted/user/code/workbench content and older assistant errors.
- R2/AC2: Before ordinary abnormal-ended handoff, confirm no Stop, streaming, current authorization or settlement and the existing eight-second no-card window. A valid current final report retains precedence. Keep task identity, phase, round, route and attachments.
- R3/AC3: Select and confirm reasoning index 3 (Extra High), then send exactly “继续完成所有”. This recovery applies with either authorization-handoff setting and even after historical authorization; historical authorization does not imply a current pending card. Preserve the task's configured reasoning preference for future dispatches.
- R4/AC4: Reuse shared continuation boundary/click fencing and route-scoped three-send cap. Pause, aborted signal, foreign task/route, active generation, current cards/settlement, rate limit, unrelated drafts and unconfirmed reasoning prevent sending. Recheck after asynchronous model selection.

## Architecture and contracts
The composer adapter owns standalone error detection and reasoning selection. Inspection routes this precise error through the existing no-card confirmation gate and continuation sender with an explicit response-failure option. That option bypasses only historical-card and switch eligibility, never live safety guards. The sender requires the live error and owned turn, overrides the reasoning target for this operation, and uses existing durable continuation counters/boundaries. No new scheduler, task lifecycle or new-chat policy is introduced. Other interruption classes retain existing behavior.

## Failure modes / non-goals
Do not treat arbitrary prose or a stale prior error as failure. Missing picker or failed selection must wait rather than send under Pro. Do not change unrelated tasks or resume paused automation implicitly. Exhausted retries fall back to existing recovery. Updating Chrome's installed script is separate from source/Actions validation.

## Implementation and verification
Add narrow detector, optional reasoning target, guarded sender and inspection branch. Add regressions for Pro→Extra High→send ordering, both switch settings, historical/current cards, dedupe/reload, cap, draft/pause/Stop/foreign ownership and quoted errors. Run parity, syntax and complete regressions in Actions; local source concatenation only, following the existing recovery specifications. Integrate via a reviewable PR. Rollback reverts source, generated bundle and version together.

## Provenance and observability
User request and live Chrome route /c/6ae7f55e-b63c-83e8-a133-b14b2a8374db; related connection-interruption-continuation-v2.10.69.md and stalled-continuation-recovery-v2.10.70.md. Log the precise error recovery and confirmed model/prompt, without claiming downstream task completion.

## Spec compliance record
| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1 / AC1 | passed | Detector regressions reject quotations, user content, earlier turns and earlier assistant segments. Actions 41379425593 on 1394d3d76500f978c611104584f09ff11f16ebb1 passed. |
| R2 / AC2 | passed | Inspection regressions prove eight-second confirmation, resolved historical authorization and identity/round/route preservation. Existing live-card, final-report and generation regressions pass. |
| R3 / AC3 | passed | Both switch settings verify Pro → Extra High, menu closure, exact prompt and send ordering, while task.reasoningPreset remains Pro. Missing picker prevents send. |
| R4 / AC4 | passed | Reload dedupe, three-send cap, pause, Stop, abort, current card, foreign route, draft and model-selection card/draft/route races pass. Full suite: 648 tests, 641 passed, 7 skipped, 0 failed; parity and syntax passed. |

Validation: https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/41379425593
Delivery: https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/pull/203

The live manual recovery used the existing installed version: the native model menu read “Extra High，第 4 项，共 5 项”, then the exact user message mounted and “ChatGPT 正在回应”/Stop appeared. This proves the requested immediate action, not installation or runtime acceptance of the new automatic rule. PR source is not merged, released or installed. Subsequent compliance-only documentation does not change the tested runtime/bundle/tests.
