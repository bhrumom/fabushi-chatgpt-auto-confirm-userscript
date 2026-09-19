# CAR-009 — Durable forced continuation after interruption exhaustion

Status: complete
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
Delivery:
- PR #42 final head `f16d1ddd99b17cae0d230d1d015e2db0931c8ff5`.
- Exact-head standard Test run `35428733800`: syntax + full regression SUCCESS.
- Squash merge/release target `b35124fe1a8f3279f412c67164f5daaeb142c575`.
- Post-merge main Test run `35428760765`: SUCCESS.
- Release `v2.9.44`; asset `chatgpt-auto-confirm.user.js`, 260967 bytes, sha256 `71d8c1e12fe5eed91ae717c5ce6d1e25a96c76115972b9292207b20475c59809`.
- Paired Fabushi Chrome host PR #9 / source `c412db85e4809859ca326b924d74a93bcc5ff7ab` / tag workflow `35428994707` / Release `v0.6.18`.
- Host package `fabushi-chrome-0.6.18.zip`, 135746 bytes, sha256 `935db4b71f1a57e87eb67872447fbbe8d7b0d6b48d3cb51d4efa4495be34ee43`.
- Host bundled userscript blob equals canonical v2.9.44 blob `b608025f11e8007ee965013d314222ce30fb5522`.
