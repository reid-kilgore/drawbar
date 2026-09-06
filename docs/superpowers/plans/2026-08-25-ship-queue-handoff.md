# HANDOFF — drawbar ship queue design

Written 2026-08-25. Session was design conversation only. **No code was written, no agent
was dispatched, no file in the repository was modified.**

## User goal

The user asked whether `/drawbar-ship` can be pointed at a Linear *project* instead of a
single parent issue. The conversation moved from that question to designing a queue layer
that runs several parent issues in one unattended night. Nothing has been built yet. The
next session starts from an approved design and an open sequencing question.

## Latest approved scope

Three pieces, agreed by the user through a blocking `ask-questions` form (answers recorded
below, verbatim intent):

1. **A queue command.** New `/drawbar-ship-queue <name>`, driven by `/loop` the same way
   `/drawbar-ship` is today. It holds an ordered list of parent issue ids and delegates one
   story per tick to the existing ship runbook, pointed at whichever parent is current.
   Each parent keeps its own run-state file, its own snapshot, and its own pull-request
   stack. A new `queue-state.ts` module parses and refuses the queue state file with the
   same discipline `scripts/lib/run-state.ts` uses today.

2. **A dry run that gates the queue.** The queue refuses to start without a passing dry
   run. Detail below.

3. **An adopt command.** Converts a set of pre-existing Linear issues into one or more
   drawbar stacks. Attended, human-gated, separate from the queue. Detail below.

## User decisions (do not re-litigate)

| Question | Answer |
|---|---|
| When one parent parks, what does the queue do? | **Always skip to the next parent. Never stop on a park.** The user chose this over the recommended "skip, but stop after two in a row". |
| Willing to edit the ship command itself? | **Yes.** Edit ship's two terminal sections so the queue can run unattended. |
| Base branch for each parent's first story? | **The configured base branch, every time.** Independent stacks per parent, not one long chain. |

Free-text the user added: "yeah we need a dry run to go on top of each queue before
starting so that we can identify config or other issues first — this is kind of like
preflight but perhaps a bit more rigorous. i also want some thought put into how we could
convert a set of existing issues into a drawbar stack or set of stacks".

Reconciliation already agreed in-session: because parks never stop the night, the dry run
is a **gate, not a report**. Those two are one decision, not two features.

## Current phase and exact resume action

Phase: design agreed, sequencing question open.

**The single open question the user has not answered:** should the adopt command be built
after the queue and dry run are working, or designed alongside them because its output
format is the queue file? The assistant's stated recommendation is to build the queue and
dry run together first, then adopt. Resume by putting that question to the user, then
begin implementation of the queue and dry run.

## The design, in enough detail to resume without re-deriving it

### Queue mechanics

The queue does not need ship to report anything new. Each parent's outcome is derivable
from that parent's existing run-state file at `$ENV_DIR/.drawbar/runs/<PARENT>.json`:

- **finished** — every `snapshot` member is in `stories_done` and `in_flight` is `null`
- **parked** — `in_flight` is `null` but stories remain
- **crashed** — `in_flight` is non-null and older than twice the heartbeat (ship's own
  existing staleness rule)

Proposed queue state file location: `$ENV_DIR/.drawbar/runs/queues/<name>.json`. A
subdirectory rather than a `queue-<name>.json` sibling, to remove any chance of collision
with a run-state file named from an argument. `$ENV_DIR/.drawbar/runs/.gitignore` already
exists.

Constraint carried over from `run-state.ts`: the queue name is interpolated into a
filesystem path, so it must pass the same `isSafePathSegment` shape check (no `/`, no `\`,
no `..`, non-empty after trimming, no control characters).

### The two ship edits

`/Users/reid/dev/fun_claude/drawbar/commands/drawbar-ship.md` ends both terminal paths with
`ScheduleWakeup({stop: true})`:

- "Parking a story", around line 934
- "Finishing the run", around line 1135

Both need: if a queue file names this run, hand control back to the queue instead of
stopping. Roughly two paragraphs of runbook text. A wrapper cannot intercept those calls
without contradicting the command it wraps, which is why the user approved editing ship
directly rather than attempting a zero-touch layer.

### The dry run

Runs once, before any story is dispatched. Never dispatches, never writes to Linear,
touches git read-only.

Machine and configuration layer — **call ship's own modules, never reimplement them**
(this repository has an explicit single-implementation-site discipline, visible throughout
the comments in `scripts/lib/`):

- `scripts/lib/ship-config.ts validate` — repository identity, `projectDir` / `envDir`
  separation, team resolution, base branch being the repository default
- `scripts/lib/kb-sync.ts preflight` — the knowledge repository
- the tracked-config refusal (a real ship config is never tracked by git)

Queue shape layer:

- every id resolves in Linear and belongs to the configured team
- no id appears twice
- no queued parent is an ancestor or descendant of another queued parent

Per-parent layer, and the most valuable part:

- build each parent's snapshot exactly as ship's step 0 would, without side effects, and
  evaluate step 0's halt conditions ahead of time — every `Todo` child carries a
  `## Dependencies` section, every relation query returned a result object, the graph is
  acyclic
- report the resulting order and story count per parent, which doubles as the night's cost
  estimate at roughly 840,000 subagent tokens per story
- report any queued parent that already has a run-state file, and what state it is in, so
  resumes are visible before the night starts
- predict each story's branch name from Linear's `gitBranchName` and flag collisions with
  branches left over from an earlier run

### Refactor this needs (identified, not yet done)

Ship's step 0 dependency-evidence rules exist **only as prose in the runbook**. For the dry
run to evaluate the same rules, that logic must move into a module both the dry run and
ship call. This is the one real refactor in the queue work. Do not write a second copy.

### Residual hole and its agreed fix

The dry run cannot catch something that breaks mid-night, such as an expired GitHub token.
Under "never stop on a park", the queue would then burn through every remaining parent
doing nothing. Agreed fix: when the queue advances to a new parent it re-runs the
**machine-level guards only** and stops if one fails. This is not stopping on a park — it
is ship's existing preflight refusal, which already halts today. This respects the user's
answer rather than working around it.

### The adopt command

Shape: `/drawbar-plan` run backwards. Plan goes from one locked specification to ordered
stories; adopt goes from a set of loose pre-existing issues to a specification plus
normalized stories.

Steps: read the set; build the dependency graph from both Linear relations and prose;
partition into connected components; propose one stack per component with a parent issue
holding each component's specification; rewrite each story into the Locked and Discretion
template with acceptance criteria and an explicit `## Dependencies` section; gate on the
operator confirming; then write to Linear. Its output is a queue file, which is how adopt
and the queue meet.

Two points to preserve:

- **Adopt must be allowed to refuse.** An issue reading "fix the login bug" with no further
  detail cannot be reformatted into a testable story. Those get handed back to
  `/drawbar-design` rather than adopted. Inventing acceptance criteria produces a green run
  against fiction.
- **The partition is a proposal to a human, not an inference at runtime.** Earlier in the
  session the assistant argued that ship must never infer scope from graph connectivity,
  because ship's own rule says an empty relation set is not evidence of independence. Doing
  the same computation inside an attended, human-confirmed adopt command is different in
  kind and does not contradict that rule.

## Facts established this session, with provenance

All first-hand, read directly from the repository at revision `6da8867`:

- Ship's argument is a Linear issue id, parent or leaf. `invoked_as` is pinned to
  `"parent" | "leaf"` and `parseRunState` refuses any other value —
  `/Users/reid/dev/fun_claude/drawbar/scripts/lib/run-state.ts:274`.
- The run state holds exactly ten keys and **no** field records "parked" or "finished" —
  `run-state.ts:62` onward, `REQUIRED_KEYS` at `run-state.ts:81`.
- Every story after the first bases on the previous story's branch, from one
  implementation site — `baseForNextStory`,
  `/Users/reid/dev/fun_claude/drawbar/scripts/lib/stack.ts:111`.
- Ship builds a dependency graph in step 0 and uses it **only to order**, never to
  partition. Unrelated members keep `list_issues` order as a stable tiebreak.
- Ship's "Locked F" states it never merges, never verifies a merge, and never inspects
  whether one happened. Out-of-order merge detection is a contract, not a gap — explicitly
  not to be filed as follow-up work.
- Stories already carry a Linear project, inherited from the parent or set by
  `--project` — `/Users/reid/dev/fun_claude/drawbar/commands/drawbar-plan.md:25`.

## Repository and runtime state

- Branch `main`, revision `6da8867`, single worktree at
  `/Users/reid/dev/fun_claude/drawbar`. No other worktree exists.
- **No tracked file was modified.** `git diff --stat` is empty and nothing is staged.
- Untracked directories present: `.codex-plugin/` and seven directories under `skills/`.
  These were **already untracked at session start** and are user-owned. This session did
  not create or touch them. Do not assume they are part of this work.
- **No active writer of any kind.** No agent was dispatched, no background process was
  started, no cron was created, no pull request was opened, no Linear issue was read or
  written through MCP. There is no runtime identifier to reconcile and nothing to stop.
- No tests or checks were run this session, because nothing was changed.

## Files to read first, absolute paths

- `/Users/reid/dev/fun_claude/drawbar/commands/drawbar-ship.md` — 1252 lines. The two
  sections to edit are "Parking a story" (~line 934) and "Finishing the run" (~line 1135).
  The "Preflight" section (~line 72) is what the dry run must reuse rather than copy.
- `/Users/reid/dev/fun_claude/drawbar/scripts/lib/run-state.ts` — the schema discipline
  `queue-state.ts` should follow.
- `/Users/reid/dev/fun_claude/drawbar/scripts/lib/stack.ts` — `resolveBase`,
  `baseForNextStory`, `assertChainIntact`.
- `/Users/reid/dev/fun_claude/drawbar/scripts/lib/ship-config.ts` — `validate`, and the
  shared predicates `isNonEmptyTrimmed`, `isValidRefName`, `isCleanAbsolutePath`.
- `/Users/reid/dev/fun_claude/drawbar/scripts/lib/kb-sync.ts` — `preflight`.
- `/Users/reid/dev/fun_claude/drawbar/commands/drawbar-plan.md` — the template adopt must
  produce, and the parent-to-story relationship adopt must invert.

## Warnings

- Nothing in this handoff has been implemented. Every design statement above is a decision,
  not a fact about code that exists.
- The story count and token figures are ship's own documented estimate, not a measurement
  taken this session.
- Line numbers in `drawbar-ship.md` are from revision `6da8867`. Confirm them before
  editing if `main` has moved.
