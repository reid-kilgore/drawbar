---
name: drawbar-learn
description: Curate durable lessons from completed Drawbar work into the repository knowledge base. Use when the user invokes $drawbar-learn or asks Drawbar to capture lessons.
---

# Drawbar learn for Codex

Read `../../commands/drawbar-learn.md` completely, then follow it with the user's remaining text as `$ARGUMENTS`.

Also read `../drawbar-knowledge/SKILL.md` completely before any knowledge-base read or write.

Codex runtime adaptations:

- Use an explicitly selected `gpt-5.6-luna` agent for delegated mechanical extraction or validation.
- Pipe structured JSON to `drawbar-kb`; do not interpolate knowledge content into shell commands.
- Apply current user instructions and repository `AGENTS.md` files before the command defaults.
