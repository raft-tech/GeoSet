# Create Branch

Create a new feature branch from a fresh pull of main, named after a GitHub issue.

## Steps

1. **Ask for the ticket number** using `AskUserQuestion` with the prompt "Enter your GitHub issue number via 'Other', or choose an option below." Provide two options:
   - "Create one for me" — ask what it's about, then run `gh issue create --repo raft-tech/GeoSet`
   - "List open issues" — run `gh issue list --repo raft-tech/GeoSet --limit 10` and let the user pick one

2. **Generate the branch name.** Fetch the issue title with `gh issue view <number> --repo raft-tech/GeoSet`, generate a short kebab-case summary, and confirm with the user. Format: `<number>-<short-name>` (e.g., `42-add-login-page`).

3. **Create the branch:**
   ```
   git fetch origin main
   git checkout -b <branch-name> origin/main
   ```

4. **Confirm** by running `git log --oneline -3`.
