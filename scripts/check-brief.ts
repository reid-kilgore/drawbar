#!/usr/bin/env bun
// Refuses a sub-agent brief that still carries an unfilled template placeholder, or that has
// no `## Decision register` or `## Glossary` section with real content. A drawbar-story-lead
// writes each brief to a file and runs this on it BEFORE dispatching (see drawbar-story-lead.md,
// "Check every brief before you dispatch it"). Two leads in a row sent an implementer a brief
// with a placeholder where the decision register and glossary belong (MAESTRO note n1316); a
// prose rule saying "the brief carries the register" did not stop it, so this makes it a check
// that exits non-zero.
//
// Usage: check-brief <brief-file>
//   Exit 0 and print "ok" when the brief passes. Exit 1 and list each problem on stderr.
//
// A section that truly has nothing to carry says so in words: `## Decision register: none` or
// `## Glossary: none received`. An empty section or a placeholder is never accepted.

import { existsSync, readFileSync } from "node:fs";

const REQUIRED = ["Decision register", "Glossary"] as const;

// Placeholder shapes that may appear anywhere in a brief. Deliberately narrow, so an ordinary
// `<T>` generic or `${VAR}` in a code sample does not trip it.
const KEYWORDS = "decision|register|glossary|paste|insert|fill|todo|tbd|placeholder|here|to be added";
const ANYWHERE: [RegExp, string][] = [
  [/\{\{[^}]*\}\}/, "template braces {{...}}"],
  [new RegExp(`<[^<>\\n]*\\b(${KEYWORDS})\\b[^<>\\n]*>`, "i"), "angle-bracket placeholder"],
  [new RegExp(`\\[[^\\[\\]\\n]*\\b(${KEYWORDS})\\b[^\\[\\]\\n]*\\]`, "i"), "square-bracket placeholder"],
];
// Bare words that only count as a placeholder INSIDE the register or glossary section, where a
// brief has no reason to say them.
const IN_SECTION = /\b(TBD|TODO|PLACEHOLDER|FILL ?IN|lorem ipsum)\b/i;

export function checkBrief(text: string): string[] {
  const problems: string[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const [re, what] of ANYWHERE) {
      if (re.test(line)) problems.push(`line ${i + 1}: ${what}: ${line.trim()}`);
    }
  });
  for (const name of REQUIRED) {
    const start = lines.findIndex((l) => new RegExp(`^##\\s+${name}\\b`, "i").test(l));
    if (start < 0) {
      problems.push(`missing section "## ${name}"`);
      continue;
    }
    const body = [lines[start].replace(/^##\s+[^:]*:?/, "")];
    for (let j = start + 1; j < lines.length && !/^#{1,2}\s/.test(lines[j]); j++) body.push(lines[j]);
    const content = body.join("\n").trim();
    if (!content) problems.push(`section "## ${name}" is empty (write the entries, or "none")`);
    else if (IN_SECTION.test(content)) problems.push(`section "## ${name}" holds a placeholder word`);
  }
  return problems;
}

export function run(argv: string[]): number {
  const path = argv[0];
  if (!path || !existsSync(path)) {
    console.error("usage: check-brief <brief-file> (file not found)");
    return 2;
  }
  const problems = checkBrief(readFileSync(path, "utf8"));
  if (problems.length === 0) {
    console.log("ok");
    return 0;
  }
  console.error(`REFUSED: brief ${path} is not ready to dispatch:\n- ${problems.join("\n- ")}`);
  return 1;
}

if (import.meta.main) process.exit(run(process.argv.slice(2)));
