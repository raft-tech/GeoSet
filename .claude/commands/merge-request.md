# Create Merge Request

Use the gh CLI tool to create a merge request for the current branch. Each merge request should have a concise title and a description of what was changed within the body.

## Linking an Issue

1. **Select an issue** using the `/issue-selection` skill. Use the prompt "Which GitHub issue does this PR close? Enter the number via 'Other', or choose an option below." and offer these options: **"Detect from branch name"**, **"List open issues"**, and **"No issue"**.

2. If an issue is selected, add `Closes #<number>` to the PR body and include the issue number in the title using a conventional commit prefix that matches the nature of the changes (e.g., `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `style`, `perf`). Format: `#<number> <prefix>: <short description>` (e.g., `#42 feat: add login page` or `#53 fix: user registration error`).

## Focus Score

Each merge request should be given a score indicating how focused the changes are. The score should range between 1 (unfocused) and 10 (focused). A merge request that changes many different, unrelated parts of the code is a 1. A merge request that focuses on one change is a 10.

## Target Branch

All merge requests should set the target branch to `main`.

If a merge request already exists for the source branch, update the merge request title and body if necessary.

## Reviewers

Always add the following reviewers to every PR using the `--reviewer` flag. **Do not** add the PR author as a reviewer - GitHub will reject it.
- ethanbienstock
- lhawkman27
- jmeegan2


## Structure

Merge requests should conform to the following template.

```markdown
## Summary

A list of key changes made

## Focus Score

State the score and an explanation for why the MR is or is not focused.

## Detailed Summary of Each File Changed

Enumerate through each changed file and provide a brief overview of what was changed.

## Test Plan

What needs to be tested and how should it be done?
```
