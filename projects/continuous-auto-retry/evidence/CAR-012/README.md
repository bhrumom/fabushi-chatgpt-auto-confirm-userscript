# CAR-012 evidence — connection interruption refresh cadence = 15 minutes

- Requirement: first and subsequent recovery refreshes for “连接已中断，正在等待完整回复” must wait 15 minutes; keep exactly three refresh attempts and preserve same-chat “继续完成所有” after 3/3.
- Implementation PR: #47.
- PR exact head: `a1bef9405ae2489117425a3e9c3f90908e887a2f`.
- Exact-head Test run `35442566038`: SUCCESS; syntax and regression steps passed.
- Squash merge: `d3b15050cd6d09e07680804f41d8b9c9c4226175`.
- Post-merge main Test run `35442627151`: SUCCESS.
- Canonical main readback: userscript `@version 2.9.47`, runtime `VERSION = '2.9.47'`.
- Canonical timing readback: `STALLED_REFRESH_MS = 15 * 60 * 1000`; `CONNECTION_INTERRUPTED_REFRESH_COOLDOWN_MS = 15 * 60 * 1000`; `AMBIGUOUS_SEND_REFRESH_MS = 3 * 60 * 1000`.
- Behavioral regression proves: first interruption detection waits; refresh 1/3 only after 15 minutes; refreshes 2/3 and 3/3 each wait another 15 minutes; after 3/3 the existing same-chat continuation path remains.
- Scope intentionally did not change rate-limit cooldown, approval handling, loading renderer recovery, attachment/task identity, or final-reply completion boundaries.
- No extra live-site/E2E behavioral test was requested; acceptance is source regression + exact-head/main CI + canonical main readback.
