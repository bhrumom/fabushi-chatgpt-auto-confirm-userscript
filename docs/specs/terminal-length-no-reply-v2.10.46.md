# Terminal conversation length limit without reply — Specification

Status: active
Owner: Fabushi userscript
Last updated: 2026-10-11
Related task: user Chrome recovery conversation 6acb3614-8e9c-83e8-9148-f6bf0a561fef

## 1. Context / problem
ChatGPT displays stopped thinking, a conversation length limit and Start new chat, without an assistant body. The current carry-required policy waits forever.
## 2. Goal
Continue the same task in a fresh conversation when the current conversation is explicitly exhausted even without new assistant work.
## 3. Non-goals
No Desktop migration, fabricated assistant result, or general notice-only recovery.
## 4. Requirements
- R1: An exact bound route with no competing task and a current owned user boundary (or unambiguous virtualized route fallback), a visible product Start new chat CTA and length notice may hand off without assistant content.
- R2: Active Stop, streaming, approvals, blockers, rate limits, attempted sends, paused tasks, foreign/newer user boundaries must prevent this fallback. Genuine completed owned replies retain normal Review precedence over stale chrome notices.
- R3: Preserve goal, next instruction, phase, round, attachments and prior recovery context; clear only dispatch identity. No new result or round completion. Do not describe absent output as an assistant reply.
- R4: Queue once; repeated inspection cannot queue another hop on the old route after dispatch is cleared.
## 5. Current state
main 5777c58960c83835d3c16d5abc3d3ffd40857e9c, v2.10.45.
## 6. Target state
v2.10.46 with a narrowly guarded no-reply terminal handoff before inherited hydration gates.
## 7. Architecture and ownership
Canonical userscript only. Existing transcript extractor and dispatcher remain authoritative.
## 8. Contracts
Add a no-reply handoff flag to distinguish retained prior carry from new assistant output. Normal transcript handoff clears this flag.
## 9. Constraints
Actions-only tests/build verification per current completed-reply spec. Source concatenation for generated bundle is permitted.
## 10. Edge cases
Generic notice without CTA still waits. User-quoted CTAs are excluded. Foreign route/marker waits. No response must not overwrite earlier carry.
## 11. Strategy
Terminal ownership helper, early no-body branch, preserve context and honest prompt/log, DOM regression tests.
## 12. Verification
GitHub Actions full suite and generated-source check; real Chrome module update and original task transition if available.
## 13. Acceptance criteria
- AC1: stopped-thinking + terminal notice + CTA with no reply queues same phase and round once, including Review.
- AC2: guard and stale-final regressions pass.
- AC3: prior carry and task inputs survive, prompt does not claim a new reply.
- AC4: release and installed module use verified v2.10.46.
## 14. Release / rollback
Publish through main Test/Release. Roll back module to v2.10.45 if necessary.
## 15. Evidence
PR Actions and Chrome visible module/task status.
## 16. References
Supersedes current-response-length-handoff-v2.9.71 R4/AC3 only for explicit terminal CTA with no new reply. completed-reply-review-paced-picker-v2.10.39 final precedence and guards remain.
## 17. Compliance
Pending verification; record final evidence after Actions.
