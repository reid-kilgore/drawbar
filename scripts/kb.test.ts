import { test, expect, describe, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./kb";
import { readEntries, readArchiveEntries, ensureDir } from "./lib/store";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kb-cli-"));
});

// Run the CLI with stdin text by invoking the binary through Bun so stdin is real.
async function cli(args: string[], stdin = ""): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(["bun", "run", join(import.meta.dir, "kb.ts"), ...args], {
    stdin: stdin ? new TextEncoder().encode(stdin) : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { code, out, err };
}

describe("run (in-process)", () => {
  test("reindex on an empty dir exits 0", async () => {
    expect(await run(["reindex", "--dir", dir])).toBe(0);
  });

  test("stats --json reports zero entries on an empty dir", async () => {
    // stats prints to stdout; here we just assert the exit code path.
    expect(await run(["stats", "--dir", dir, "--json"])).toBe(0);
  });

  test("recall rejects a non-numeric --limit", async () => {
    expect(await run(["recall", "x", "--dir", dir, "--limit", "abc"])).toBe(1);
  });

  test("recall rejects a negative --since", async () => {
    expect(await run(["recall", "x", "--dir", dir, "--since", "-5"])).toBe(1);
  });

  test("recall rejects non-integer --since and --limit (PCO-339)", async () => {
    expect(await run(["recall", "x", "--dir", dir, "--since", "1.5"])).toBe(1);
    expect(await run(["recall", "x", "--dir", dir, "--limit", "2.7"])).toBe(1);
  });

  test("recall still accepts --since 0 and --limit 0 (PCO-339)", async () => {
    expect(await run(["recall", "x", "--dir", dir, "--since", "0"])).toBe(0);
    expect(await run(["recall", "x", "--dir", dir, "--limit", "0"])).toBe(0);
  });

  test("archive --days 0 archives everything older than now (PCO-339)", async () => {
    const p = ensureDir(dir);
    const past = Math.floor(Date.now() / 1000) - 3600;
    writeFileSync(
      p.active,
      [
        JSON.stringify({ key: "a", type: "fact", content: "a1", source: "user", tags: [], ts: past, issue: null, files: [] }),
        JSON.stringify({ key: "b", type: "fact", content: "b1", source: "user", tags: [], ts: past, issue: null, files: [] }),
      ].join("\n") + "\n",
    );
    expect(readEntries(dir).length).toBe(2);
    expect(await run(["archive", "--dir", dir, "--days", "0"])).toBe(0);
    expect(readEntries(dir).length).toBe(0);
    expect(readArchiveEntries(dir).length).toBe(2);
  });

  test("archive --days 30 archives only entries older than 30 days (PCO-339)", async () => {
    const p = ensureDir(dir);
    const old = Math.floor(Date.now() / 1000) - 40 * 86400;
    const recent = Math.floor(Date.now() / 1000) - 10 * 86400;
    writeFileSync(
      p.active,
      [
        JSON.stringify({ key: "old", type: "fact", content: "old1", source: "user", tags: [], ts: old, issue: null, files: [] }),
        JSON.stringify({ key: "recent", type: "fact", content: "recent1", source: "user", tags: [], ts: recent, issue: null, files: [] }),
      ].join("\n") + "\n",
    );
    expect(await run(["archive", "--dir", dir, "--days", "30"])).toBe(0);
    expect(readEntries(dir).map((e) => e.key)).toEqual(["recent"]);
  });

  test("archive with --days 90 explicitly passed still archives only entries older than 90 days (PCO-339)", async () => {
    const p = ensureDir(dir);
    const old = Math.floor(Date.now() / 1000) - 100 * 86400;
    const recent = Math.floor(Date.now() / 1000) - 10 * 86400;
    writeFileSync(
      p.active,
      [
        JSON.stringify({ key: "old", type: "fact", content: "old1", source: "user", tags: [], ts: old, issue: null, files: [] }),
        JSON.stringify({ key: "recent", type: "fact", content: "recent1", source: "user", tags: [], ts: recent, issue: null, files: [] }),
      ].join("\n") + "\n",
    );
    expect(await run(["archive", "--dir", dir, "--days", "90"])).toBe(0);
    expect(readEntries(dir).map((e) => e.key)).toEqual(["recent"]);
  });

  // PCO-defect-3 (2026-09-15): archive with neither --key nor --days used to default to a
  // 90-day bulk archive silently. A session that meant to archive one entry got 10 archived
  // and had to restore them by hand. Refusing forces the caller to say which entries they mean.
  test("archive with neither --key nor --days is refused, archives nothing (drawbar defect 3)", async () => {
    const p = ensureDir(dir);
    const old = Math.floor(Date.now() / 1000) - 100 * 86400;
    writeFileSync(
      p.active,
      [JSON.stringify({ key: "old", type: "fact", content: "old1", source: "user", tags: [], ts: old, issue: null, files: [] })].join("\n") + "\n",
    );
    const code = await run(["archive", "--dir", dir]);
    expect(code).toBe(1);
    expect(readEntries(dir).length).toBe(1);
    expect(readArchiveEntries(dir).length).toBe(0);
  });

  test("archive --days with no value is rejected, not silently defaulted to 90 (PCO-339 F1)", async () => {
    const p = ensureDir(dir);
    const old = Math.floor(Date.now() / 1000) - 100 * 86400;
    writeFileSync(
      p.active,
      [JSON.stringify({ key: "old", type: "fact", content: "old1", source: "user", tags: [], ts: old, issue: null, files: [] })].join("\n") + "\n",
    );
    const code = await run(["archive", "--dir", dir, "--days"]);
    expect(code).toBe(1);
    expect(readEntries(dir).length).toBe(1);
  });

  test("archive --days swallowed by the next flag is rejected, not silently defaulted (PCO-339 F1)", async () => {
    const p = ensureDir(dir);
    const old = Math.floor(Date.now() / 1000) - 100 * 86400;
    writeFileSync(
      p.active,
      [JSON.stringify({ key: "old", type: "fact", content: "old1", source: "user", tags: [], ts: old, issue: null, files: [] })].join("\n") + "\n",
    );
    const code = await run(["archive", "--days", "--dir", dir]);
    expect(code).toBe(1);
    expect(readEntries(dir).length).toBe(1);
  });

  test("recall --since with no value is rejected, not silently ignored (PCO-339 F1)", async () => {
    expect(await run(["recall", "x", "--dir", dir, "--since"])).toBe(1);
  });

  test("recall --limit with no value is rejected, not silently ignored (PCO-339 F1)", async () => {
    expect(await run(["recall", "x", "--dir", dir, "--limit"])).toBe(1);
  });

  test("archive --days rejects malformed values and archives nothing (PCO-339)", async () => {
    const invalid = ["-1", "", " ", "abc", "1.5", "0x10", "1e3", "3."];
    for (const raw of invalid) {
      const p = ensureDir(dir);
      const past = Math.floor(Date.now() / 1000) - 3600;
      writeFileSync(
        p.active,
        [
          JSON.stringify({ key: "a", type: "fact", content: "a1", source: "user", tags: [], ts: past, issue: null, files: [] }),
          JSON.stringify({ key: "b", type: "fact", content: "b1", source: "user", tags: [], ts: past, issue: null, files: [] }),
          JSON.stringify({ key: "c", type: "fact", content: "c1", source: "user", tags: [], ts: past, issue: null, files: [] }),
        ].join("\n") + "\n",
      );
      const code = await run(["archive", "--dir", dir, "--days", raw]);
      expect(code).toBe(1);
      expect(readEntries(dir).length).toBe(3);
      expect(readArchiveEntries(dir).length).toBe(0);
    }
  });
});

describe("cli (subprocess, real stdin)", () => {
  test("add reads a JSON entry from stdin and persists it", async () => {
    const entry = JSON.stringify({
      key: "cli-1", type: "fact", content: "added via stdin", ts: 1, source: "user",
    });
    const { code } = await cli(["add", "--dir", dir], entry);
    expect(code).toBe(0);
    expect(readEntries(dir).map((e) => e.key)).toEqual(["cli-1"]);
  });

  test("recall --json finds a previously added entry", async () => {
    const entry = JSON.stringify({ key: "cli-2", type: "pattern", content: "needle haystack", ts: 2 });
    await cli(["add", "--dir", dir], entry);
    const { code, out } = await cli(["recall", "needle", "--dir", dir, "--json"]);
    expect(code).toBe(0);
    expect(out).toContain("cli-2");
  });

  test("add rejects malformed stdin with a non-zero exit", async () => {
    const { code } = await cli(["add", "--dir", dir], "{ not valid json");
    expect(code).not.toBe(0);
  });

  test("add accepts an entry without ts (defaults it)", async () => {
    const entry = JSON.stringify({ key: "no-ts", type: "learned", content: "works without ts" });
    const { code } = await cli(["add", "--dir", dir], entry);
    expect(code).toBe(0);
    const rows = readEntries(dir);
    expect(rows.map((e) => e.key)).toContain("no-ts");
    expect(rows.find((e) => e.key === "no-ts")!.ts).toBeGreaterThan(0);
  });

  test("add reports superseded:true on a changed-content re-add", async () => {
    const v1 = JSON.stringify({ key: "dup", type: "fact", content: "v1", ts: 1 });
    const v2 = JSON.stringify({ key: "dup", type: "fact", content: "v2", ts: 2 });
    const first = await cli(["add", "--dir", dir], v1);
    expect(JSON.parse(first.out)).toEqual({ written: true, superseded: false, key: "dup" });
    const second = await cli(["add", "--dir", dir], v2);
    expect(JSON.parse(second.out)).toEqual({ written: true, superseded: true, key: "dup" });
  });

  test("stats reports duplicateKeys", async () => {
    const p = ensureDir(dir);
    writeFileSync(
      p.active,
      [
        JSON.stringify({ key: "a", type: "fact", content: "a1", source: "user", tags: [], ts: 1, issue: null, files: [] }),
        JSON.stringify({ key: "a", type: "fact", content: "a2", source: "user", tags: [], ts: 2, issue: null, files: [] }),
        JSON.stringify({ key: "b", type: "fact", content: "b1", source: "user", tags: [], ts: 3, issue: null, files: [] }),
      ].join("\n") + "\n",
    );
    const { code, out } = await cli(["stats", "--dir", dir]);
    expect(code).toBe(0);
    expect(JSON.parse(out).duplicateKeys).toBe(1);
  });

  test("compact collapses duplicates and moves losers to the archive", async () => {
    const p = ensureDir(dir);
    writeFileSync(
      p.active,
      [
        JSON.stringify({ key: "a", type: "fact", content: "a1", source: "user", tags: [], ts: 1, issue: null, files: [] }),
        JSON.stringify({ key: "a", type: "fact", content: "a2", source: "user", tags: [], ts: 2, issue: null, files: [] }),
        JSON.stringify({ key: "b", type: "fact", content: "b1", source: "user", tags: [], ts: 3, issue: null, files: [] }),
      ].join("\n") + "\n",
    );
    const { code, out } = await cli(["compact", "--dir", dir]);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({ scanned: 3, keys: 2, removed: 1 });
    expect(readEntries(dir).map((e) => e.key)).toEqual(["a", "b"]);
    expect(readEntries(dir).find((e) => e.key === "a")!.content).toBe("a2");
    expect(readArchiveEntries(dir).map((e) => e.content)).toEqual(["a1"]);
  });

  test("compact is a no-op on a clean store", async () => {
    await cli(["add", "--dir", dir], JSON.stringify({ key: "a", type: "fact", content: "a1", ts: 1 }));
    const { code, out } = await cli(["compact", "--dir", dir]);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({ scanned: 1, keys: 1, removed: 0 });
  });

  test("compact --dry-run changes nothing on disk", async () => {
    const p = ensureDir(dir);
    writeFileSync(
      p.active,
      [
        JSON.stringify({ key: "a", type: "fact", content: "a1", source: "user", tags: [], ts: 1, issue: null, files: [] }),
        JSON.stringify({ key: "a", type: "fact", content: "a2", source: "user", tags: [], ts: 2, issue: null, files: [] }),
      ].join("\n") + "\n",
    );
    const { code, out } = await cli(["compact", "--dir", dir, "--dry-run"]);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({ scanned: 2, keys: 1, removed: 1 });
    expect(readEntries(dir).map((e) => e.content)).toEqual(["a1", "a2"]);
    expect(readArchiveEntries(dir).length).toBe(0);
  });

  test("usage string mentions compact for an unknown command", async () => {
    const { code, err } = await cli(["bogus", "--dir", dir]);
    expect(code).toBe(1);
    expect(err).toContain("compact");
  });

  test("archive --days -1 names the flag on stderr (PCO-339)", async () => {
    const { code, err } = await cli(["archive", "--dir", dir, "--days", "-1"]);
    expect(code).toBe(1);
    expect(err).toContain("--days");
  });

  test("archive --days 1e3 names the flag on stderr (PCO-339 F4)", async () => {
    const { code, err } = await cli(["archive", "--dir", dir, "--days", "1e3"]);
    expect(code).toBe(1);
    expect(err).toContain("--days");
  });

  test("archive --days error message names integers, not just non-negative numbers (PCO-339 F3)", async () => {
    const { err } = await cli(["archive", "--dir", dir, "--days", "1.5"]);
    expect(err).toContain("non-negative integer");
    expect(err).not.toContain("non-negative number");
  });

  test("recall --since error message names integers, not just non-negative numbers (PCO-339 F3)", async () => {
    const { err } = await cli(["recall", "x", "--dir", dir, "--since", "1.5"]);
    expect(err).toContain("non-negative integer");
    expect(err).not.toContain("non-negative number");
  });

  test("recall --limit error message names integers, not just non-negative numbers (PCO-339 F3)", async () => {
    const { err } = await cli(["recall", "x", "--dir", dir, "--limit", "2.7"]);
    expect(err).toContain("non-negative integer");
    expect(err).not.toContain("non-negative number");
  });

  // drawbar defect 3 (2026-09-15): `archive --key <key>` used to be silently ignored and fall
  // through to the days-based bulk archive, so a session meaning to archive one entry archived
  // ten. `--key` must archive exactly the named entry and nothing else.
  test("archive --key archives exactly that entry, leaving the rest active (drawbar defect 3)", async () => {
    const p = ensureDir(dir);
    const now = Math.floor(Date.now() / 1000);
    writeFileSync(
      p.active,
      [
        JSON.stringify({ key: "a", type: "fact", content: "a1", source: "user", tags: [], ts: now, issue: null, files: [] }),
        JSON.stringify({ key: "b", type: "fact", content: "b1", source: "user", tags: [], ts: now, issue: null, files: [] }),
        JSON.stringify({ key: "c", type: "fact", content: "c1", source: "user", tags: [], ts: now, issue: null, files: [] }),
      ].join("\n") + "\n",
    );
    const { code, out } = await cli(["archive", "--dir", dir, "--key", "b"]);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({ archived: 1, keys: ["b"], missing: [] });
    expect(readEntries(dir).map((e) => e.key).sort()).toEqual(["a", "c"]);
    expect(readArchiveEntries(dir).map((e) => e.key)).toEqual(["b"]);
  });

  test("archive --key for a key that does not exist fails with a clear error and archives nothing (drawbar defect 3)", async () => {
    const p = ensureDir(dir);
    writeFileSync(
      p.active,
      [JSON.stringify({ key: "a", type: "fact", content: "a1", source: "user", tags: [], ts: 1, issue: null, files: [] })].join("\n") + "\n",
    );
    const { code, err } = await cli(["archive", "--dir", dir, "--key", "nope"]);
    expect(code).toBe(1);
    expect(err).toContain("nope");
    expect(readEntries(dir).map((e) => e.key)).toEqual(["a"]);
    expect(readArchiveEntries(dir).length).toBe(0);
  });

  test("archive --key with no value is rejected, not silently ignored (drawbar defect 3)", async () => {
    const { code, err } = await cli(["archive", "--dir", dir, "--key"]);
    expect(code).toBe(1);
    expect(err).toContain("--key");
  });

  test("archive --key and --days together are rejected as ambiguous (drawbar defect 3)", async () => {
    const { code, err } = await cli(["archive", "--dir", dir, "--key", "a", "--days", "30"]);
    expect(code).toBe(1);
    expect(err).toContain("--key");
    expect(err).toContain("--days");
  });

  // drawbar defect 4 (2026-09-15): `drawbar-kb archive --help` ran a real archive instead of
  // printing usage. --help (and -h) must print usage and exit 0 without touching the store,
  // for archive and for every other subcommand.
  test("archive --help prints usage and exits 0 without archiving anything (drawbar defect 4)", async () => {
    const p = ensureDir(dir);
    const old = Math.floor(Date.now() / 1000) - 100 * 86400;
    writeFileSync(
      p.active,
      [JSON.stringify({ key: "old", type: "fact", content: "old1", source: "user", tags: [], ts: old, issue: null, files: [] })].join("\n") + "\n",
    );
    const { code, out } = await cli(["archive", "--dir", dir, "--help"]);
    expect(code).toBe(0);
    expect(out.toLowerCase()).toContain("usage");
    expect(readEntries(dir).length).toBe(1);
    expect(readArchiveEntries(dir).length).toBe(0);
  });

  test("archive -h prints usage and exits 0 without archiving anything (drawbar defect 4)", async () => {
    const p = ensureDir(dir);
    const old = Math.floor(Date.now() / 1000) - 100 * 86400;
    writeFileSync(
      p.active,
      [JSON.stringify({ key: "old", type: "fact", content: "old1", source: "user", tags: [], ts: old, issue: null, files: [] })].join("\n") + "\n",
    );
    const { code, out } = await cli(["archive", "--dir", dir, "-h"]);
    expect(code).toBe(0);
    expect(out.toLowerCase()).toContain("usage");
    expect(readEntries(dir).length).toBe(1);
  });

  test("add --help prints usage and exits 0 without reading stdin or writing an entry (drawbar defect 4)", async () => {
    const { code, out } = await cli(["add", "--dir", dir, "--help"]);
    expect(code).toBe(0);
    expect(out.toLowerCase()).toContain("usage");
    expect(readEntries(dir).length).toBe(0);
  });

  test("compact --help prints usage and exits 0 without compacting (drawbar defect 4)", async () => {
    const p = ensureDir(dir);
    writeFileSync(
      p.active,
      [
        JSON.stringify({ key: "a", type: "fact", content: "a1", source: "user", tags: [], ts: 1, issue: null, files: [] }),
        JSON.stringify({ key: "a", type: "fact", content: "a2", source: "user", tags: [], ts: 2, issue: null, files: [] }),
      ].join("\n") + "\n",
    );
    const { code, out } = await cli(["compact", "--dir", dir, "--help"]);
    expect(code).toBe(0);
    expect(out.toLowerCase()).toContain("usage");
    expect(readEntries(dir).map((e) => e.content)).toEqual(["a1", "a2"]);
  });
});
