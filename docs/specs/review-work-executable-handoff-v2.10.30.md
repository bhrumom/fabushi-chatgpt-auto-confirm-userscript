# Review final output must be directly executable — v2.10.30

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Last updated: 2026-10-08
Related issue: 2026-10-08 user screenshot of Review wording copied into a Work conversation
Delivery: PR #148 (draft; not released)

## 1. Context / problem

Fabushi runs a Work -> independent Review -> Work loop for continuous goals. The Review result schema is `MAHAYANA_TASK_REPORT_V1` with `{taskId,round,status,summary,next}`. When a report says `status=next`, `finish()` stores its `next` value, and `workPrompt()` uses that value verbatim as the Work execution prompt. The Review prompt currently tells its author to `安排下一轮` and labels `next` as `下一轮的具体工作安排`. This language leads Review to write meta instructions such as `下一轮交由 Work 实施，本验收会话继续只读。第一步...`. The Work session then receives a reviewer's role narration as if it were its own instruction, can respond as a reviewer, and may fail to implement.

The user explicitly clarified on 2026-10-08: **fix the final output authored by the Review model; do not clean or transform it in the userscript after generation.** A previously drafted normalization design in this Spec was rejected and is superseded by this output-template-only design.

## 2. Goal

Require the independent Review session to compose its **final JSON itself** without role handoff or "future round" language. In `status=next`, `next` must contain the concrete steps an executing Work session can immediately perform. `summary` must state observed evidence and genuine remaining gaps, without session-routing instructions. `status=complete` keeps `next=""`. Preserve all real technical details and current `taskId` / `round` constraints.

## 3. Non-goals / out of scope

- **No** post-generation string deletion, rewrite, normalization, role inference or conversion of `report.next`.
- **No** `parseReview()` changes to reject particular phrases or require a new schema.
- **No** changes to `workPrompt()`, `finish()`, stored `task.next`, completed Work results, abnormal recovery carry, dispatch, or task routing.
- No forced rewrite of the user's original goal or previously persisted Review result.
- Work continues to execute; Review continues to inspect evidence only.
- Do not claim a prompt instruction guarantees model compliance without a real Review response.

## 4. Requirements

- R1: Modify only the Review instruction/template produced by `plannerPrompt()` to explicitly explain that the `next` JSON string will be sent **unchanged** to a Work executing conversation.
- R2: For `status=next`, require a concrete immediate action plan beginning with actions such as inspect current source / implement / fix / run GitHub Actions / submit commits / verify exact-HEAD evidence. Preserve exact repository refs, blockers and priority/order.
- R3: The authored final JSON **must not contain** self-referential Review statements, role assignments, scheduling/meta preambles or handoff instructions, including `下一轮`, `下轮`, `交回 Work`, `交由 Work`, `由 Work 实施`, `本验收会话`, `只读`, and `不要代替 Work`. This applies to `summary` and `next` and to all other human-readable text in the final reply. These forbidden examples may be quoted in the *instruction to the reviewer* but must never be copied into *the output*.
- R4: For `status=complete`, require concrete verifiable evidence and `next` equal to the empty string; do not claim completion based on the Work result's own assertions.
- R5: In the JSON schema example itself, replace `下一轮的具体工作安排` with a positive, directly executable `next` field description that has **no future-session/round wording**.
- R6: Preserve existing exact `taskId`, `round`, `status` identity checks and the existing protected JSON-only output format.
- R7: The Review must perform a self-check **before producing its final JSON** that `summary` is factual and `next` is actionable in the present execution context. It may silently revise its own answer, but must not print the self-check steps or role narration.
- R8: Do not ban genuine technical uses such as `验收证据`, `验收标准`, `CI gates`, `Review API` or references to code paths whose names resemble a forbidden term; the rule targets role/handoff prose in the final generated report.
- R9: Add regressions that inspect `plannerPrompt()` for its output-only requirements, direct-action schema hint, exact identity and JSON-only contract. Ensure execution prompt and parser behavior stay unchanged; explicitly avoid adding any runtime normalization.
- R10: Verify only via exact-HEAD GitHub Actions `Test`. Merge/publish only with current-HEAD tests, canonical-main Test and Release/tag/asset evidence.

## 5. Current state

At current main `529ebd44c501d5412748ed9037db9456e76af806` and pending PR #148 `5456c34f7e02a8abf46eb4d6bcffca883628d500`, `plannerPrompt()` asks the reviewer to `安排下一步` and presents `next` as `下一轮的具体工作安排`. `parseReview()`, `finish()` and `workPrompt()` pass the reviewer-authored `next` without rewriting it. The pass-through is intentional and **will remain unchanged**.

## 6. Target state

Review evaluates Work independently and produces JSON with factual `summary` and directly executable `next`. The Review model itself avoids all handoff and read-only-role wording in its **final output**. Existing `finish()` sends that verbatim `next` to the Work conversation without any transformation. The Review's actual factual judgment and technical steps are retained.

## 7. Architecture and ownership boundaries

`plannerPrompt()` is the sole changed runtime owner. The model, not the userscript runtime, is responsible for composing an appropriate final report. `parseReview()` validates the existing schema/identity; `finish()` and `workPrompt()` simply pass its contents along as before.

## 8. Interfaces / contracts / schemas / data flow

No interface, storage schema or task transition change. The fixed JSON report remains `MAHAYANA_TASK_REPORT_V1` with `{taskId, round, status, summary, next}`. Modify only natural-language authoring rules and the `next` example in `plannerPrompt()`.

## 9. Constraints and non-functional requirements

No text mutation on output; no client-side banned-word filter; no additional DOM scan. The prompt is clear in Chinese and protects raw technical evidence. Verification runs in GitHub Actions, not Mac/container. Existing tests about identity and phase changes must continue passing.

## 10. Failure modes and edge cases

- Screenshot: expected authored `next` starts with `第一步重新获取 main、tdesktop/dev、PR...；第二步修复...`, **not** a sentence allocating the task to Work.
- Review still describes its own limitations in prose: stronger final-output constraint asks the model to revise before emitting JSON.
- A genuine software symbol or acceptance-evidence task includes "review": not banned as technical subject.
- `status=complete`: no empty Work dispatch; `next=""`.
- Old persisted `task.next` was already generated with the prior prompt: intentionally **not** automatically sanitized.
- Prompt obedience is probabilistic: tests prove the authored Review contract, not guaranteed model compliance.

## 11. Implementation strategy

1. Reconcile this Spec to the corrected user requirement; **do not implement the abandoned postprocessing plan**.
2. Update only `plannerPrompt()` to impose final-output rules and demonstrate present-tense actionable content in `next` example.
3. Add focused contract tests; leave `parseReview()`, `finish()`, `workPrompt()` untouched.
4. Update v2.10.30 README and PR scope, and verify exact-HEAD GitHub Actions results.

## 12. Verification / test strategy

GitHub Actions Test: userscript syntax and full Node/JSDOM regression suite. Cover reviewer JSON-only identity, `next` direct-execution instruction, prohibited meta/role phrases across the whole final JSON, and no new runtime normalization hooks. Existing Review report parser, Review-to-Work lifecycle, carry and previous Work result tests must remain green.

## 13. Acceptance criteria / Definition of Done

- AC-1: The new `plannerPrompt()` instructs Review explicitly to **author** its final JSON without session-handoff/read-only narration and without future-round terminology.
- AC-2: The final-report schema `next` example contains direct implementation steps and no future-session wording; `summary` remains evidence-based, `status=complete` implies empty `next`.
- AC-3: The code does not sanitize, rewrite, or ban words in `report.next`; existing parsing/storage/prompt assembly unchanged.
- AC-4: Exact-HEAD GitHub Actions Test succeeds; only then consider merge, canonical-main Test, Release/tag/asset evidence. A real model-output recheck remains separate from static contract verification.

## 14. Release / migration / rollback

Include in existing draft PR #148 with v2.10.30 (main currently v2.10.29). No migration. Existing persisted Review results are unchanged. Roll back to v2.10.29 if necessary. Do not claim published until GitHub workflows and release asset confirm it.

## 15. Observability / evidence

Record PR head, current-head Test, main Test, Release and published version. The user screenshot is failure evidence, not proof that the prompt instructions achieve perfect model compliance.

## 16. References / provenance

- User screenshot and explicit correction, 2026-10-08.
- `AGENTS.md`, `docs/specs/spec-first-ai-development.md`.
- `chatgpt-auto-confirm.user.js` `plannerPrompt()`, `parseReview()`, `finish()`, `workPrompt()`.
- `docs/specs/review-final-result-recognition-v2.10.23.md`
- `docs/specs/previous-work-result-next-round-carry-v2.9.91.md`

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1–R9, AC-1–AC-3 | blocked | Reviewer-template patch and exact-HEAD tests pending. |
| R10, AC-4 | blocked | Current-head, main and Release evidence pending. |
| Live generated Review report compliance | blocked | Static contract tests cannot prove future model output. |
