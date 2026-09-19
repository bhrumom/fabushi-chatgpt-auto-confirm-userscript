# CAR-009 — Durable forced continuation after interruption exhaustion

Status: in-progress
Started: 2026-09-19
Updated: 2026-09-19

Objective: guarantee that the 3/3 interruption escalation results in a real same-chat `继续完成所有` send even when ChatGPT still exposes Stop/generating at the moment the third refresh returns.

Acceptance:
- F1: 3/3 persistent interruption creates persisted pending-continuation fields before any Stop/composer check.
- F2: visible Stop causes exactly one guarded Stop click and retains the pending continuation; it does not count as a continuation send.
- F3: after Stop disappears and composer/send is available, the same pending intent actually clicks Send with `继续完成所有`.
- F4: interruption notice disappearing between Stop click and composer recovery does not clear pending intent.
- F5: approval/rate-limit/blocker defers pending send; existing handlers remain authoritative.
- F6: true final reply or dispatch/conversation reset clears pending continuation and avoids unnecessary send.
- F7: forced interruption continuation bypasses the generic 60-second continuation cooldown while retaining duplicate protection through persisted pending state.
- F8: userscript version increments, exact-head/main CI pass, Release is published, and Chrome host bundles the exact released source in a new release.

Branch: `fix/forced-continuation-after-interruption-2.9.44-20260919`
PR/CI/Release/evidence: pending.
