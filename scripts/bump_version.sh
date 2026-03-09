#!/usr/bin/env bash
#
# Bumps the patch version in VERSIONING.md and appends a changelog row.
#
# Usage:
#   ./scripts/bump_version.sh [--pr-title TITLE] [--pr-number NUMBER] [--repo REPO]
#
# Options:
#   --pr-title    Title of the merged PR (falls back to last commit subject)
#   --pr-number   PR number (used to generate a link in the changelog)
#   --repo        GitHub repo slug, e.g. raft-tech/GeoSet (for PR link)
#   --dry-run     Print what would change without modifying files
#
# Outputs (to stdout):
#   NEW_VERSION=X.Y.Z
#
set -euo pipefail

VERSIONING_FILE="VERSIONING.md"
PR_TITLE=""
PR_NUMBER=""
REPO=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr-title)  PR_TITLE="$2"; shift 2 ;;
    --pr-number) PR_NUMBER="$2"; shift 2 ;;
    --repo)      REPO="$2"; shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -f "$VERSIONING_FILE" ]]; then
  echo "Error: $VERSIONING_FILE not found" >&2
  exit 1
fi

# Extract current version
CURRENT_VERSION=$(sed -n 's/.*\*\*Current Version:\*\* \([^ ]*\).*/\1/p' "$VERSIONING_FILE")
if [[ -z "$CURRENT_VERSION" ]]; then
  echo "Error: Could not extract current version from $VERSIONING_FILE" >&2
  exit 1
fi

# Compute new version
MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
PATCH=$(echo "$CURRENT_VERSION" | cut -d. -f3)
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

# Fall back to last commit subject if no PR title given
if [[ -z "$PR_TITLE" ]]; then
  PR_TITLE=$(git log -1 --pretty=%s 2>/dev/null || echo "unknown")
fi

# Build PR link
PR_LINK=""
if [[ -n "$PR_NUMBER" && -n "$REPO" ]]; then
  PR_LINK="[#$PR_NUMBER](https://github.com/$REPO/pull/$PR_NUMBER)"
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "Current version: $CURRENT_VERSION"
  echo "New version:     $NEW_VERSION"
  echo "PR title:        $PR_TITLE"
  echo "PR link:         ${PR_LINK:-"(none)"}"
  echo "---"
  echo "Would update $VERSIONING_FILE version to $NEW_VERSION"
  echo "Would add changelog row: | $NEW_VERSION | $PR_LINK | $PR_TITLE |"
  echo "NEW_VERSION=$NEW_VERSION"
  exit 0
fi

# Update version number (sed -i '' for macOS, sed -i for Linux)
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s/\*\*Current Version:\*\* $CURRENT_VERSION/**Current Version:** $NEW_VERSION/" "$VERSIONING_FILE"
else
  sed -i "s/\*\*Current Version:\*\* $CURRENT_VERSION/**Current Version:** $NEW_VERSION/" "$VERSIONING_FILE"
fi

# Insert changelog row after the table separator line
NEW_ROW="| $NEW_VERSION | $PR_LINK | $PR_TITLE |"
awk -v row="$NEW_ROW" '/^\| -+ \| -+ \| -+ \|$/ { print; print row; next } 1' "$VERSIONING_FILE" > "$VERSIONING_FILE.tmp"
mv "$VERSIONING_FILE.tmp" "$VERSIONING_FILE"

echo "NEW_VERSION=$NEW_VERSION"
