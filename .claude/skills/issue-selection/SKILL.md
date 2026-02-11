---
name: issue-selection
description: Guide users through selecting a GitHub issue for branching, PRs, or other workflows.
disable-model-invocation: true
allowed-tools: Bash(gh *)
---

# Issue Selection

## Flow

1. **Ask for the ticket number** using `AskUserQuestion`. The calling command specifies the prompt text and which options to include from the list below.

2. **Available options** (each command chooses which to offer):

   - **"Detect from branch name"** — Parse the current branch name for a leading issue number (e.g., `42-add-login-page` → issue #42) and confirm with the user.
   - **"List open issues"** — Run `gh issue list --repo raft-tech/GeoSet --limit 10`, then present the results in a **second** `AskUserQuestion`. Include up to 4 issues as named options (prioritizing the most likely match based on context), and list all 10 issues with their numbers and titles in the question text so the user can enter any number via "Other".
   - **"Create one for me"** — Ask what the issue is about, then run `gh issue create --repo raft-tech/GeoSet`.
   - **"No issue"** — Skip issue selection and continue without linking.

3. **Return** the selected issue number (or none) back to the calling command's flow.
