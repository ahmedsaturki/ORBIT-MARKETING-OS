## Change

### What changed?
<!-- Describe the user-visible or engineering change. -->

### Why?
<!-- Explain the problem or requirement this addresses. -->

## Verification

- [ ] Targeted tests added or updated
- [ ] Typecheck/lint/tests run
- [ ] Build or relevant package validation run
- [ ] Security-sensitive behavior reviewed
- [ ] Release evidence updated when applicable

Evidence:
<!-- Paste exact commands/results, CI run IDs, artifact IDs, or links. Do not paste credentials. -->

## Risk

- Change scope:
- Rollback path:
- External/account prerequisites, if any:

## Release truth

- [ ] This change is only source/CI verification
- [ ] I have separate runtime evidence
- [ ] I am not claiming production proof unless the required evidence exists

## Checklist

- [ ] No secrets or private data added
- [ ] No new paid dependency/service introduced without documenting it
- [ ] New GitHub Actions are pinned to immutable SHAs
- [ ] Workspace/RBAC boundaries remain intact
- [ ] Existing fail-closed behavior is preserved
