# DART V2 Frontend <!-- omit in toc -->

For iteration two of the DART frontend we're building upon [Apache/Superset](https://github.com/apache/superset). We're developing custom plugins to meet our geospatial visualization needs.

- [Syncing with Apache/Superset](#syncing-with-apachesuperset)
- [Creating a Plugin](#creating-a-plugin)
  - [Adding to Superset](#adding-to-superset)

## Syncing with Apache/Superset

Apache Superset is constantly evolving and we need to consistently pull upstream changes into our codebase. Ensure you have Apache/Superset set as an upstream remote.

```bash
git remote add upstream https://github.com/apache/superset.git
git remote -v
```

Pull the latest upstream changes with the following command.

```bash
git pull upstream master
```

To reconcile changes, create a feature branch from `main`, merge changes from `master`, resolve any conflicting files, and create a merge request in Gitlab.

```bash
git checkout -b chore/update-superset
git fetch upstream
git merge upstream/master

# Resolve any conflicting files, and add them
git add <conflicting file>

git commit
git push origin chore/update-superset
```

Raise a new [Merge Request here](https://gitlab.management.acf.gov/systems/dart/dart-superset/-/merge_requests/new).

## Creating a Plugin

Use the publicly-available [Yeoman](https://yeoman.io/) template to generate a new plugin.

```bash
git clone https://github.com/apache/superset.git

npm i -g yo
cd superset-frontend/packages/generator-superset
npm i
npm link

mkdir /plugins/hello-dart
cd /plugins/hello-dart
yo @superset-ui/superset

npm ci
npm run build
```

__IMPORTANT:__ In your `package.json` file, be sure the plugin name begins with `@superset-ui/` or the webpack build process will not locate the files.

### Adding to Superset

Wire this plugin into Superset by making the node package available, and editing superset-frontend/src/visualizations/presets/MainPreset.js as below:

```bash
import { HelloDart } from '@superset-ui/hello-dart';

new HelloDart().configure({ key: 'ext_hello_dart' }),
```
