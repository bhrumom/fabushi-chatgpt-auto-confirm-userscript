# CAR-001 evidence

- Source baseline: main `2fd43b6ba64a58acbc806ad35a4c48b477ac57f0` (v2.9.36).
- Generated implementation commit: `9299f1f679420d664cea673fc3c585781771ec19`.
- PR: #30 `fix: continuously recover needs-processing tasks`.
- Patch-generation Action: run `35247977169`, job `105292927481`, success including JS syntax check and branch commit.
- Diagnostic Action: run `35248454766`, job `105294518898`. It proved 107/110 tests passed before timeout and exposed two stale test expectations: the new runtime recovery log assertion inspected only the last navigation message, and the package metadata test still expected v2.9.36.
- Diagnosed test-fix Action: run `35248712876`, job `105295386736`, success; it updated those two expectations on the PR branch.
- Exact-head candidate after test fixes: `645b28c77ec6ad23ec5890ac8f7b351c67d4594f`; a subsequent evidence refresh commit is intentionally used to trigger user-authored exact-head validation after the bot-authored fix.
- Merge/main/release evidence: pending; do not mark complete before live verification.
