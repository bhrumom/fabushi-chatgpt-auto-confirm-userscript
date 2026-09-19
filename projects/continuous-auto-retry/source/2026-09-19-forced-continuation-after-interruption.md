# 2026-09-19 — Forced continuation after interruption refresh exhaustion

Latest live-site evidence:
- The task correctly reached `连接已中断` refresh 3/3.
- After the third refresh the log said it would append `继续完成所有`, but no message was actually sent at that time.
- The page was still in a generating state with a visible Stop control, so the existing `sendContinuation()` returned false on `stopButton()` and the one-shot call was lost. A later unrelated abnormal-stop path eventually sent the continuation.

Required behavior:
1. Reaching interruption refresh exhaustion must create a durable same-chat pending-continuation intent; logging intent alone is not success.
2. If Stop is still visible, click Stop once to terminate the failed generation, keep the pending intent, and retry until the composer/send control becomes usable.
3. When the composer becomes usable, actually submit `继续完成所有` in the same conversation. The pending intent is cleared only after the send click is committed.
4. The pending intent must survive subsequent scheduler scans even if the interruption notice disappears after Stop is clicked.
5. Approval cards, rate-limit notices and blockers retain their existing priority; pending continuation waits rather than bypassing them.
6. A true final reply may finish normally and clear pending continuation without sending an unnecessary extra message.
7. Conversation change, cancellation/dispatch reset and true final completion clear stale pending-continuation state.
8. Publish a new userscript version and synchronize the Fabushi Chrome host bundle.
