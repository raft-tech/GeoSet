# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a customized Apache Superset deployment for GeoSet, a tool for geospatial data monitoring. It includes custom geospatial visualization plugins.

## Backend

Details related to the backend can be found within the `superset/CLAUDE.md` file.

## Frontend

Details related to the frontend and plugin development can be found within the `superset-frontend/CLAUDE.md` file.

## Git/GitHub

This is a fork of Apache Superset. When using `gh` CLI commands (PRs, issues, etc.), always target the fork repo explicitly with `--repo raft-tech/GeoSet`.

## Versioning

When pulling in upstream Apache Superset changes, update the **"Based on"** field in `VERSIONING.md` to reflect the upstream version that was synced (e.g., `Apache Superset 6.1.0`).

## Documentation

Wiki pages live in `wiki/` and are synced to the GitHub Wiki on merge to main via `.github/workflows/sync-wiki.yml`. Use `/sync-wiki` to review code changes and update wiki pages and README.md before committing. The code-to-wiki mapping is in `.claude/wiki-mapping.md`.

## Important Notes

- Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.