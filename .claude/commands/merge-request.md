# Create Merge Request

Use the gh CLI tool to create a merge request for the current branch. Each merge request should have a concise title and a description of what was changed within the body.

Additionally, each merge request should be given a score indicating how focused the changes are. The score should range between 1 (unfocused) and 10 (focused). A merge request that changes many different, unrelated parts of the code is a 1. A merge request that focuses on one change is a 10.

All merge requests should set the target branch to `main`.

If a merge request already exists for source branch, update the merge request title and body if necessary.

## Documentation Sync (Automatic, Background)

Before creating or updating the merge request, launch a background Agent to run a
documentation audit. The agent should follow the full instructions in
`.claude/skills/sync-documentation.md` to check whether any changed files on this branch
require wiki, README, or inline documentation updates.

Run this agent in the background so it does not block MR preparation. While the agent
runs, proceed with analyzing changes and drafting the MR title and body. Before actually
creating the MR, wait for the agent to finish. If it produced any documentation changes,
commit them to the branch first (skip re-running the documentation sync for that commit).

## Reviewers

Always add the following reviewers to every PR using the `--reviewer` flag. **Do not** add the PR author as a reviewer - GitHub will reject it.

- ethanbienstock
- lhawkman27
- jmeegan2

## Structure

Merge requests should comform to the following template.

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
