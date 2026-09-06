---
name: drawbar-work
description: Implement one Drawbar Linear story test-first, verify it, run code and security review, open a pull request, and leave the issue ready for human review. Use when the user invokes $drawbar-work or asks Drawbar to work an issue.
---

# Drawbar work for Codex

Read `../../commands/drawbar-work.md` completely, then follow it with the user's remaining text as `$ARGUMENTS`.

Codex runtime adaptations:

- The primary Codex agent is the workflow lead.
- Replace the Sonnet story implementer with an explicitly selected `gpt-5.6-terra` agent.
- Use explicitly selected `gpt-5.6-terra` agents for substantive code and security review.
- Use explicitly selected `gpt-5.6-luna` agents for mechanical test runs, formatting, CI monitoring, and commits.
- Never commit on the primary agent thread. Before dispatching a Luna commit agent, run the repository-required typecheck and lint prechecks.
- Use the available Linear and GitHub tools instead of Claude-specific tool names.
- Apply current user instructions and repository `AGENTS.md` files before the command defaults.
