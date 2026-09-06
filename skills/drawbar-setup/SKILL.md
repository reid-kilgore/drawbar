---
name: drawbar-setup
description: Configure Drawbar for a repository, including its Linear team, optional project, knowledge store, and required local tools. Use when the user invokes $drawbar-setup or asks to set up Drawbar.
---

# Drawbar setup for Codex

Read `../../commands/drawbar-setup.md` completely, then follow it with the user's remaining text as `$ARGUMENTS`.

Codex runtime adaptations:

- Use the available Linear MCP tools instead of Claude-specific tool names.
- Use an explicitly selected `gpt-5.6-luna` agent for delegated mechanical checks.
- Apply current user instructions and repository `AGENTS.md` files before the command defaults.
- Do not commit setup changes on the primary agent thread. Use an explicitly selected Luna commit agent when a commit is requested.
