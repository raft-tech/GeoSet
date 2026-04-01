# GeoSet Versioning

**Current Version:** 6.0.49
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
| 6.0.49 | [#354](https://github.com/raft-tech/GeoSet/pull/354) | Add lasso spatial selection tool to map charts |
| 6.0.48 | [#348](https://github.com/raft-tech/GeoSet/pull/348) | Fix up wiki docs within GitHub |
| 6.0.47 | [#346](https://github.com/raft-tech/GeoSet/pull/346) | Add lazy loading for layers in GeoSet Multi Map |
| 6.0.46 | [#345](https://github.com/raft-tech/GeoSet/pull/345) | Establish React component testing patterns for geoset-map-chart |
| 6.0.45 | [#333](https://github.com/raft-tech/GeoSet/pull/333) | Update Claude commands and docs for fork-based workflow |
| 6.0.44 | [#340](https://github.com/raft-tech/GeoSet/pull/340) | Repurpose Map Chart Category for GeoSet Charts Only |
| 6.0.43 | [#341](https://github.com/raft-tech/GeoSet/pull/341) | ci: Use GeoSetBot app token in CI/CD workflows |
| 6.0.42 | [#319](https://github.com/raft-tech/GeoSet/pull/319) | feat: Add Percentile-Based Bounds for colorByValue |
| 6.0.41 | [#325](https://github.com/raft-tech/GeoSet/pull/325) | Replace inline JSON template popover with wiki link |
| 6.0.40 | [#326](https://github.com/raft-tech/GeoSet/pull/326) | Fix up README with logo, badges, and visual assets |
| 6.0.39 | [#322](https://github.com/raft-tech/GeoSet/pull/322) | docs: add JSON Config Spec wiki page |
| 6.0.38 | [#317](https://github.com/raft-tech/GeoSet/pull/317) | feat: Automated documentation sync for wiki, README, and inline docs |
| 6.0.37 | [#309](https://github.com/raft-tech/GeoSet/pull/309) | fix: prevent changelog loss when PRs merge concurrently |
| 6.0.36  | [#312](https://github.com/raft-tech/GeoSet/pull/312) | feat: add text overlay layer to Docker example charts                   |
| 6.0.35  | [#289](https://github.com/raft-tech/GeoSet/pull/289) | feat(geoset-map): consolidate duplicate legend entries by display title |
| 6.0.34  | [#306](https://github.com/raft-tech/GeoSet/pull/306) | chore: extract bump script and fix YAML quoting                         |
| 6.0.33  | [#301](https://github.com/raft-tech/GeoSet/pull/301) | fix: version bump fails when stale branch exists                        |
