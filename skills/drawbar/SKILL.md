---
name: drawbar
description: Route a Drawbar setup, design, plan, work, ship, or learn request to the matching workflow. Use when the user invokes $drawbar followed by a subcommand or asks to use the Drawbar workflow without naming a specific Drawbar skill.
---

# Drawbar router

Supported subcommands are `setup`, `design`, `plan`, `work`, `ship`, and `learn`.

1. Read the first subcommand from the user's request.
2. Read the matching sibling skill completely:
   - `../drawbar-setup/SKILL.md`
   - `../drawbar-design/SKILL.md`
   - `../drawbar-plan/SKILL.md`
   - `../drawbar-work/SKILL.md`
   - `../drawbar-ship/SKILL.md`
   - `../drawbar-learn/SKILL.md`
3. Follow that skill and pass the remaining user text as its arguments.
4. If the user gives no subcommand, list the supported subcommands and stop.

Current user instructions and repository `AGENTS.md` files always take precedence over Drawbar defaults.
