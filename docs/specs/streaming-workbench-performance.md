# Streaming workbench performance
Status: active
Date: 2026-11-03
Owner: standalone userscript

## Problem and scope
The supplied long active conversation stutters. Source review confirms preview text participates in the feed signature, so every preview change clears and rebuilds retained history. Current report recognition also tries JSON and tolerant recovery on ordinary prose. These are script costs, not proof that the script is the sole live cause; previous captured stacks included ChatGPT timers.

## Requirements / architecture
R1: On preview-only changes with stable history/state/route, update the existing live-preview node in place, retain history nodes, and preserve scroll position unless already near the bottom. Add/remove preview and history/state changes still rebuild correctly.
R2: Skip final-report JSON/recovery work for text without a taskId field marker; preserve case-insensitive tolerant recovery and all exact identity validation. No change to authorization or sending decisions.
R3: Verify DOM node identity across repeated large-preview updates, updated content, and valid report recognition. Run bundle parity, syntax and full regression checks in Actions. Track actual installed version and live responsiveness separately; do not promise elimination of ChatGPT-owned freezes.

## Delivery and rollback
Release 2.10.94 after checks. Revert source and bundle together if semantics regress. No storage migration.

## Integration and verification correction
2026-11-03: User explicitly requests merge and publication. Integrate canonical main including Pro fallback. CI 41570133923 failed because fixture exported the pre-mount no-op paint value; expose a forwarding function that resolves the mounted paint binding at invocation time. Retain all DOM identity and content assertions. Cover manual scroll preservation and history-triggered rebuild as well. No local executable build/test; Actions remains authoritative.

## Compliance
| Requirement | Status | Evidence |
| --- | --- | --- |
| R1–R3 | blocked | Implementation and Actions pending; final evidence tracked in PR. |
