---
name: drawbar-knowledge
description: How to read from and write to the drawbar knowledge base via the drawbar-kb CLI — the entry schema, the six types, the MUST-CHECK convention, recall, and safe writes. Use when a drawbar command needs to recall prior lessons or record new ones.
---

# drawbar knowledge base

The knowledge base is a per-**repository**, append-only JSONL store (`knowledge.jsonl`) indexed by SQLite FTS5, driven by the `drawbar-kb` CLI. The JSONL is the source of truth; the index rebuilds automatically.

## Where the store is

Never assume `$PWD/.drawbar/memory`. Ask:

```bash
KB=$(drawbar-kb path)          # one absolute path, nothing else
drawbar-kb context --json      # root, config path, store, team, project, and the source of each
```

The path resolves in this order — `--dir`, then `DRAWBAR_MEMORY_DIR`, then `memoryDir` in the repo-local `.drawbar/config.json`, then `<main worktree root>/.drawbar/memory`.

The default anchors to the **main worktree root** (the parent of the shared `.git` directory), not to the working directory, so every linked worktree of a repo shares one store. `$PWD/.drawbar/memory` inside `repo/worktrees/feature-x` is a different, empty directory: recall against it returns nothing and every entry written to it is invisible to every other session. Resolve once, then pass the absolute `$KB` to any agent you dispatch — a subagent's working directory is not guaranteed to be yours.

Whether the store is committed is the project's choice: leave `memoryDir` unset to keep it at the repo root where it can be tracked, or point it outside the repo to keep it local to the machine.

**A wrong store answers with less; it does not fail.** Every wrong path in this resolution order returns success and fewer entries, so the error arrives as a conclusion about somebody's work rather than as an error. Three ways to land on one: pass the knowledge REPOSITORY root where the store path is wanted, and the directory holds no `knowledge.jsonl` at all, so it reports zero active; let the default resolve in a project that has its own small store, and recall answers from that instead; or run a bare command in a worktree and get a different store again. Observed on 2026-09-16, three paths on one machine: 1572 entries, zero, and 39.

The cost is not a missed lookup. One session's ticket named three MUST-CHECK keys, all three read as absent under the wrong directory, and the obvious conclusion was that the ticket had been careless; all three existed under the right one. Another session rescued three entries out of a project-local store and could as easily have moved them from one place nothing reads to another.

So verify by **entry count**, not by a command exiting zero:

```bash
wc -l "$KB/knowledge.jsonl"                 # the real store is the big one
jq -r --arg k "<key>" 'select(.key==$k)|.key' "$KB/knowledge.jsonl" | wc -l
```

A store answering with tens of entries where the project has hundreds is the wrong store, whatever the command reported. Re-test a negative before it becomes a claim about someone's work: "recall found nothing" and "the knowledge base does not cover this" are the two sentences that need the count beside them.

This is one instance of a pattern worth recognising elsewhere: a system that answers confidently while telling you nothing. On 2026-09-16 a single stack produced four, and the review one arrived three separate ways — a green bot check because auto-review is disabled on a base other than the default branch, a green bot check because the bot was rate limited, and a green suite check because path filters skipped the suites on that same non-default base. Knowing only the first cause is worse than knowing none, because the rate-limited green then reads as a pass. Add the mergeable flag on a child whose parent has moved, and a store resolved to the wrong directory, and the shape is the same every time: success reported, nothing measured. When a signal is cheap and reassuring, ask what it would look like if the thing it measures had not run at all, and check that instead.

## Entry schema

```json
{"key":"<kebab-case-unique>","type":"<type>","content":"<the knowledge>","source":"agent","tags":["..."],"ts":<unix seconds, optional>,"issue":"<issue-id or null>","files":["<path>"]}
```

Required: `key`, `type`, `content`. `source` defaults to `agent`; `tags`/`files` default to `[]`; `issue` defaults to `null`; `ts` defaults to now.

## The six types

- `learned` — a lesson or gotcha. A mistake to guard against begins its content with `MUST-CHECK:`.
- `decision` — a choice and its rationale.
- `pattern` — a reusable approach.
- `fact` — a stable constraint about the system.
- `investigation` — what a dig uncovered.
- `deviation` — a departure from plan and why.

## Recall (read)

```bash
drawbar-kb recall "<query>" --dir "$KB" --json \
  [--type <type>] [--tag <tag>] [--file <path>] [--since <unix>] [--limit <n>] [--all]
```

Ranked by relevance (FTS5 BM25), deduped by key (latest wins). Archived entries are excluded by default; `--all` includes them. Recall before designing, planning, or implementing so you reuse prior lessons and honor `MUST-CHECK:` constraints.

## Write (safe, upserted)

Always pipe the entry as JSON on **stdin** — never interpolate content into the shell:

```bash
echo '<json entry>' | drawbar-kb add --dir "$KB"
```

`add` validates the entry and round-trips it through JSON before appending. It **upserts**: a key holds exactly one entry in the active store, so a correction always wins over what it corrects.

- Re-adding an unchanged entry (every field but `ts` matches) is a no-op — `{"written":false,"superseded":false,"key":"..."}`.
- Changing *any* field (content, issue, tags, files, type) is a correction: the key's line is replaced in place and the old copy moves to the archive — `{"written":true,"superseded":true,"key":"..."}`.

A `superseded:true` you did not expect means you just overwrote knowledge under an existing key — check that you meant to.

## Other commands

- `drawbar-kb stats [--json]` — counts by type, active vs archived, plus `duplicateKeys` (active keys with more than one line — should always be 0).
- `drawbar-kb reindex` — rebuild the FTS index from the JSONL.
- `drawbar-kb archive --days <n>` — age out entries older than N days.
- `drawbar-kb compact [--dry-run]` — collapse any duplicate-key lines in the active store to newest-per-key, archiving the losers, then reindex. `--dry-run` reports the same counts without touching disk.
- `drawbar-kb import <legacy.jsonl>` — one-time import of a legacy corpus (repairs corruption, reports every dropped line).
- `drawbar-kb path` — the resolved store path, one absolute line, without creating it.
- `drawbar-kb context [--json]` — the full resolution: root, config path, store, team, project, and where each value came from.

Every command above accepts `--dir <path>` to override the resolved store, and it always wins.
