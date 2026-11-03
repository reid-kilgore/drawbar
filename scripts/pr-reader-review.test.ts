import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// scripts/pr-reader-review.sh runs the reader review that the reader gate (a PreToolUse hook) needs
// before `gh pr create` or `gh pr edit`. These tests use a fake `reader-review` on PATH: no model run.
const SCRIPT = join(import.meta.dir, "pr-reader-review.sh");
const TITLE = "Managers can see break times on the schedule";
const BODY = "Opening.\n\n<details>\n<summary>Evidence</summary>\n\nReview provenance: reviewed at abc from cli; 2 commits since\n</details>\n";

function setup(opts: { title?: string; body?: string; rc?: number; noTool?: boolean }) {
  const cwd = mkdtempSync(join(tmpdir(), "drawbar-prr-"));
  const dir = join(cwd, ".drawbar", "tmp", "ship");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "title"), opts.title ?? TITLE);
  writeFileSync(join(dir, "body"), opts.body ?? BODY);
  const bin = join(cwd, "bin");
  mkdirSync(bin);
  if (!opts.noTool) {
    // The fake records the file it was given, so the test can check the exact text it reviewed.
    writeFileSync(join(bin, "reader-review"), `#!/bin/bash\ncp "$1" "${cwd}/seen"\necho "$2 $3" > "${cwd}/args"\nexit ${opts.rc ?? 0}\n`);
    chmodSync(join(bin, "reader-review"), 0o755);
  }
  return { cwd, dir, bin };
}

async function run(cwd: string, bin: string) {
  const proc = Bun.spawn(["bash", SCRIPT], {
    cwd,
    env: { PATH: `${bin}:/usr/bin:/bin` },
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text());
  return { code: await proc.exited, out };
}

describe("pr-reader-review.sh", () => {
  test("a pass reviews exactly title, a blank line, then body, and prints the title literal", async () => {
    const { cwd, bin } = setup({});
    const { code, out } = await run(cwd, bin);
    expect(code).toBe(0);
    expect(out).toContain("READER_PASS");
    expect(out).toContain(`PR_TITLE_LITERAL: ${TITLE}`);
    expect(readFileSync(join(cwd, "seen"), "utf8")).toBe(`${TITLE}\n\n${BODY}`);
    expect(readFileSync(join(cwd, "args"), "utf8").trim()).toBe("--kind pr");
  });

  test("a reviewer failure exits 1 with READER_FAIL", async () => {
    const { cwd, bin } = setup({ rc: 1 });
    const { code, out } = await run(cwd, bin);
    expect(code).toBe(1);
    expect(out).toContain("READER_FAIL");
    expect(out).not.toContain("PR_TITLE_LITERAL");
  });

  test("a title with a quote, a dollar sign or a second line is refused before any review", async () => {
    for (const title of ["Managers' break times", "Break $HOME times", "First line\nSecond line", "x".repeat(101)]) {
      const { cwd, bin } = setup({ title });
      const { code, out } = await run(cwd, bin);
      expect(code, title).toBe(1);
      expect(out).toContain("READER_FAIL");
      expect(() => readFileSync(join(cwd, "seen"))).toThrow();
    }
  });

  test("a body with no Review provenance line is refused before any review", async () => {
    const { cwd, bin } = setup({ body: "Opening only.\n" });
    const { code, out } = await run(cwd, bin);
    expect(code).toBe(1);
    expect(out).toContain("Review provenance");
    expect(() => readFileSync(join(cwd, "seen"))).toThrow();
  });

  test("a missing reader-review is a refusal, never a pass", async () => {
    const { cwd, bin } = setup({ noTool: true });
    const { code, out } = await run(cwd, bin);
    expect(code).toBe(1);
    expect(out).toContain("READER_FAIL");
  });

  test("a symlinked inputs directory is refused", async () => {
    const s = setup({});
    const real = join(s.cwd, "real");
    mkdirSync(real);
    writeFileSync(join(real, "title"), TITLE);
    writeFileSync(join(real, "body"), BODY);
    const o = mkdtempSync(join(tmpdir(), "drawbar-prr-sym-"));
    mkdirSync(join(o, ".drawbar", "tmp"), { recursive: true });
    symlinkSync(real, join(o, ".drawbar", "tmp", "ship"));
    const { code } = await run(o, s.bin);
    expect(code).toBe(1);
  });

  test("the review text file is truncated on exit so no stale text survives", async () => {
    const { cwd, dir, bin } = setup({});
    await run(cwd, bin);
    expect(readFileSync(join(dir, "pr-text"), "utf8")).toBe("");
  });
});
