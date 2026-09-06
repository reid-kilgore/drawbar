---
name: drawbar-design
description: Turn a rough feature idea into an approved design recorded in Linear, using focused questions, repository evidence, and design review. Use when the user invokes $drawbar-design or asks Drawbar to design a feature.
---

# Drawbar design for Codex

Read `../../commands/drawbar-design.md` completely, then follow it with the user's remaining text as `$ARGUMENTS`.

Codex runtime adaptations:

- Replace Opus planning or design reviewers with explicitly selected `gpt-5.6-sol` agents.
- Use `gpt-5.6-luna` only for mechanical code search or evidence collection.
- Use the available Linear MCP tools instead of Claude-specific tool names.
- Apply current user instructions and repository `AGENTS.md` files before the command defaults.
