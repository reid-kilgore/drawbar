---
name: drawbar-ship
description: Execute dependency-ordered Drawbar stories through isolated implementation, review, commits, stacked pull requests, recovery, and Linear updates. Use when the user invokes $drawbar-ship or asks Drawbar to ship a planned issue graph.
---

# Drawbar ship for Codex

Read `../../commands/drawbar-ship.md` completely, then follow it with the user's remaining text as `$ARGUMENTS`.

Codex runtime adaptations:

- Use explicitly selected `gpt-5.6-terra` agents for story implementation and substantive review.
- Use explicitly selected `gpt-5.6-sol` agents only for architecture or plan-level ambiguity.
- Use explicitly selected `gpt-5.6-luna` agents for worktree mechanics, tests, formatting, CI monitoring, and commits.
- Never commit on the primary agent thread. Before dispatching a Luna commit agent, run the repository-required typecheck and lint prechecks.
- Preserve one writer per pull request and the command's recovery rules.
- Use the available Linear and GitHub tools instead of Claude-specific tool names.
- Apply current user instructions and repository `AGENTS.md` files before the command defaults.
