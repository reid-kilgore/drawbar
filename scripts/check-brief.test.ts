import { test, expect } from "bun:test";
import { checkBrief } from "./check-brief";

const good = `# Story
Build it. Use Map<string, number> and \${HOME}.
## Decision register
- DECISION: net sales is the denominator
## Glossary: none received
## Read set
- a.ts — full read
`;

test("a filled brief passes", () => {
  expect(checkBrief(good)).toEqual([]);
});

test("template braces and bracketed placeholders are refused", () => {
  expect(checkBrief(good + "{{DECISION_REGISTER}}\n").length).toBe(1);
  expect(checkBrief(good + "<paste glossary here>\n").length).toBe(1);
  expect(checkBrief(good + "[insert decision register]\n").length).toBe(1);
});

test("a missing or empty register or glossary is refused", () => {
  expect(checkBrief("# Story\n## Glossary\nterm: x\n")).toEqual(['missing section "## Decision register"']);
  const empty = good.replace("- DECISION: net sales is the denominator\n", "");
  expect(checkBrief(empty)[0]).toContain("is empty");
});

test("a bare TBD inside a section is refused but not elsewhere", () => {
  expect(checkBrief(good.replace("net sales", "TBD")).length).toBe(1);
  expect(checkBrief(good + "Remove the TODO comments.\n")).toEqual([]);
});
