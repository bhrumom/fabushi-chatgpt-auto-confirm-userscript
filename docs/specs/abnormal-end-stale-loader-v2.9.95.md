# Abnormal end must beat stale loading recovery — v2.9.95

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-27  
Related issue/task/PR: user report with screenshot from conversation 6ab89f9e-f374-83e8-a11e-e02e187ae084

## 1. Context / problem

A task response can stop abnormally with visible assistant work, no Stop control, an available empty composer, and no final-response toolbar. When the task is under recovered/static identity and ChatGPT leaves a stale page-global loading indicator behind, v2.9.94 keeps `sample.loading` true. That blocks the eight-second abnormal-end path, so the generic fifteen-minute watchdog refreshes the same conversation instead. After reload, route hydration recovery may also run, producing the observed loop:

- “当前会话连续 15 分钟没有可见变化；正在刷新当前页面…”
- “ChatGPT 页面长时间没有恢复；正在进行第 1/2 次单次加载恢复…”

This is the wrong priority: a proven idle task response with no strong final evidence must enter abnormal-end recovery before generic page reload recovery.

## 2. Goal

When an exact-route recovered/static response has stopped, its assistant text is stable, Stop is absent, the composer is available, and no approval/blocker/rate-limit/final evidence exists, stale page-global loading UI must not force the task into the fifteen-minute reload path. After the existing eight-second stability window, continue the work in a fresh ChatGPT conversation with the visible assistant work carried forward.

## 3. Requirements

- R1: Keep strong final-toolbar completion unchanged. Copy plus completion action (or the existing static-complete+Copy evidence) still wins and completes normally.
- R2: For an exact task route with recovered/static ownership, no Stop, no active assistant streaming, no approval, no blocker, no rate limit, and an available composer, a stale page-global loading marker must not mask an abnormal end.
- R3: A recovered/static reply with stale loading and without strong final evidence must never be promoted to successful completion merely because its text is stable.
- R4: After the existing eight-second ended-state stability interval, queue the existing fresh-session abnormal recovery, carry task-scoped visible assistant work, and preserve goal/phase/round/previous Work result/next/attachments.
- R5: If the composer contains a stale draft, clear it only after the same exact-route idle/ownership guards pass, then restart the full stability interval.
- R6: Active Stop/streaming, approval, blocker, rate limit, ambiguous send, foreign route ownership, or changed user boundary continue to block abnormal-end recovery.
- R7: Generic fifteen-minute stalled refresh remains for genuinely active/ambiguous pages, but must not run first for the recovered/static stale-loader abnormal-end case.
- R8: Add a regression reproducing the screenshot-class state: recovered/static natural-language assistant content, stale loader, no final toolbar, empty composer, no Stop. It must queue fresh recovery after eight stable seconds and keep `stalledRefreshAttempts` at zero.
- R9: Add a negative regression showing that the same recovered/static state without stale loading retains the existing manual static-final fallback.
- R10: Bump metadata/runtime/README to 2.9.95. Publish only after exact-head Test succeeds on the PR and canonical main; verify the v2.9.95 Release asset.

## 4. Architecture / implementation plan

1. Derive a narrow `recoveredStaticStaleLoadingEnd` signal only after route ownership, activity, approval, blocker, rate-limit and composer state are known.
2. Use that signal to ignore page-global loading for ended-state evaluation only. Do not weaken blank-route hydration or active generation handling.
3. Allow the existing abnormal-end stability timer for this signal. Because abnormal recovery is evaluated before `classify()`, the response is carried into a fresh session rather than treated as a successful static final.
4. Keep the existing manual recovered static-final path unchanged when no stale loading marker is present.
5. Add focused jsdom regressions and version/release documentation.

## 5. Acceptance criteria

- AC-1: Screenshot-class state begins abnormal-end timing immediately instead of waiting fifteen minutes.
- AC-2: After eight stable seconds it queues a fresh session and carries the current assistant work.
- AC-3: No same-route stalled refresh or route reload is started by this state.
- AC-4: A genuine recovered static final without stale loading can still complete through the existing bounded static-final path.
- AC-5: Active/ambiguous/error guards remain fail-closed.
- AC-6: PR exact-head Test, canonical-main Test, and Release workflow succeed for the same source; release asset is v2.9.95.

## 6. Compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1-R9 / AC-1-AC-5 | pending | Implementation and regression verification pending. |
| R10 / AC-6 | pending | Exact-head CI, merge, canonical-main CI and release readback pending. |
