# CAR-014 — Streaming final reply and review identity recovery

Status: in-progress
Started: 2026-09-19
Updated: 2026-09-19

Objective: prevent false abnormal/loading recovery while ChatGPT is still streaming or after a true final reply has appeared, and keep planning/review JSON bound to the current task and round.

Acceptance:
- K1: an owned current assistant turn with data-is-streaming=true or aria-busy=true remains generating even if Stop temporarily disappears.
- K2: streaming text cannot trigger the 15-second abnormal-stop continuation path.
- K3: a true final reply already visible prevents recoverStalledRoute from incrementing recovery counters or logging/refreshing the page.
- K4: if final arrives while a host navigation permit is in flight, the recovery navigation is cancelled before reload/replace commits.
- K5: normal final toolbar evidence remains authoritative; explicit non-streaming completion plus response-local Copy is accepted when secondary action buttons mount late.
- K6: plannerPrompt pins the exact current taskId and round and tells the reviewer to ignore historical report identities inside Work evidence.
- K7: tolerant review recovery searches mixed output for the exact current taskId/round before falling back.
- K8: a mismatched review identity raises invalid-review-json so only the review phase is retried and the Work result is preserved.
- K9: deterministic regressions cover streaming-without-Stop, static-complete+Copy, final-before-recovery, mixed old/current review reports, and mismatch repair semantics.
- K10: userscript metadata/runtime version is v2.9.49 with stable update/download URLs.
- K11: PR exact-head CI passes, merge to main completes, post-merge main CI passes, canonical main is re-read, and v2.9.49 is published.

Branch: `fix/car-014-streaming-review-identity-2.9.49`
