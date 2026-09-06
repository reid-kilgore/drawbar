---
name: drawbar-plan
description: Convert an approved Drawbar design into ordered, dependency-aware Linear stories with executable acceptance criteria. Use when the user invokes $drawbar-plan or asks Drawbar to plan approved work.
---

# Drawbar plan for Codex

Read `../../commands/drawbar-plan.md` completely, then follow it with the user's remaining text as `$ARGUMENTS`.

Codex runtime adaptations:

- Use explicitly selected `gpt-5.6-sol` agents for planning, dependency analysis, and architecture review.
- Use `gpt-5.6-luna` only for mechanical repository inspection.
- Use the available Linear MCP tools instead of Claude-specific tool names.
- Apply current user instructions and repository `AGENTS.md` files before the command defaults.
