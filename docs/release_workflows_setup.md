# Post-Release Automation — Repository Setup

## Purpose

This document explains how to configure a repository before enabling the automated post-release workflow.

The automation runs after a pull request from `release` into `main` is merged. It creates the release tag and GitHub Release, rotates the `release` branch, calculates the next semantic version, creates and merges a version-bump pull request, and restores open pull requests to the new `release` branch.

---

# 1. Minimum Requirements

The repository must have:

* GitHub Actions enabled
* Node.js project metadata in `package.json`
* A valid semantic version in `package.json`
* A permanent `main` branch
* A temporary or rotating `release` branch
* Pull requests enabled
* Merge commits enabled
* An automation token with write access
* Repository rules that allow the automation identity to operate
* The required workflow and script files committed to `main`

Example `package.json`:

```json
{
  "name": "example-service",
  "version": "1.8.4",
  "private": true
}
```

The version must use valid semantic-version syntax:

```text
MAJOR.MINOR.PATCH
```

Examples:

```text
1.8.4
2.0.0
3.12.7
```

---

# 2. Required Files

Add these files to the repository:

```text
.github/
├── pull_request_template.md
├── scripts/
│   └── read-version-impact.mjs
└── workflows/
    ├── validate-version-impact.yml
    └── post-release.yml
```

## File responsibilities

| File                                            | Responsibility                                     |
| ----------------------------------------------- | -------------------------------------------------- |
| `.github/pull_request_template.md`              | Adds the Version Impact selection to pull requests |
| `.github/scripts/read-version-impact.mjs`       | Reads and validates the selected version impact    |
| `.github/workflows/validate-version-impact.yml` | Prevents invalid release PRs from being merged     |
| `.github/workflows/post-release.yml`            | Executes the post-release process                  |

All files must exist on `main` before the first automated release.

---

# 3. Required Branches

## `main`

`main` is the always-green production branch.

Expected properties:

* contains the latest production code
* receives changes through pull requests
* does not normally receive direct developer pushes
* contains the current released version in `package.json`
* retains its full Git history
* is never deleted or recreated by the automation

## `release`

`release` is the integration branch for the next production release.

Expected properties:

* feature and fix PRs target `release`
* production is deployed from `release`
* after deployment, `release` is merged into `main`
* after the merge, the automation deletes and recreates `release` from `main`
* the next semantic version is committed to the newly created `release`

The `release` branch is intentionally replaceable. Do not treat it as a permanent historical branch.

---

# 4. Pull Request Version Impact

The pull request template must include:

```md
## Version Impact

Check **exactly one** box. CI enforces a single selection.

- [ ] **patch** — backward-compatible bug fix (`x.y.Z+1`)
- [ ] **minor** — new backward-compatible feature (`x.Y+1.0`)
- [ ] **major** — breaking change (`X+1.0.0`)
- [ ] **none** — docs / CI / markdown only (no release)
```

For the `release → main` pull request, exactly one option must be selected.

Examples:

```md
- [x] **patch**
- [ ] **minor**
- [ ] **major**
- [ ] **none**
```

The validation workflow fails when:

* no option is selected
* more than one option is selected
* the `Version Impact` section is missing
* the checkbox syntax has been changed in an unsupported way

The `major` option does not require a GitHub label or additional workflow approval.

---

# 5. Repository Merge Settings

Open:

```text
Repository
→ Settings
→ General
→ Pull Requests
```

Enable:

* Allow merge commits
* Allow auto-merge, if the team plans to use it elsewhere

The supplied post-release workflow uses:

```bash
gh pr merge --merge
```

Therefore, **Allow merge commits** must be enabled.

The workflow does not require squash merging or rebase merging.

Recommended repository settings:

```text
Allow merge commits: Enabled
Allow squash merging: Optional
Allow rebase merging: Optional
Automatically delete head branches: Enabled
Allow auto-merge: Optional
```

Automatic head-branch deletion is optional because the workflow also requests deletion of its version-bump branch.

---

# 6. Authentication Strategy

## Recommended: GitHub App

The preferred production configuration is a dedicated GitHub App installed on the repository or organisation.

Advantages:

* credentials are not tied to an employee
* permissions can be narrowly scoped
* installation access tokens are short-lived
* the app can be placed on repository ruleset bypass lists
* actions performed by the app can trigger subsequent workflows

GitHub rulesets can grant bypass access to specific GitHub Apps.

## Simpler initial option: Fine-grained PAT

For an initial proof of concept, use a fine-grained personal access token belonging to a dedicated automation account.

Do not use an individual developer's everyday account.

Suggested account:

```text
release-automation
```

Suggested token name:

```text
post-release-automation
```

Limit the token to:

* the required organisation
* the required repository
* the minimum repository permissions

## Why not use only `GITHUB_TOKEN`?

GitHub prevents most events created with the repository `GITHUB_TOKEN` from starting new workflow runs. This protects repositories from accidental recursive workflow execution.

Because the automation creates a new version-bump pull request and may need normal PR checks to run, use a GitHub App installation token or fine-grained PAT instead.

---

# 7. Required Token Permissions

The automation identity requires these repository permissions:

| Permission    | Access                         |
| ------------- | ------------------------------ |
| Metadata      | Read                           |
| Contents      | Read and write                 |
| Pull requests | Read and write                 |
| Workflows     | Read, normally sufficient      |
| Actions       | Read, optional for diagnostics |

The critical permissions are:

```text
Contents: Read and write
Pull requests: Read and write
Metadata: Read
```

These permissions allow the workflow to:

* fetch repository content
* create Git tags
* create branches
* push commits
* delete the old `release` branch
* recreate the `release` branch
* create pull requests
* update pull-request base branches
* merge the generated version-bump PR

Do not grant administration access unless repository rules require it and a narrower bypass mechanism is unavailable.

---

# 8. Create the Repository Secret

Open:

```text
Repository
→ Settings
→ Secrets and variables
→ Actions
→ New repository secret
```

Create:

```text
Name:
RELEASE_AUTOMATION_TOKEN
```

Value:

```text
GitHub App installation token
```

or:

```text
Fine-grained personal access token
```

The workflow references it as:

```yaml
env:
  GH_TOKEN: ${{ secrets.RELEASE_AUTOMATION_TOKEN }}
```

and:

```yaml
with:
  token: ${{ secrets.RELEASE_AUTOMATION_TOKEN }}
```

Never commit the token into:

* workflow YAML
* shell scripts
* `.env` files
* repository documentation
* pull-request descriptions
* GitHub variables

Use an Actions secret.

## Verify a fine-grained PAT

To inspect or replace a fine-grained personal access token, open:

```text
GitHub avatar
→ Settings
→ Developer settings
→ Personal access tokens
→ Fine-grained tokens
→ <the token used for RELEASE_AUTOMATION_TOKEN>
```

Confirm all of the following:

* the resource owner is the correct user or organisation
* repository access includes this repository
* **Contents** is `Read and write`
* **Pull requests** is `Read and write`
* the token has not expired
* for an organisation repository, the token has received any required SSO or
  organisation approval

Repository ownership and a user's personal ruleset bypass do not automatically
apply to the workflow. The workflow acts as the identity represented by
`RELEASE_AUTOMATION_TOKEN`.

To verify the secret is present, open:

```text
Repository
→ Settings
→ Secrets and variables
→ Actions
```

The secret must be named exactly `RELEASE_AUTOMATION_TOKEN` and be a repository
secret available to the workflow. Replace its value after rotating or replacing
the token. GitHub does not display an existing secret value.

If the log contains `fatal: could not read Username for 'https://github.com':
terminal prompts disabled`, treat it as an authentication problem: check the
secret name, token expiration, repository access, organisation approval, and
the permissions above.

---

# 9. Token Expiration and Ownership

When using a fine-grained PAT:

* assign the token to a dedicated machine account
* document the token owner internally
* document its expiration date
* establish a token rotation procedure
* avoid expiration during a planned release window
* remove the token immediately if the automation account is compromised

Recommended operational record:

```text
Secret name: RELEASE_AUTOMATION_TOKEN
Owner: Platform or DevOps team
Purpose: Post-release automation
Repository scope: Exact repository only
Rotation: According to organisation security policy
```

A GitHub App is preferable when long-term maintenance is required because it avoids maintaining a long-lived personal token.

---

# 10. Workflow Permissions

The post-release workflow must declare:

```yaml
permissions:
  contents: write
  pull-requests: write
```

The validation workflow only needs:

```yaml
permissions:
  contents: read
  pull-requests: read
```

Also verify the repository-level Actions setting:

```text
Repository
→ Settings
→ Actions
→ General
→ Workflow permissions
```

Recommended setting:

```text
Read and write permissions
```

The workflows declare their required permissions explicitly, and the external
automation token supplies the normal write identity. The write setting also
keeps the `GITHUB_TOKEN` fallback usable when the repository secret is absent.

Do not rely on a repository-wide permissive default when explicit permissions can be declared in each workflow.

---

# 11. Protecting `main`

Use either:

* a GitHub ruleset, recommended
* a traditional branch protection rule

GitHub recommends rulesets for more flexible and visible repository governance. Multiple rulesets can apply simultaneously, while traditional branch protection has more limited rule matching behaviour.

Open:

```text
Repository
→ Settings
→ Rules
→ Rulesets
→ New branch ruleset
```

Create:

```text
Ruleset name:
Protect main
```

Target:

```text
main
```

Recommended rules:

```text
Require a pull request before merging
Require approvals
Dismiss stale approvals when new commits are pushed
Require conversation resolution before merging
Require status checks to pass
Block force pushes
Restrict deletions
```

Required status checks should include:

```text
Validate version impact
```

plus the repository's normal checks, for example:

```text
lint
test
typecheck
security
build
```

## Important validation-check behaviour

The `Validate version impact` workflow is designed specifically for:

```text
release → main
```

If the status check is configured as required for every PR into `main`, ensure the workflow reports a successful result for non-release PRs.

The safest team process is to merge production changes into `main` only through:

```text
release → main
```

If other branches also merge directly into `main`, adapt the validation workflow so it produces an explicit successful result when the PR source is not `release`.

---

# 12. Protecting `release`

The `release` branch needs different rules because the post-release workflow must delete and recreate it.

Create a second ruleset:

```text
Ruleset name:
Protect release
```

Target:

```text
release
```

Recommended rules:

```text
Require a pull request before merging
Require status checks to pass
Require conversation resolution
Block force pushes
```

The automation needs to:

* delete `release`
* recreate `release`
* merge the version-bump PR into `release`

Therefore, either:

1. add the automation GitHub App to the ruleset bypass list; or
2. add the dedicated automation account to an eligible bypass role or team; or
3. loosen the deletion and merge restrictions on `release`

The first option is recommended.

Rulesets can grant bypass access to selected apps, teams and roles. Rules from multiple active rulesets are combined, and the most restrictive applicable configuration wins.

## Required bypass operations

The automation identity must be allowed to:

```text
Delete release
Create release
Merge into release
Push the generated version-bump branch
Delete the generated version-bump branch
```

If deletion protection applies without a bypass, this workflow step will fail:

```bash
git push origin --delete release
```

Protected branches block deletion by default unless the relevant rules permit it or the actor can bypass the protection.

---

# 13. Version-Bump Branch Rules

The automation creates branches matching:

```text
deploy/chore-version-bump-v*
```

Example:

```text
deploy/chore-version-bump-v1.9.0
```

Verify that repository push rules do not prevent the automation identity from creating these branches.

When a global branch ruleset applies to all branches, add an appropriate bypass for the automation identity.

Do not require manual commit signing for these generated branches unless the automation is configured to create verifiable signed commits.

---

# 14. Tag Rules

The automation creates annotated tags:

```text
vX.Y.Z
```

Examples:

```text
v1.8.4
v1.9.0
v2.0.0
```

When the repository uses tag rulesets, ensure the automation identity may create tags matching:

```text
v*
```

Recommended tag protection:

* restrict tag updates
* restrict tag deletion
* prevent tag recreation by normal developers
* allow the automation identity to create new version tags

Once a release tag is created, it should be treated as immutable.

The workflow refuses to overwrite a tag that exists on a different commit.

---

# 15. Required Status Check

After committing `validate-version-impact.yml`, open or update a pull request so GitHub registers the check.

Then configure the `main` ruleset to require:

```text
Validate version impact
```

Depending on the GitHub interface, the displayed check may include both the workflow and job name.

Workflow name:

```text
Validate version impact
```

Job name:

```text
Validate version impact
```

Do not make the status check required until it has executed at least once and appears in the repository's available-check list.

---

# 16. Recommended Repository Roles

Suggested responsibilities:

| Role                | Responsibility                                 |
| ------------------- | ---------------------------------------------- |
| Release owner       | Creates and merges the `release → main` PR     |
| Git Guardian        | Reviews branch integrity and release readiness |
| Platform/DevOps     | Maintains workflows, tokens and rulesets       |
| Repository admin    | Configures rules and bypass access             |
| Automation identity | Performs the post-release mutations            |

The release owner remains responsible for selecting the correct Version Impact.

The automation applies the selected value but does not determine whether a change is logically patch, minor or major.

---

# 17. First-Time Setup Sequence

Perform the setup in this order:

1. Verify `package.json` contains the current production version.
2. Add the pull-request template.
3. Add the Version Impact parser.
4. Add the validation workflow.
5. Add the post-release workflow.
6. Merge the setup files into `main`.
7. Create the automation GitHub App or machine account.
8. Create the fine-grained PAT when not using a GitHub App.
9. Add `RELEASE_AUTOMATION_TOKEN`.
10. Configure `main` protection.
11. Configure `release` protection.
12. Add the automation identity to the required bypass lists.
13. Run the validation workflow once.
14. Make `Validate version impact` a required status check.
15. Create a test `release` branch from `main`.
16. Run a controlled non-production release test.

---

# 18. Recommended Test Repository

Do not enable the automation for the first time during a real production release.

Use one of:

* a temporary private repository
* a fork with Actions enabled
* a dedicated sandbox repository
* a temporary copy of the production repository

The test repository should have:

```text
main
release
package.json
at least one open PR targeting release
the complete .github workflow configuration
```

Use a harmless version such as:

```json
{
  "version": "0.1.0"
}
```

---

# 19. Smoke Test Checklist

## Validation test

Create:

```text
release → main
```

with no Version Impact selected.

Expected result:

```text
Validate version impact: Failed
```

Select two options.

Expected result:

```text
Validate version impact: Failed
```

Select exactly one option.

Expected result:

```text
Validate version impact: Passed
```

## Patch test

Start with:

```json
{
  "version": "0.1.0"
}
```

Select:

```md
- [x] **patch**
```

Expected:

```text
Tag: v0.1.0
New release version: 0.1.1
Generated PR: [deploy] chore: version bump 0.1.1
```

## Minor test

Start with:

```json
{
  "version": "0.1.0"
}
```

Select:

```md
- [x] **minor**
```

Expected:

```text
Tag: v0.1.0
New release version: 0.2.0
Generated PR: [deploy] chore: version bump 0.2.0
```

## Major test

Start with:

```json
{
  "version": "0.1.0"
}
```

Select:

```md
- [x] **major**
```

Expected:

```text
Tag: v0.1.0
New release version: 1.0.0
Generated PR: [deploy] chore: version bump 1.0.0
```

## None test

Select:

```md
- [x] **none**
```

Expected:

```text
No tag
No version change
No version-bump PR
release recreated from main
Open PR bases restored to release
```

---

# 20. Open PR Retargeting Test

Before merging the Release PR, create a separate test PR:

```text
feature/example → release
```

After merging:

```text
release → main
```

verify that the automation:

1. temporarily changes the feature PR base to `main`
2. deletes the old `release`
3. creates a new `release`
4. changes the feature PR base back to `release`

Review the feature PR diff after the base is restored.

Changing a pull request's base can change its displayed commit range and may affect review context, so the team should understand that temporary retargeting is an intentional part of this process.

---

# 21. Failure Scenarios to Test

Test these conditions in a sandbox repository:

## Existing tag on the correct commit

Expected:

```text
Workflow recognises the existing tag and continues.
```

## Existing tag on a different commit

Expected:

```text
Workflow fails and does not overwrite the tag.
```

## Existing version-bump branch

Expected:

```text
Workflow fails instead of overwriting the branch.
```

## Token cannot delete `release`

Expected:

```text
Workflow fails during branch deletion.
```

Resolution:

```text
Update release ruleset bypass permissions.
```

## Token cannot merge the generated PR

Expected:

```text
Version-bump PR remains open.
```

Resolution:

```text
Update release ruleset or automation identity permissions.
```

## Package version is invalid

Example:

```json
{
  "version": "release-1"
}
```

Expected:

```text
Workflow fails before tag creation.
```

---

# 22. Production Readiness Checklist

Before the first production use, confirm:

* [ ] `package.json` contains the correct currently released version
* [ ] `main` contains all required workflow files
* [ ] `release` exists
* [ ] GitHub Actions is enabled
* [ ] Merge commits are enabled
* [ ] `RELEASE_AUTOMATION_TOKEN` exists
* [ ] The token has Contents read/write
* [ ] The token has Pull Requests read/write
* [ ] The automation identity can create tags
* [ ] The automation identity can create GitHub Releases
* [ ] The automation identity can delete `release`
* [ ] The automation identity can recreate `release`
* [ ] The automation identity can merge into `release`
* [ ] The automation identity can create version-bump branches
* [ ] `Validate version impact` is required on `main`
* [ ] Normal build and test checks are required
* [ ] A sandbox patch test has passed
* [ ] A sandbox minor test has passed
* [ ] A sandbox major test has passed
* [ ] A sandbox `none` test has passed
* [ ] PR retargeting has been verified
* [ ] The team knows how to inspect and rerun the workflow
* [ ] The token owner and rotation policy are documented

---

# 23. Operational Notes

## Updating a release PR branch

The post-release workflow starts only after the `release → main` PR is merged
and checks out that merge commit from `main`. Updating the release PR branch is
therefore not required merely to make post-release automation use `main`.

Use GitHub's **Update branch** only when it is required by branch protection or
when the release PR should be re-tested against the latest `main`. If an update
is needed during this flow, prefer merging `main` into `release`; avoid rebasing
the rotating `release` branch during post-release recovery.

## Do not manually create the next version bump

After merging `release → main`, allow the post-release automation to create the next version.

Manual version changes can cause:

* duplicate tags
* conflicting version-bump branches
* an incorrect package version
* workflow failures

## Do not delete `release` during execution

The workflow controls the release branch lifecycle.

## Do not edit open PR bases during execution

Open pull requests are temporarily moved by the workflow and later restored.

## Do not rerun multiple post-release workflows concurrently

The workflow includes concurrency control to prevent overlapping post-release executions.

## Inspect failures before rerunning

Before rerunning, check for:

* an already-created tag
* an existing version-bump branch
* an open version-bump PR
* a recreated `release` branch
* PRs still targeting `main`

The workflow protects several operations against duplication, but a failed run may still require cleanup.

## Recovering after a version-bump PR failure

Do not rerun the entire post-release workflow blindly after it has created the
version-bump branch. A rerun can stop on that existing branch and may rotate
`release` again. Instead:

1. check whether the `deploy/chore-version-bump-vX.Y.Z` branch has an open PR
   into `release`;
2. create that PR manually if it is missing, then merge it;
3. restore any feature PRs left targeting `main` back to `release`;
4. fix and merge the workflow before the next release.

---

# 24. Recommended Long-Term Configuration

For production use, the recommended configuration is:

```text
Authentication:
Dedicated GitHub App

Main:
Protected by ruleset
PR required
Approvals required
Status checks required
Deletion blocked
Force pushes blocked

Release:
Protected by ruleset
PR required
Status checks required
Automation App has bypass access
Deletion allowed only through bypass

Tags:
v* protected from update and deletion
Automation App allowed to create new tags

Secret:
RELEASE_AUTOMATION_TOKEN

Required check:
Validate version impact
```

This configuration preserves normal branch governance while giving one narrowly scoped automation identity the permissions required to execute the post-release lifecycle.
