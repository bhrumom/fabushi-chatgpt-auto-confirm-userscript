# Persistent loading interval refresh
Status: active
Date: 2026-10-10

User requires the live script to refresh a page that stays loading at intervals rather than wait forever or invoke host terminate/transit repeatedly. Existing holdForChatGPTLoading resets send UI timers without any deadline; quick route recovery stops after two attempts.

R1: Owned running task loading waits two minutes initially; if still loading, performs guarded same-tab reload at most once per five minutes thereafter. Persist deadline and phase/round/token/route identity before navigation so reload/bootstrap cannot reset the interval. Explicit loader policy is separate from the bounded quick missing-composer recovery.
R2: Retain task/owner, phase, round, token, attachments and attempted-send state. Never create a fresh conversation or click Send for loading refresh. Stop on paused/done/cancelled, foreign owner/route, visible final, active assistant generation, approval card/settlement, composer draft or active attachment upload.
R3: Clear loader state only on readiness or generation change, not mere bootstrap. Waiting/inspection of an empty loading shell must use the same policy. Host keeps its loading deferral.
R4: Regression tests cover initial wait, reload ticket, persisted interval across task reconstruction, repeated interval, protection and no duplicate-send. Exact-head CI plus installed version readback required; real prolonged network-stall acceptance remains separate.

Compliance: R1–R3 implemented in holdForChatGPTLoading and empty-shell inspection; deadlines and recovery ticket are persisted without clearing send identity. R4 initial exact-head run 38053217938 exposed a preflight nonrunning-state regression and a test microtask synchronization issue; both corrected without relaxing refresh cadence assertions. Current-head test/run and installed readback evidence will be recorded on PR #160; real prolonged network-stall acceptance remains blocked until observed.
