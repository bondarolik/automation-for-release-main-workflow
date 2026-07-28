# Automated Post Release Workflow

## Overview

This workflow automates the repetitive tasks that happen after a production release.

It is triggered automatically when the **Release → Main** pull request is merged.

The objective is to:

- eliminate manual release housekeeping
- keep `main` always green
- prepare the next release branch automatically
- ensure semantic versioning is applied consistently
- reduce human error

---

# Current Release Flow

```
Feature PRs
      │
      ▼
release
      │
      ▼
Deploy to Production
      │
      ▼
Merge Release → Main
      │
      ▼
🚀 Post Release Automation
```

---

# Version Impact

Every Release PR must include a **Version Impact** section.

Exactly **one** option must be selected.

```md
## Version Impact

- [x] patch
- [ ] minor
- [ ] major
- [ ] none
```

The selection must be in the **release PR description**, not a review or
comment. Keep the `## Version Impact` heading and option names unchanged.

Meaning:

| Selection | Description | Example |
|-----------|-------------|---------|
| patch | Bug fix | 1.4.2 → 1.4.3 |
| minor | Backward compatible feature | 1.4.2 → 1.5.0 |
| major | Breaking change | 1.4.2 → 2.0.0 |
| none | Documentation / CI only | No version bump |

The Release PR cannot be merged unless **exactly one** option is selected.

---

# What Happens Automatically

After the Release PR is merged into `main`, GitHub Actions performs the following steps.

## 1. Read Version Impact

The workflow parses the Release PR and determines whether the next release is:

- patch
- minor
- major
- none

---

## 2. Read Current Version

Reads the current version from

```
package.json
```

Example

```
1.8.4
```

---

## 3. Create Release Tag

Creates

```
v1.8.4
```

from the merge commit on `main`.

---

## 4. Create GitHub Release

Creates a GitHub Release page for the new tag, titled for example:

```
Release v1.8.4
```

GitHub generates the release notes. On a safe rerun, an existing Release for
the tag is reused rather than overwritten.

---

## 5. Move Open PRs

Every open PR targeting

```
release
```

is temporarily retargeted to

```
main
```

This allows the old release branch to be deleted safely.

---

## 6. Delete Release Branch

Deletes

```
release
```

from GitHub.

---

## 7. Create New Release Branch

Creates a fresh

```
release
```

branch from the latest `main`.

---

## 8. Calculate Next Version

Uses the Version Impact selected in the Release PR.

Example:

| Current | Impact | Next |
|----------|--------|------|
|1.8.4|patch|1.8.5|
|1.8.4|minor|1.9.0|
|1.8.4|major|2.0.0|
|1.8.4|none|no change|

---

## 9. Create Version Bump Branch

Creates

```
deploy/chore-version-bump-vX.Y.Z
```

Example

```
deploy/chore-version-bump-v1.9.0
```

---

## 10. Update package.json

Automatically updates

```
package.json
```

(and lockfile if present)

using

```
pnpm version
```

---

## 11. Create Version Bump PR

Creates a PR similar to

```
[deploy] chore: version bump 1.9.0
```

targeting

```
release
```

---

## 12. Merge Version Bump PR

The automation merges the Version Bump PR.

---

## 13. Restore Remaining PRs

Every previously opened feature PR is moved back

```
main
        ↓
release
```

so normal development continues without interruption.

---

# Example

Current production version

```
1.8.4
```

Release PR

```
[x] minor
```

Result

```
Tag created:

v1.8.4

New release branch:

release

package.json

1.9.0

Version bump PR

[deploy] chore: version bump 1.9.0
```

---

# Testing Guide

The easiest way to validate the workflow is using a temporary repository or a disposable release branch.

## Test 1 – Patch

1. Create a `release` branch.
2. Open a Release PR into `main`.
3. Select

```
[x] patch
```

4. Merge the PR.

Expected result

- Release tag created
- GitHub Release page created
- New release branch created
- Version bump PR created
- package.json bumped to patch version

---

## Test 2 – Minor

Repeat with

```
[x] minor
```

Expected

```
1.8.4

↓

1.9.0
```

---

## Test 3 – Major

Repeat with

```
[x] major
```

Expected

```
1.8.4

↓

2.0.0
```

---

## Test 4 – None

Select

```
[x] none
```

Expected

- No tag created
- No version bump
- No Version Bump PR
- Release branch recreated
- Feature PRs restored

---

## Test 5 – Validation

Try selecting

```
[x] patch
[x] minor
```

Expected

✅ Validation workflow fails.

---

Try selecting

```
(no boxes)
```

Expected

✅ Validation workflow fails.

---

# Failure Recovery

The workflow is designed to be idempotent whenever possible.

If a failure occurs after PR retargeting:

- the release branch is recreated
- previously moved PRs are restored
- rerunning the workflow is safe for most operations
- existing tags are verified before creation to avoid duplicates

---

# Required Repository Configuration

The automation requires:

- `RELEASE_AUTOMATION_TOKEN` GitHub Actions secret
- Contents: Read & Write
- Pull Requests: Read & Write

The automation account must be allowed to:

- create branches
- delete branches
- create tags
- create pull requests
- merge pull requests
- change pull request base branches

---

# Benefits

- Zero manual post-release work
- Consistent Semantic Versioning
- Repeatable release process
- Less human error
- Faster release turnaround
- Automatic preparation for the next release cycle

# Future Improvements

Possible enhancements for future iterations:

- Support monorepo versioning
- Changelog generation from merged PRs
- Slack / Teams release notifications
- Jira release ticket updates
- Automatic release notes using AI
- Support prerelease versions (`alpha`, `beta`, `rc`)
- Automatic rollback workflow
- Release metrics and duration reporting
