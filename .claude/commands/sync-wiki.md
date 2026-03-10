# Sync Wiki

Review code changes on the current branch and update wiki pages and README.md to stay
in sync with the codebase.

## Steps

1. **Read the mapping reference** at `.claude/wiki-mapping.md` to understand which code
   paths map to which wiki pages.

2. **Identify changed files.** Run `git diff --name-only` (unstaged) and
   `git diff --cached --name-only` (staged) to get the current working tree changes.
   Also run `git diff main...HEAD --name-only` to capture all changes on the branch.

3. **Match changed files to wiki pages (both directions).** For each changed file:
   - If a **code file** changed, look up which wiki page(s) it maps to (forward check).
   - If a **wiki file** (`wiki/*.md`) or `README.md` changed, look up which code paths
     map to that wiki page (reverse check) — these source files must be read and
     validated against the wiki content.
   Collect a deduplicated list of wiki pages and their associated source files that
   need review.

4. **Review each affected wiki page.** For each one:
   a. Read the wiki page.
   b. Read the associated source files (whether they triggered the mapping via a code
      change or via a reverse lookup from a wiki change).
   c. Compare the wiki content against the current state of the code. Look for:
      - Incorrect version numbers, file paths, or command references
      - Missing documentation for new features, config fields, or controls
      - References to files, directories, or commands that no longer exist
      - Outdated code examples or JSON config samples
      - Broken internal wiki links
   d. If updates are needed, edit the wiki page to reflect the current code.

5. **Check README.md for overlap.** If any wiki page was updated, also read README.md
   and check for overlapping content that may be inconsistent. Pay special attention to:
   - Feature lists
   - Quick Start / installation instructions
   - Links to wiki pages

6. **Special case: VERSIONING.md.** If VERSIONING.md was changed, ensure
   wiki/Versioning-And-Changelog.md reflects:
   - The correct current version number
   - The correct "Based on" upstream version
   - The correct versioning policy
   - Any new changelog entries

7. **Report what was done.** Summarize:
   - Which wiki pages were checked
   - Which pages were updated and what changed
   - Which pages needed no changes
   - Any issues found that require manual attention (e.g., missing screenshots)

## Important Notes

- This skill modifies files in `wiki/` and optionally `README.md`. It does NOT commit
  or push. Use `/commit-and-push` afterward.
- The `.github/workflows/sync-wiki.yml` workflow syncs `wiki/` to the GitHub Wiki when
  changes are merged to main. No manual wiki editing is needed.
- When documenting GeoJSON Config schema changes, refer to the Marshmallow schemas in
  `superset/geoset_map/schemas/` and the frontend `transformProps.ts` for the canonical
  list of supported fields.
- When documenting control panel changes, refer to the `controlPanel.ts` files in
  `layers/GeoSetLayer/` and `GeoSetMultiMap/`.
