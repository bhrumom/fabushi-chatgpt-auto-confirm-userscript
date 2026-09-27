# Reload hydration gate and durable reply carry — v2.9.98

Status: completed  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-27  
Related incident: a refreshed ChatGPT conversation temporarily has no Stop control, causing an immediate false fresh-session handoff; the replacement prompt can also lose the old page's assistant reply and repeat the same task text.

## 1. Context / problem

v2.9.97 persists that a task dispatch has observed ChatGPT's Stop control. This correctly survives a same-tab reload, but the new document initially hydrates in stages. For several seconds after a reload, the conversation route and task state can be restored before the Stop control is mounted. The current detector sees the persisted Stop-observed identity plus a temporarily absent Stop and immediately starts a fresh session. This is a false Stop-disappearance transition.

The same race also explains the missing continuation context. The fresh handoff can run before the old conversation's assistant DOM has rehydrated, so the live transcript extractor returns no useful work. The next fresh session then receives the ordinary task prompt again and appears identical to the previous round.

## 2. Goal

Make Stop disappearance document-aware. A Stop observation from a previous document must not trigger a fresh session until the refreshed document is fully hydrated and its conversation view has remained stable long enough to prove Stop is genuinely absent. Independently persist the current task-scoped assistant reply before unload and use that durable snapshot as a fallback carry so every fresh handoff includes the previous conversation's actual work.

## 3. Relationship to v2.9.97

This specification refines, rather than removes, the v2.9.97 rule:

- Same document: Stop observed → Stop disappears → no authorization card → fresh-session handoff remains immediate.
- New/reloaded document: a persisted Stop observation is only historical evidence. The new document must either observe Stop again, or reach a fully hydrated/stable Stop-absent state before handoff.

The v2.9.97 rule that automatic recovery never sends `继续完成所有` in the old conversation remains unchanged.

## 4. Requirements

- R1: Give every userscript document instance an ephemeral identifier. Persist the identifier alongside the task's Stop-observed dispatch identity when Stop is actually visible.
- R2: A Stop-observed identity inherited from a previous document must not be treated as a live Stop→absent transition immediately after reload.
- R3: For an inherited Stop observation, require the exact task route to be hydrated: document readyState is complete, the task conversation has rendered messages, the composer exists, no competing task owns the route, no authorization card is pending, and the page is not blocked/rate-limited.
- R4: After those hydration conditions are met, require the rendered conversation fingerprint to remain unchanged and Stop to remain absent for at least 8 seconds before a fresh-session handoff. Any content/stream identity change resets this stability window.
- R5: If Stop appears at any point in the new document, bind the Stop observation to the current document immediately, clear the reload-stability timer, and use the normal same-document rule thereafter.
- R6: Do not let final-toolbar/Copy/Share evidence bypass the reload hydration gate for a historical Stop observation.
- R7: Before pagehide/unload of an owned task conversation, synchronously capture and persist a bounded task-scoped assistant reply snapshot, bound to exact conversation URL, phase and round.
- R8: Also refresh that durable snapshot immediately before a Stop-disappearance fresh handoff when live assistant content is available.
- R9: Fresh-handoff context resolution must prefer the newly captured abnormal carry, then fall back to the durable reply snapshot for the same phase/round. A refresh must not reduce the next prompt to the original task text merely because the assistant DOM is temporarily absent.
- R10: The durable snapshot must never cross phase/round/goal changes. Clear it on successful phase completion, manual goal edits, cancellation/deletion/reset paths that invalidate the current dispatch, and any explicit task identity reset where old reply context is no longer valid.
- R11: The next Work or Review fresh-session prompt must explicitly contain the prior conversation's captured assistant reply between the current instruction/context and the original goal/review requirements.
- R12: Keep ownership fail-closed: no snapshot or carry may be copied from a foreign task/route. Preserve authorization, rate-limit, blocker, ambiguous-send, memory-pressure same-tab reload, and manual recovery behavior.
- R13: Add regressions reproducing a reload where Stop appears several seconds after the document starts: no fresh handoff before hydration/stability, Stop reappearance cancels the inherited-absence timer, and only a later real same-document Stop disappearance hands off.
- R14: Add regressions proving a pagehide snapshot survives the reload race and is included in the next fresh Work/Review prompt even when the reloaded DOM has not yet restored the assistant reply.
- R15: Bump userscript metadata/runtime/README/version assertions to 2.9.98.
- R16: Deliver only after exact-head GitHub Actions Test succeeds, then merge, verify canonical-main Test, Release workflow, v2.9.98 release asset, and record compliance evidence.

## 5. Target flow

Existing task is generating
→ Stop visible in document A
→ persist dispatch identity + document A id
→ page reloads
→ pagehide captures current assistant reply snapshot
→ document B starts with same task/dispatch identity but different document id
→ Stop temporarily absent
→ **do not hand off**
→ wait for readyState complete + composer + task conversation hydration
→ start 8-second stable Stop-absent fingerprint window
→ if Stop appears during the window: bind to document B, cancel inherited-absence timer
→ later, when Stop really disappears in document B: immediate fresh handoff
→ if Stop never appears after reload: only after the hydrated fingerprint remains stable for 8 seconds may the historical Stop observation authorize fresh handoff
→ fresh prompt includes the prior assistant reply from live capture or durable pagehide snapshot.

## 6. Data model

New bounded task fields:
- `stopObservedDocumentId`
- `reloadStopAbsentDocumentId`
- `reloadStopAbsentSince`
- `reloadStopAbsentSignature`
- `handoffReplySnapshot`
- `handoffReplySnapshotSourceURL`
- `handoffReplySnapshotPhase`
- `handoffReplySnapshotRound`
- `handoffReplySnapshotAt`

No external schema or host API changes.

## 7. Verification

Focused tests must cover:
1. same-document Stop disappearance still hands off immediately;
2. inherited Stop observation after reload does not hand off while document is loading/unhydrated;
3. hydrated inherited absence must remain stable for 8 seconds;
4. Stop reappearing in the new document cancels the inherited timer;
5. final toolbar during reload does not bypass the gate;
6. pagehide/durable snapshot fallback supplies the prior assistant reply to the new Work prompt;
7. Review prompt receives the same-phase snapshot when appropriate;
8. foreign route/task cannot seed or consume another task's snapshot;
9. no automatic same-chat `继续完成所有` behavior returns.

## 8. Acceptance criteria

- AC-1: Reloading a still-generating ChatGPT page cannot immediately create a new conversation merely because Stop has not mounted yet.
- AC-2: A refreshed page waits for real hydration plus 8 seconds of stable Stop absence unless Stop is re-observed in the new document.
- AC-3: The immediately previous conversation's assistant reply is present in the next fresh-session prompt.
- AC-4: A page reload cannot erase that reply context.
- AC-5: Same-document Stop disappearance remains responsive and does not gain an unnecessary 8-second delay.
- AC-6: Authorization and route ownership remain hard guards.
- AC-7: Exact-head, canonical-main Test and Release v2.9.98 all succeed.

## 9. Compliance record

Implementation head `66fdc657bb037da82750b383940a95e81dacf700` passed GitHub Actions Test run `36306258914`: 258 tests, 251 passed, 0 failed, 7 skipped. Focused regressions passed for reload hydration, fingerprint stability, Stop reappearance, same-document immediate handoff, pagehide reply persistence, Work prompt snapshot fallback, Review prompt snapshot fallback, phase/round/goal-revision isolation, foreign-route rejection, authorization priority, and the existing no-`继续完成所有` behavior.

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R6 / AC-1, AC-2, AC-5 | passed | Each userscript document has an ephemeral id. Stop observations persist that id. A historical observation from an older document cannot hand off until readyState is complete, the exact conversation/composer is hydrated and the visible conversation fingerprint remains unchanged for 8 seconds. Stop reappearance binds the current document and restores immediate same-document Stop→absent behavior. |
| R7-R9, R11 / AC-3, AC-4 | passed | `suspendRunnerForPagehide()` captures a bounded exact-route assistant snapshot before saving/unload; fresh handoff capture refreshes it again; Work/Review fresh prompts use live abnormal carry first and the durable same-phase/round snapshot as fallback. Pagehide+DOM-loss regression proves the previous reply remains in the next prompt. |
| R10 | passed | Snapshot identity includes phase, round and goal revision; successful finish, manual goal edit and cancellation clear stale snapshot/carry/Stop identity. Regression proves round/revision mismatch returns no snapshot. |
| R12 / AC-6 | passed | Existing authorization/rate-limit/blocker/ownership/ambiguous-send/memory/manual-recovery regressions remain green; foreign-route snapshot writes are rejected. |
| R13-R14 | passed | Reload-delay, Stop-return, pagehide-carry, prompt fallback and isolation regressions are present and passed. |
| R15 | passed | Userscript metadata/runtime, README and version assertions report 2.9.98. |
| R16 / AC-7 | passed | Final PR head `a36b650c197155b7b5f56608a558750862e231cc` passed exact-head Test `36306302121`; PR #105 merged as `fd1e143a95edb591e565394cd51d807ff304d6b5`; canonical-main Test `36306341238` succeeded; Release `36306367887` succeeded and published `v2.9.98`. Release asset `chatgpt-auto-confirm.user.js` is 359355 bytes with SHA-256 `7f672cb291f56b93a0ff1e40a0e668ec576abc95607c0d02eea12443f25ed7c0`; canonical main readback reports metadata/runtime 2.9.98. |

## 10. Final delivery evidence

- Implementation PR: #105.
- Final exact-head SHA: `a36b650c197155b7b5f56608a558750862e231cc`.
- Final exact-head Test: `36306302121`, success.
- Merge SHA: `fd1e143a95edb591e565394cd51d807ff304d6b5`.
- Canonical-main Test: `36306341238`, success.
- Release workflow: `36306367887`, success.
- GitHub Release: `v2.9.98`, published 2026-09-27T08:29:54Z.
- Release asset: `chatgpt-auto-confirm.user.js`, 359355 bytes, SHA-256 `7f672cb291f56b93a0ff1e40a0e668ec576abc95607c0d02eea12443f25ed7c0`.
- Release target/source commit: `c5559d2b942b8a30291e8281b4488bdb886b9192`; the release workflow verified the userscript file on tested canonical main is byte-identical to that source commit.
