---
name: drawbar-plan
description: Decompose a locked design (a Linear parent issue) into good, testable, ordered story sub-issues using the Locked/Discretion template.
argument-hint: "<issue-id of the parent issue> [--project <linear project>]"
---

# drawbar plan

Turn the locked spec into a sequence of small, testable stories. Each story is a Linear sub-issue under the parent.

## Preflight

```bash
command -v drawbar-kb >/dev/null 2>&1 || { echo "drawbar-kb not found — run /drawbar-setup"; exit 1; }
KB=$(drawbar-kb path) || { echo "drawbar context unresolvable — run /drawbar-setup"; exit 1; }
[ -d "$KB" ] || { echo "no knowledge base at $KB — run /drawbar-setup"; exit 1; }
```

`drawbar-kb path` resolves the store from the main worktree root, so a linked worktree reads the same knowledge as the main checkout. Use `$KB` from here on, never `$PWD/.drawbar/memory`.

## 1. Load the locked spec

`$ARGUMENTS` is the parent issue id, optionally followed by `--project <linear project>`. Load the parent with the Linear MCP `get_issue` (description + comments). This is the spec you are decomposing.

Sub-issues inherit neither team nor project automatically. Take both from the parent you just loaded; where `--project` is given it overrides the parent's project, and where the parent has no project, fall back to `project` from `drawbar-kb context --json` before asking the user.

## 2. Recall MUST-CHECK constraints

Detect the story's stack from the spec (languages, frameworks). Then:

```bash
drawbar-kb recall "MUST-CHECK <stack keywords>" --dir "$KB" --json
```

Every `MUST-CHECK:` entry returned becomes a validation rule the stories must honor.

## 3. Decompose into ordered stories

### Provenance — what you may assert as fact

Before you write a factual claim someone else will act on, ask the one question with a
mechanical answer:

**Did I read the thing that answers this question, in this session?**

- **Yes** → assert it, and cite `file:line`.
- **No** → do not assert it. Write it as an instruction to check.

The test is **per-question, not per-file**. A search that answered one question licenses
nothing about a different one in the same file: grepping `ruleSets` opens the schema and still
says nothing about whether a rule carries an `id`. Record what each read *established*, not
which paths you touched.

**Point at the evidence, not the conclusion.** Instead of "location rules have no `id`, keep
`key={index}`", write "I have not read the rule schema — check `BaseRuleSchema` in
`shared/types/locationGroup.ts` and match whichever is correct." The second is shorter, and it
produces the right result even when your belief is wrong. That is the whole trick: a belief
written as evidence-plus-instruction is self-correcting, while the same belief written as a
decision is binding — and an agent told it is a hard requirement will build it faithfully.

**Before instructing a copy or mirror, state what differs between the source's container and
the destination's container.** One line. If nothing differs, say so. Reading both sides is not
enough and never was: the one time this failed, both files had been read in full and the
sentence naming the difference was simply never written, so "match X exactly" shipped a
component that rendered flush against a panel border. The reference tells you what the code
says; only the comparison tells you what it will *do* where it lands. A `match X exactly` with
no difference line beside it is unwriteable.

**Prefer falsification over confirmation.** Search for the counter-example, not the example. If
a claim cannot be falsified cheaply, downgrade it to an instruction: "check whether X, and match
accordingly" rather than "X is true, do Y."


A false claim in a ticket outlives a false claim in a brief: nobody re-reads it, and it sits in
the backlog until someone implements it exactly as written.

Break the work into sequential stories (small enough to implement and review independently). For each, write a sub-issue description using this exact template:

```
## What
[Clear description of what to implement, in one paragraph.]

## Assumed context
[The documents a reader must already have. Write "None — this story stands alone" when true.
Overnight work needs standalone stories: nobody is awake to reconstruct context.]

## Terms
[Each product word whose looseness would change the code, bound once to its code symbol or its
exact scope. "None" is an answer when no term is load-bearing.]

## Context
[Relevant findings, constraints, patterns from the spec and recall. Your own conclusions
about how the code behaves live here, each with file:line and the question it answered.]

## Read set
[One line per read: what it established, and what it did NOT. A claim in this ticket that
no entry backs is a defect. For inherited references, state the degree of checking and the
commit they came from.]

## Decisions
### Locked
[Inherited from the parent — MUST be honored, do not re-debate. Each entry names its authority
and is backed by a Read set line. Write formulas, paths, or commands — not intentions.]
### Locked non-changes
[Every review finding whose resolution is "do not do the tempting thing", with its reason in one
clause and its authority named. This is where a review conclusion survives to the implementer.]
### Discretion
[Where the implementing agent may choose.]

## Approaches ruled out
[One line each, including the layer the fix does not live in.]

## Scope
[The files this story touches, derived by tracing from the changed types and functions to every
production builder and caller — not by naming the ones you have in mind. Then the work explicitly
out of scope, and anything the implementer must never touch.]

## Open questions
[Each marked blocking or non-blocking, each with an owner. A story with an unanswered blocking
question is not Ready. "None" is an answer.]

## Testing
[Specific test cases and edge cases — testable. Include the axes the surface already has:
multi-select, the aggregate case, the empty state, permission scope.]

## Validation
[Acceptance criteria. Each one names the command, query, screen, or preview URL that settles it.
For any guard or rollback path, the criterion is a demonstration that it fires.]

## Dependencies
[Earlier stories that must be done first — defines order.]

## References
[Sources: spec sections, recalled knowledge keys, files.]
```

This template is the `ticket-quality` standard's required section list. Section 4 gates on it, and the
mechanical pre-check will reject a story that drops one. Read that skill for what each section is for and
the failure each prevents.

### What may carry the `Locked` label

`Locked` means someone decided this, and an implementing agent is told it is a hard
requirement rather than a suggestion. That authority has to come from somewhere.

**Only these may be Locked:** operator decisions, decisions inherited from the parent's
locked spec, design-review outcomes, and `MUST-CHECK:` entries recalled from the knowledge
base.

**Your own conclusions from reading code this session may NOT be Locked.** They are evidence,
not decisions — they belong in `## Context` with `file:line`, backed by a `## Read set` entry.
Neither `### Locked` nor `### Discretion` fits them: `Discretion` means the implementer chooses,
and an observation is not a choice.

This narrows `Locked`; it does not soften it. What still qualifies stays absolute.

## 4. Ready bar (gate, not a warning)

You wrote these stories. You are the last agent who can be trusted to say whether they are good, so
you do not say it.

First, the free mechanical pass. Write each story to a local markdown file and run:

```bash
/Users/reid/dev/meta-agent-repo/canonical-bundle/bin/ticket-precheck story-*.md
```

It checks form only — required sections, Locked entries that read as beliefs, acceptance criteria
that name nothing to run, unmarked open questions, and the word budget. A story that fails here never
costs an agent.

Then dispatch `ticket-simulator` and `ticket-premise-auditor` concurrently over the stories that
passed. Neither may be you, and neither reads the other's output. Give each one the story text and
the repository, and nothing else — no summary of what you believe is right, and no note about what
the other found.

A story is Ready when the simulator returns sufficient and the auditor returns sound. Unsupported
from the auditor means fix the sentences it names and re-run the auditor alone. Not sufficient or
unsound means the story goes back to you for rewriting, and a rewritten story is a new artifact that
is reviewed again.

You may rebut a finding once, in writing, in the story itself. The rebuttal stays there. Then the
operator decides. Do not re-review the same text after a rebuttal.

Also verify, and report as warnings rather than as gates: every recalled `MUST-CHECK:` entry is
covered by a Locked decision, and the dependency order holds.

The full standard is the `ticket-quality` skill; the review doctrine is `adversarial-review`.

## 5. Create the sub-issues

**Gate:** show the user the ordered story list and get confirmation. Then create each as a Linear sub-issue (`save_issue` with `parentId` = the parent, status `Todo`) in dependency order. Log a `DECISION:` comment on the parent noting the plan is ready.

If the Linear MCP is unavailable, present the stories to the user and note they were not written to Linear. Stop here.

## 6. Report

Print the parent id and the ordered child ids/titles. Next: `/drawbar-work <issue-id>`.
