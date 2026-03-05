---
allowed-tools: Bash(gh *), Bash(docker *), Bash(lsof *), Bash(for port *)
---

# Run MR Build Locally

Pull a prebuilt Docker image from a PR or commit and launch a local GeoSet stack.

Argument: `$ARGUMENTS` — a PR number (numeric) or a full commit SHA, optionally followed by `--run-rhel`.

## What to do

1. **Parse the arguments**
   - Split `$ARGUMENTS` on whitespace.
   - If `--run-rhel` is present, set `rhel=true` and remove it from the argument list.
   - The remaining token is the main argument: if purely numeric → PR number, otherwise → commit SHA.
   - If blank or missing, stop and ask the user to provide a PR number or commit SHA.

2. **Resolve the commit SHA** (PR path only)
   - Run: `gh pr view <number> --repo raft-tech/GeoSet --json headRefOid --jq '.headRefOid'`
   - If the PR is not found, stop and report the error.
   - Store the full SHA for subsequent steps.

3. **Check CI status** (PR path only — skip this step when a SHA was provided directly)
   - Run: `gh run list --repo raft-tech/GeoSet --commit <full-sha> --workflow docker-build.yml --json status,conclusion,url --limit 5`
   - **Success** (`status=completed`, `conclusion=success`) → proceed.
   - **In progress or queued** → tell the user to wait, show the run URL, and stop.
   - **Failed** → show the run URL and stop.
   - **No matching runs found** → warn the user that no CI build was found for this commit. Ask if they want to try pulling the image anyway. If they decline, stop.

4. **Determine the image tag**
   - If `rhel=true`: tag is `<full-sha>-rhel`
   - Otherwise: tag is `<full-sha>`

5. **Pull the image**
   - Run: `docker pull ebienstock/geoset:<tag>`
   - If the pull fails, stop and report the error.

6. **Find an available port**
   - Starting at port 8088, increment through 8088–9000.
   - For each candidate port, check availability with: `lsof -i :<port>`
   - If no output, the port is free — use it.
   - If every port in the range is occupied, stop and report.

7. **Launch the stack**
   - Set the stack name:
     - PR path: `geoset-pr-<number>` (append `-rhel` if rhel=true)
     - SHA path: `geoset-<first-7-chars-of-sha>` (append `-rhel` if rhel=true)
   - Run:
     ```
     STACK_NAME=<stack-name> SUPERSET_IMAGE=ebienstock/geoset:<tag> SUPERSET_PORT=<port> \
       docker compose -f docker-compose.prebuilt.yml up -d
     ```
   - Wait a few seconds, then run `docker compose -p <stack-name> ps` to confirm services are starting.

8. **Report results**
   - URL: `http://localhost:<port>`
   - Stack name: `<stack-name>`
   - Image: `ebienstock/geoset:<tag>`
   - Base: RHEL if `--run-rhel` was used, Debian otherwise
   - Useful commands:
     - Logs: `docker compose -p <stack-name> logs -f`
     - Teardown: `docker compose -p <stack-name> down`
   - Note: it may take a minute or two for Superset to fully initialize.
