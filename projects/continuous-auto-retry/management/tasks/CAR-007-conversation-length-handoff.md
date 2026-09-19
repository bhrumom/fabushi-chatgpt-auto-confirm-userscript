# CAR-007 — Conversation length-limit handoff

Status: in-progress
Started: 2026-09-19
Updated: 2026-09-19

Objective: convert ChatGPT conversation-length exhaustion into a deterministic fresh-chat continuation chain while preserving the current task, phase, round, attachments, and latest assistant context.

Acceptance:
- D1: Current owned conversation detects the Chinese length-limit notice and supported English equivalent; quoted user text and Fabushi workbench logs do not trigger.
- D2: On detection, the current assistant reply is persisted as a bounded continuation context and the current conversation URL/token are archived/cleared without marking the task complete.
- D3: Next Work chat receives original/current work instruction plus the previous assistant reply and an explicit “continue from here / do not restart” instruction.
- D4: Next Review chat preserves original goal, attachments, Work result, review phase/round, previous review reply, and still requires the MAHAYANA_TASK_REPORT_V1 final JSON.
- D5: Repeated length-limit notices can chain through multiple fresh chats; each hop replaces the carry context with the latest reply and remains in the same phase/round until a true final reply.
- D6: True final reply clears the temporary carry state; existing Stop/approval/rate-limit/error/final-toolbar rules remain authoritative.
- D7: Version advances from 2.9.41, exact-head CI passes, protected merge/main CI passes, GitHub Release is published, and the Fabushi Chrome host bundles the exact released source in a new extension release.

Branch: `fix/conversation-length-handoff-2.9.42-20260919`
PR/CI/Release/evidence: pending.
