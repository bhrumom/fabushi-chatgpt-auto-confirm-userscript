# Memory-pressure same-tab recovery and same-chat continuation cap

Status: active
Owner: Fabushi ChatGPT auto-confirm userscript
Last updated: 2026-09-25
Related task: user screenshot showing JS heap above 1 GiB and unavailable host recovery

## 1. Context / problem

The userscript can estimate only the page's V8 JS heap. At repeated samples above 1 GiB it asks the extension host to discard the tab, but Chrome refuses to discard the active tab and the host bridge may not answer. Reloading the exact current conversation in the same tab unloads the current document and lets the persisted workspace recover without a second tab or a cross-tab ownership race.

Separately, an ended bound conversation can send `继续完成所有` repeatedly without a per-session cap. Existing `continuationCount` is reset by `clearDispatchIntent()`, so a fresh-session handoff naturally starts a new count.

## 2. Goal

When a recoverable current task's JS-heap estimate remains at least 1 GiB, reload the exact current task conversation in the same tab after persisting its workspace/dispatch identity. Never automatically reload the same conversation route more than once: long-chat hydration can recreate the same heap pressure, so repeated same-route reloads would worsen the incident rather than recover it. In any one bound conversation, send at most three `继续完成所有` messages; before a fourth send, capture visible assistant work and queue a fresh conversation with that carry.

## 3. Non-goals

- Do not claim the V8 JS-heap estimate equals Chrome's full renderer/tab RSS.
- Do not create a duplicate tab for memory recovery or navigate away from the task's exact conversation.
- Do not reload while an unsaved ChatGPT draft, pending local attachment upload, active script send/upload, approval, or ambiguous route exists.
- Do not click Retry or send a fourth continuation in the old conversation.
- Do not copy other tasks, user messages, hidden content, or timeout/status notices into the carried work.

## 4. Requirements

- R1: At >=1 GiB sustained over two samples, the userscript may reload in place only when one unique task owns the exact live `/c/<id>` route, auto-resume is enabled, and there is no draft, pending local file/upload, approval, send, or navigation transition.
- R2: Before reload, persist the exact task/workspace/dispatch identity and a recoverable heartbeat; do not create another tab or send task contents to the extension host.
- R3: After same-tab reload, reclaim the persisted workspace and resume the same task, phase, round, dispatch token, conversation, and attachment metadata without duplicate sending.
- R4: When the host bridge is absent or times out, distinguish that from the page's heap estimate and use the same-tab reload path rather than claiming host reclamation.
- R5: A bound session may issue at most 3 successful `继续完成所有` sends. Before a fourth attempt, capture visible current assistant work, strip status notices, queue a new conversation for the same task/phase/round, and preserve goal/next/attachments.
- R6: The new conversation resets its per-session continuation count to zero through the existing dispatch reset.
- R7: Add userscript regressions for threshold, same-tab persisted reload, continuation cap/carry, and under-threshold/unsafe/final cases.
- R8: Persist the conversation URL on a memory-pressure reload and refuse another automatic reload of that same task route even after the ordinary cooldown; a different bound route may be evaluated independently.
- R9: Make repeated memory-recovery refusal observable as “already reloaded this conversation” rather than reporting a generic cooldown/failure.

## 5. Architecture / ownership

The userscript owns task/turn identity, JS heap sampling, persistence, and safety context. The same-tab browser reload unloads the current document; existing localStorage, recovery heartbeat, and Web Locks protect unique task ownership. No host bridge or cross-tab task transfer is needed for automatic memory recovery.

## 6. Data flow / contracts

Repeated >=1 GiB samples → validate one safe exact-route task → persist waiting state, recovery ticket/heartbeat and reload timestamp → reload the same conversation URL in place → new document reclaims the workspace lock and resumes.

Continuation count reaches 3 → reject a fourth same-chat send → visible assistant transcript extraction → strip status text → persist phase/round-bound `abnormalFreshCarry` → clear old dispatch and reset count → fresh Work prompt carries current instruction, previous work and original goal.

## 7. Failure modes / safeguards

- Missing content script or stopped service worker is a host-bridge failure; same-tab reload must not rely on that bridge.
- Draft, unsaved attachments, active send/upload/approval, paused task, non-unique task, or route mismatch blocks memory reload.
- Reload rejection leaves the current task intact and retries only after a bounded cooldown; a successfully submitted memory reload is a one-attempt-per-conversation action, not a periodic refresh loop.
- Same-tab reload must release/reacquire its Web Lock through existing lifecycle hooks; it must never open a parallel workspace.
- A final reply or authorization route must be processed before continuation-cap handoff; completion and approval classification keep priority.
- A reply without safely attributable visible assistant work may be handed off only if existing carry policy can prove task/route ownership; otherwise retain safe wait behavior rather than fabricate context.

## 8. Verification / acceptance

- Unit tests assert the exact threshold, two-sample trigger, persisted same-tab reload state, and explicit host-unavailable reporting.
- DOM tests assert first three continuation sends occur in the old URL; the next continuation condition queues a fresh URL and carries work without error/status text; phase/round/attachments persist and count resets.
- Existing task ownership, final reply, authorization, user draft, attachment, and workspace lock tests stay green.
- Run repository tests and syntax/diff checks. Release/integration occurs only through the canonical-main workflow; live Chrome verification remains separate acceptance.

## 9. Spec compliance record

| Requirement | Status | Evidence |
|---|---|---|
| R1-R4 | implemented | `memoryReloadSafety()` + `reloadTaskForMemoryPressure()` persist the exact task and recovery heartbeat before same-tab reload; regression covers safe same-route reload and no-task refusal. |
| R5-R6 | implemented | `sendContinuation()` rejects attempt 4, captures owned assistant work, strips timeout/status text, and queues the same task with dispatch count reset. |
| R7 | released; live acceptance pending | `npm test`: 220 total, 213 passed, 0 failed, 7 skipped; syntax check and `git diff --check` pass. Canonical-main Test run [36090932461](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36090932461) and automatic Release run [36090980390](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36090980390) succeeded for v2.9.77. Real Chrome reload/resume still needs live acceptance. |
| R8-R9 | released; live acceptance pending | `memoryPressureReloadURL` is persisted per task and blocks a second same-route reload; `sustained heap pressure never reloads the same conversation route repeatedly` verifies the refusal after simulated same-document recovery. Full suite: 220 total, 213 passed, 0 failed, 7 skipped; exact-source GitHub Test run [36093974738](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36093974738) succeeded. [v2.9.78 Release](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/tag/v2.9.78), asset SHA-256 `43240530a14083d758594c117ec012786f02656aea8e78155cf9db14913c38b4`. Live Chrome reload/resume and performance acceptance remain pending. |
