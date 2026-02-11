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
