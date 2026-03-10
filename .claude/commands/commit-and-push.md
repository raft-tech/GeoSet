# Commit and Push

Stage and commit all changes. Create a meaningful and concise commit message that summarizes the changes.

If there is an outstanding merge request associated with the active branch, update the merge request title and description appropriately. Refer to the /merge-request command for further instructions.

## Wiki Audit (Automatic)

Before committing, you MUST run a documentation audit. Follow the full instructions in
`.claude/commands/sync-wiki.md` to check whether any changed files require wiki updates.
If the audit produces wiki or README changes, include them in the same commit.

This step is not optional — it runs every time.
