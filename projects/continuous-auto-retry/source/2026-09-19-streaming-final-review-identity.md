# 2026-09-19 — Streaming final reply and review identity recovery

Latest user requirement:
- Do not treat temporary Stop disappearance while assistant text is still streaming as an abnormal end.
- When a true final reply is already visible, do not start or commit a "page has not recovered" reload.
- A loading-recovery request already in flight must be cancelled if the reply becomes final before navigation commits.
- Review/planner replies must stay bound to the current taskId and round even when Work evidence contains older task reports or copied JSON.
- A mismatched review identity is a repairable review-format error: preserve the Work result and retry only the review phase.
- Publish a new userscript version after CI verifies the fixes.

Implementation target:
- v2.9.49.
- Treat current-turn data-is-streaming=true / aria-busy=true as active generation even when Stop is absent.
- Preserve existing strong final-toolbar completion; additionally accept explicit non-streaming completion + response-local Copy when secondary actions mount late.
- Re-check owned final state before incrementing/loading recovery and again before navigation commit.
- Pin planner identity in the prompt and recover the exact matching taskId/round report from mixed text.
