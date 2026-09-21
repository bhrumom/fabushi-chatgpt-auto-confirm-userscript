# Tested GitHub Release delivery — Specification

Status: completed
Owner: ChatGPT auto-confirm userscript
Last updated: 2026-09-21
Related issue/task/PR: v2.9.52 release delivery

## 1. Context / problem

The standalone userscript is already published from canonical `main` through its stable raw `@updateURL` and `@downloadURL`, but historical versions are also delivered as GitHub Releases with a `chatgpt-auto-confirm.user.js` asset. The repository currently has only the Test workflow, so this environment has no direct GitHub Release mutation surface for completing that second delivery channel.

## 2. Goal

Add a repository-owned GitHub Actions release path that creates the immutable versioned GitHub Release only after the canonical-main Test workflow succeeds, and use it to publish v2.9.52.

## 3. Non-goals / out of scope

- Do not bypass or weaken the existing Test workflow.
- Do not release pull-request heads or non-main branches.
- Do not rebuild or transform the userscript asset.
- Do not alter userscript runtime behavior or version.

## 4. Requirements

- R1: Release automation triggers only after the repository `Test` workflow completes successfully.
- R2: Release automation accepts only the same repository's `main` branch.
- R3: The version is parsed from the userscript `@version` metadata and must match runtime `VERSION`.
- R4: The release tag is `v<version>`.
- R5: If that release already exists, the workflow is idempotent and exits successfully without replacing it.
- R6: A new release uploads the exact canonical `chatgpt-auto-confirm.user.js` as the release asset.
- R7: The release target is the most recent commit that changed the userscript, not a later docs-only commit.
- R8: The workflow has only the write permission required for release contents and performs no untrusted code execution.
- R9: v2.9.52 must be verified from the GitHub Releases readback with the expected asset after canonical-main Test passes.

## 5. Current state

Canonical main contains userscript v2.9.52 and its update/download URLs already point to raw main. GitHub Releases currently stop at v2.9.51.

## 6. Target state

A `workflow_run`-based release workflow listens for successful `Test` runs on canonical main, checks out the exact tested main SHA, validates version parity, finds the source commit that last changed the userscript, and creates the missing GitHub Release with the userscript asset. Existing releases are left unchanged.

## 7. Architecture and ownership boundaries

- Verification owner: `.github/workflows/test.yml`.
- Release owner: `.github/workflows/release.yml`.
- Artifact source: canonical `chatgpt-auto-confirm.user.js`.
- Trigger trust boundary: `workflow_run.head_branch == main` and `head_repository.full_name == github.repository`.
- Release write boundary: GitHub Actions `contents: write` only.

## 8. Interfaces / contracts / schemas / data flow

`Test` successful workflow_run → checkout exact tested SHA → parse/validate version → derive source SHA → check existing release → create missing release/tag + upload exact userscript asset.

## 9. Constraints and non-functional requirements

- Idempotent across later docs-only pushes.
- No local build/test.
- No release before the Test gate succeeds.
- No PR-head checkout under a privileged `workflow_run` token.

## 10. Failure modes and edge cases

- Failed/cancelled Test: release job must not run.
- Non-main Test: release job must not run.
- Version metadata/runtime mismatch: fail closed.
- Existing release: succeed without modifying it.
- Missing userscript/source SHA: fail.
- Release API failure: workflow fails and leaves Test result unchanged.

## 11. Implementation strategy

1. Add the spec.
2. Add `.github/workflows/release.yml` using `workflow_run`.
3. Validate the workflow through the existing PR Test gate.
4. Merge to main.
5. Wait for canonical-main Test success and resulting Release workflow.
6. Read back v2.9.52 release/tag/asset.

## 12. Verification / test strategy

- Existing PR `Test` workflow passes on the workflow addition.
- Canonical-main `Test` passes after merge.
- Release workflow completes successfully.
- GitHub Releases readback shows `v2.9.52`, target source SHA, and asset `chatgpt-auto-confirm.user.js`.

## 13. Acceptance criteria / Definition of Done

- AC-1: Release cannot run from PR/non-main or failed Test.
- AC-2: Version mismatch fails.
- AC-3: Existing release is idempotent.
- AC-4: v2.9.52 release is present with exact userscript asset.
- AC-5: The release points at the last userscript-changing commit.
- AC-6: PR and canonical-main Test workflows are green.

## 14. Release / migration / rollback

The workflow itself is merged through normal PR review/CI. Rollback is a normal revert of `.github/workflows/release.yml`; existing GitHub Releases are not mutated by rollback.

## 15. Observability / evidence

Record PR, exact-head Test run, merge SHA, canonical-main Test run, Release workflow run, release URL/tag/target, asset size/digest when GitHub exposes it.

## 16. References / provenance

- `AGENTS.md`
- `docs/specs/spec-first-ai-development.md`
- Existing releases v2.9.49–v2.9.51
- v2.9.52 recovered-final-reply delivery evidence in `docs/specs/recovered-final-reply-identity.md`

## 17. Spec compliance record

| Requirement / AC | Status | Evidence / reason |
| --- | --- | --- |
| R1–R9 | passed | PR #59 added the guarded `workflow_run` release path; exact-head `beda5316d8c387cdbaf5b5287de9ed7c26c877ba` passed Test run `35612148223`; merge `2f2f04ccc10ed32ad91d0831b2ff6a32e7b75922` reached canonical main. |
| AC-1–AC-3 | passed | Workflow conditions require successful `Test`, same-repository `main`, version parity, and an existing-release check before any write. |
| AC-4 | passed | Release workflow run `35612276537` published `v2.9.52` with asset `chatgpt-auto-confirm.user.js`, size 271138 bytes, digest `sha256:bec0b1ed113c786fbd8399400a22bfaae363fa5dd33535a04deb64040768aa5a`. |
| AC-5 | passed | GitHub Releases readback reports `v2.9.52` target `c99e662a78540f61684af07296e70dbe98e7f0d4`, the last commit that changed the userscript. |
| AC-6 | passed | PR Test run `35612148223` and canonical-main Test run `35612223777` both succeeded before Release run `35612276537` completed successfully. |
