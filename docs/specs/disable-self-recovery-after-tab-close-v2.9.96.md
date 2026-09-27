# Disable automatic workspace resurrection after tab close (v2.9.96)

Last updated: 2026-09-27

## Problem

Closing the original ChatGPT task tab is an explicit user action. The prior stale-workspace recovery loop could later interpret that closed workspace as crashed/stale and automatically adopt it from another ChatGPT tab or ask the host recovery bridge to restore it. This could make a tab appear again after the user deliberately closed it.

## Required behavior

- Never automatically adopt a stale workspace merely because its original tab disappeared.
- Never arm the host recovery capability for stale-tab resurrection.
- Never start the stale-workspace automatic recovery scanner at startup.
- Preserve explicit same-tab navigation/reload handoff used by memory-pressure recovery.
- Preserve manual Restore Workspace and explicit Open in new tab actions.
- Explicit recovery tokens created by an in-progress same-tab reload remain valid.

## Implementation

- `AUTOMATIC_WORKSPACE_RECOVERY_ENABLED = false`.
- Fresh ChatGPT documents no longer call `findAutomaticRecoveryOwner()` to steal a stale owner.
- `recoverStaleWorkspaceAutomatically()` returns immediately.
- `scheduleAutomaticWorkspaceRecovery()` is inert and is no longer armed at startup.
- `requestHostRecoveryCapability()` releases/declines the host recovery lease instead of requesting it.

## Regression

Tests must prove that the automatic recovery function returns false, startup does not arm the scanner, and heartbeat writes cannot emit a `recovery-capability.request` while automatic self-recovery is disabled.
