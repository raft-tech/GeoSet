# Claude Skills

Skills are custom commands with supporting reference files. Each skill is a directory with a `SKILL.md` file.

## Structure

```
.claude/skills/
  my-skill/
    SKILL.md        # required — frontmatter + instructions
    reference.md    # optional supporting files
```

## SKILL.md Format

```yaml
---
name: my-skill
description: When Claude should auto-invoke this skill
disable-model-invocation: true  # set to only allow manual invocation
---

Instructions for Claude go here.
Reference any supporting files in this directory.
```

## Invocation

- Manual: type `/my-skill` in Claude Code
- Auto: Claude invokes it when your `description` matches the conversation (remove `disable-model-invocation` for this)

## Local Skills

Prefix with `local-` for personal skills that won't be committed (gitignored):

```
.claude/skills/local-my-thing/
```

## Plugins

Plugins are shareable, versioned bundles of skills, commands, hooks, and MCP servers that can be installed from marketplaces.

### Browsing & Installing Plugins

**Interactive (recommended):** Run `/plugin` in Claude Code to open the plugin manager, then:

1. **Discover** tab — browse available plugins from all added marketplaces
2. Select a plugin and press **Enter** to install
3. Choose a scope:
   - **User** — available to you across all projects
   - **Project** — shared with collaborators (saved to `.claude/settings.json`)
   - **Local** — just for you in this repo only

**CLI:**

```bash
# Add a marketplace (the official one is available by default)
/plugin marketplace add owner/repo

# Install a specific plugin
/plugin install plugin-name@marketplace-name
```

### Using Plugin Skills

Plugin skills are namespaced to avoid conflicts:

```
/plugin-name:skill-name
```

For example, the `frontend-design` plugin provides `/frontend-design:frontend-design`.

### Managing Plugins

- `/plugin` — open the plugin manager to view installed plugins, update, or remove them
- **Installed** tab — manage and uninstall existing plugins
- **Marketplaces** tab — add or remove marketplace sources
