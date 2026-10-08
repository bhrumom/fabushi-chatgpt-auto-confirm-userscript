# ChatGPT Work continuation offer: keep the existing Chat conversation — v2.10.36

Status: active
Owner: Fabushi ChatGPT Auto-confirm userscript
Date: 2026-10-08
Related specs: `force-chat-mode-before-send-v2.10.29.md`, `stop-disappeared-fresh-session-v2.9.97.md`, `live-approval-surface-stop-handoff-v2.10.14.md`, `connection-interruption-fresh-handoff-v2.10.25.md`

## 1. Context / problem

User-provided screenshot (2026-10-08 15:19, ChatGPT macOS UI) captures a first-turn product decision card after an assistant starts responding:

- card title: **在 ChatGPT Work 中继续**
- subtitle: `创建和编辑文档、使用应用并完成多步骤任务`
- button A: **留在聊天模式** with a decreasing countdown, e.g. `30`
- button B: **在 Work 中继续**
- ChatGPT's Stop button is no longer visible while the card awaits a decision.

The existing userscript prevents *pre-Send* Work mode through `ensureChatMode()`, but does not recognize this **post-Send, mid-response** product offer. `cards()` is only for connector authorization (Reject + Allow + arrow) and correctly does not match this UI. `inspect()` may consequently mistake the absent Stop / temporarily idle composer for a terminal no-final failure and invoke `queueInterruptedFreshRetry()`, abandoning the **healthy current conversation** before the user or Fabushi chooses Chat.

## 2. Goal

When a task-owned bound ChatGPT conversation displays this specific ChatGPT Work continuation offer, promptly click **留在聊天模式** / its supported English equivalent. Keep the exact existing conversation and supervise its response after the choice; do not classify the offer itself as connection interruption, Stop-disappearance end, abnormal no-final, or final completion.

## 3. Non-goals

- Never choose `在 Work 中继续` or automate Work for Fabushi tasks.
- No generic `button` click based solely on words "chat"/"work" or a timer.
- Do not transform a quoted screenshot, user/assistant markdown, task history, or Fabushi workbench controls into actionable card detection.
- No change to genuine connection errors, actual completed replies, server rate limits or connector authorization flow.
- Do not Send another user prompt or issue same-chat `继续完成所有` to resolve the offer.
- No local/Mac builds or test execution; GitHub Actions only.

## 4. Requirements

1. Detect the product card from **both semantic actions** (`留在聊天模式` with optional changing countdown; `在 Work 中继续`) plus the title `在 ChatGPT Work 中继续` within one small visible DOM container on the actual ChatGPT conversation main surface. Add narrowly scoped English equivalents; reject broad text matches.
2. Reject detached/hidden/inert cards; workbench-owned elements; user message bubbles, quoted/code blocks; controls outside current main conversation or in an unrelated navigation/form. Do not mistake textual references to the card for real actionable UI.
3. Require the current task's canonical conversation URL and ownership/foreign-task isolation before clicking. Never act for a paused/cancelled task, unbound ambiguous Send, or an unrelated tab/task.
4. Act promptly even if Stop is missing. Prioritize this card **before** generic unexpected-modal dismissal, connection-interrupted classification, Stop-disappearance/no-approval handoff, no-final recovery, route reload, and response finality. Connector authorization still takes precedence if both genuine cards are present.
5. Click **only** an enabled/visible Chat-stay action using existing safe `activateControl()` (pointerdown and click). Never click the Work action. If the Chat button is temporarily disabled/pending, hold the existing route and wait without mutating task state/round/token.
6. Bind click attempts to this task's exact URL, phase, round, token and goal revision. Bounded retries and a small cooldown avoid double-click thrash when the card remains visible or React hydrates it. If the card stays visible, keep waiting/recheck on subsequent supervision; no destructive fresh handoff merely because Stop is missing.
7. After the card disappears, keep a time-bounded settlement grace (30-45 s) for the same dispatch, excluding premature Stop-absent/no-final fresh handoff while ChatGPT resumes. Clear the latch on visibly resumed Stop or new valid response final; if the grace expires without either, resume ordinary bounded error recovery (not an infinite busy loop). Reset when phase/round/route/token changes or dispatch ends.
8. Preserve current conversation URL, token, original prompt, attachments, task identity, selected model/reasoning, round, and Work/Review phase when the offer appears and after clicking stay. Do not navigate to `/` or switch mode in the existing chat.
9. Keep task logs concise: first detection, Chat-stay click, optional retry; no repeated per-tick log growth. Existing two-hour log bounds remain.
10. Include regressions: live Chinese countdown 30→29; English labels; Stop initially visible then disappears while card appears; successful Chat action/removal then grace while Stop is absent; Stop resumes; non-actionable/disabled button remains pending; false positives (single button, quoted body, user bubble, workbench, sidebar, foreign conversation), no Work-button clicks, genuine connector authorization and true stop/no-final errors remain supported; exact HEAD CI.
11. Update userscript metadata/runtime/README and version regression assertions to **v2.10.36**. Publish only after PR-head Test, canonical-main Test and Release exact-source provenance pass.

## 5. Current state

`inspect(task, signal)` navigates/validates `task.url`, runs `dismissUnexpectedModals()`, takes `taskTurnForInspection()` and connector `cards()` snapshots; then handles interruption and Stop/no-final fresh handoffs. No ChatGPT Work continuation card detector exists, and the pre-send `ensureChatMode()` is not sufficient after a prompt was sent.

## 6. Target state

Exact bound task conversation
→ Work continuation offer with missing Stop appears
→ detect real titled two-choice card and verify task/route isolation
→ activate `留在聊天模式` only
→ keep same conversation and task dispatch; no Send/new chat
→ settlement while offer disappears
→ Stop reappears / response continues: normal inspection
→ normal genuine error recovery only if card is absent and settlement has elapsed.

## 7. Architecture / ownership

Existing single-tab runner and `inspect()` own the action. A narrowly scoped detector (`chatWorkContinueOffer()`) and task-bound offer supervisor (`handleChatWorkContinueOffer()`) are colocated with UI/card helpers. No new scheduler, browser-process actor, external dependency, or independent overlay writer. Connector approvals are still handled by `cards()` and `authorize()`. Route ownership remains enforced by the existing task supervisor.

## 8. Interface / data / persistence

- `chatWorkContinueOffer()` yields only a validated live product card with `stay`, `work`, `container` nodes.
- `handleChatWorkContinueOffer(task, signal, now)` returns `true` only when it has taken exclusive responsibility for the offer or its post-click settlement in the current bound conversation; inspection returns early in that case.
- Task-bound compact scalar fields: `chatWorkStayIdentity`, `chatWorkStayClickedAt`, `chatWorkStayLastAttemptAt`. No duplicate transcript storage. Reset on `clearDispatchIntent`, `finish`, and identity mismatch.
- `stopButton()` observed again terminates the settlement; the ordinary stop identity tracker then resumes.
- Pending action controls do not trigger a Send, navigation, or automatic Work mode.

## 9. Constraints

Use semantic button text/ARIA, limited ancestor walk and fast narrow scopes. Avoid full-response text scans and synthetic mouse movement. Preserve existing finality/permission guardrails. The actual native ChatGPT app screenshot establishes visible text/behavior; automated DOM fixtures, not an authenticated live Send, are used for regression.

## 10. Failure cases

- Countdown decreases; regex remains valid and no uncontrolled repeat clicks.
- Chat control disabled; preserve exact conversation and inspect until it becomes enabled.
- Card is dismissed/remounted; dispatch-bound latch covers transient Stop gaps.
- App opens Work automatically before the script can act; fail closed, never click `在 Work 中继续`; do not assert the Chat result without observability.
- Card absent on ordinary pages; original supervision behavior is unchanged.
- Foreign task/route or simulated quote; no action and no task mutation.
- Paused task; no automatic click.

## 11. Implementation strategy

1. Write Spec and branch off current main.
2. Add two-action+title detector and bounded settlement/click state in `inspect()` before generic popup processing.
3. Reset new state at dispatch/final transition; guard all destructive recovery while offer is owned.
4. Add focused JSDOM regression tests, README and version bump.
5. Require GitHub Actions exact-head evidence, review, merge, main Actions and Release checks.

## 12. Verification

Syntax check and `npm test` in GitHub Actions. Focused test asserts zero Work clicks, zero new conversation and exact-task invariants under Stop disappearance; negative fixtures guard against false positives; regression suite covers legacy authorization and true interruption behavior.

## 13. Acceptance criteria

AC1: On the screenshot card, a running task chooses `留在聊天模式` before any fresh-chat handoff.
AC2: URL/token/phase/round remain intact and task supervision continues within the same chat.
AC3: No false-positive click on quotes, unrelated page UI or Work.
AC4: Transient card removal + Stop gap is protected; eventual Stop/final or real recovery remains possible.
AC5: PR/main/release current-source CI and release asset digest all succeed.

## 14. Release / rollback

Backward-compatible task scalar fields, no migration. v2.10.36, rollback to v2.10.35 if detector proves incompatible. No production click on an active user task during development.

## 15. Observability / evidence

PR head SHA, Test workflow run/job, main exact SHA/Test, Release workflow, tag, asset bytes and SHA-256. Distinguish mocked DOM coverage from signed-in end-to-end evidence.

## 16. References

User screenshot in current request 2026-10-08 15:19. Canonical `main` at scope definition: `0f214678bfa04b25b1cba5f690f87226c050d734`. Source `chatgpt-auto-confirm.user.js`: `inspect()`, `stopButton()`, `cards()`, `dismissUnexpectedModals()`, `queueInterruptedFreshRetry()`, `clearDispatchIntent()`.

## 17. Spec compliance

| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R10 / AC1–AC4 | blocked | Implementation and exact-head tests pending |
| R11 / AC5 | blocked | PR/current-main CI, Release and digest pending |
