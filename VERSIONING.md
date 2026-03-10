# GeoSet Versioning

**Current Version:** 6.0.36
**Based on:** Apache Superset 6.0.0

> GeoSet aligns with Apache Superset's major and minor version. For example, when Superset releases version 6.1.0, GeoSet will sync with Superset, and GeoSet's version will be set to 6.1.0. However, the GeoSet and Superset patch version numbers (the third value) increment independently. Our patch version is simply a counter of how many merge requests GeoSet has merged since the last sync with upstream Superset.

## Versioning Policy

- **MAJOR** (X.0.0) — Tied to the upstream Superset major version
- **MINOR** (0.X.0) — Tied to the upstream Superset minor version
- **PATCH** (0.0.X) — New GeoSet features, enhancements, bug fixes, or mid-release upstream syncs.

## Automation

Version incrementing is handled automatically by the `Version Bump` GitHub Actions workflow ([`.github/workflows/version-bump.yml`](.github/workflows/version-bump.yml)). When a PR is merged to `main`, the workflow increments the patch version, updates the changelog below, creates a git tag, and triggers Docker image builds. No manual version changes are needed.

## Changelog

| Version | PR                                                   | Description                                                             |
| ------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| 6.0.36  | [#312](https://github.com/raft-tech/GeoSet/pull/312) | feat: add text overlay layer to Docker example charts                   |
| 6.0.35  | [#289](https://github.com/raft-tech/GeoSet/pull/289) | feat(geoset-map): consolidate duplicate legend entries by display title |
| 6.0.34  | [#306](https://github.com/raft-tech/GeoSet/pull/306) | chore: extract bump script and fix YAML quoting                         |
| 6.0.33  | [#301](https://github.com/raft-tech/GeoSet/pull/301) | fix: version bump fails when stale branch exists                        |
