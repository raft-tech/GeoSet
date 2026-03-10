# Commit and Push

Stage and commit all changes. Create a meaningful and concise commit message that summarizes the changes.

If there is an outstanding merge request associated with the active branch, update the merge request title and description appropriately. Refer to the /merge-request command for further instructions.

## Documentation Sync (Automatic, Background)

Before committing, launch a background Agent to run a documentation audit. The agent
should follow the full instructions in `.claude/sync-documentation.md` to check whether
any changed files require wiki, README, or inline documentation updates.

Run this agent in the background so it does not block the commit workflow. While the
agent runs, proceed with staging files and drafting the commit message. Before actually
creating the commit, wait for the agent to finish. If it produced any documentation
changes, include them in the same commit.
