import { describe, expect, it } from "vitest";
import { exampleRunbookLibrary, parseRunbookLibrary } from "../runbookLibraryFile";

const lib = (runbooks: unknown[], kind = "v19.runbooks/v1") => JSON.stringify({ kind, runbooks });
const rb = (over: Record<string, unknown> = {}) => ({ id: "warm-cache", title: "Warm the cache", summary: "Prime caches after a deploy.", steps: ["List caches.", "Propose warm-up."], context: ["Service", "Environment:"], ...over });

describe("runbook library file", () => {
  it("parses the example and always appends the approval footer", () => {
    const parsed = parseRunbookLibrary(exampleRunbookLibrary());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.runbooks[0].instruction).toMatch(/^Drain a node before maintenance\.\n1\. /);
    expect(parsed.runbooks[0].instruction).toMatch(/Do not change anything until the action has been reviewed and approved in V19\.$/);
    expect(parsed.runbooks[0].context).toBe("Cluster:\nNode:\nMaintenance window:");
  });
  it("normalizes context labels and keeps the source", () => {
    const parsed = parseRunbookLibrary(lib([rb()]));
    expect(parsed).toMatchObject({ ok: true, runbooks: [{ id: "warm-cache", source: "library", context: "Service:\nEnvironment:" }] });
  });
  it("refuses wrong kind, bad JSON, duplicates, built-in ids, bad fields and oversized files", () => {
    for (const [raw, msg] of [
      [lib([rb()], "other"), /kind/], ["{", /valid JSON/], ["[]", /object/], [lib([]), /1 to 50/],
      [lib([rb(), rb()]), /already used/], [lib([rb({ id: "restart-service" })]), /already used/], [lib([rb({ id: "Bad Id" })]), /id/],
      [lib([rb({ title: "" })]), /title/], [lib([rb({ steps: [] })]), /1 to 12/], [lib([rb({ steps: [42] })]), /each step/],
      [lib([rb({ context: "Service" })]), /context/], ["x".repeat(70_000), /64 KB/],
    ] as const) {
      const parsed = parseRunbookLibrary(raw);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toMatch(msg);
    }
  });
  it("refuses credential-looking text anywhere in the file", () => {
    for (const leak of ["AKIAABCDEFGHIJKLMNOP", "ghp_abcdefghijklmnopqrstuvwxyz12", "password: hunter22", "-----BEGIN RSA PRIVATE KEY-----"]) {
      const parsed = parseRunbookLibrary(lib([rb({ summary: `See ${leak}` })]));
      expect(parsed).toMatchObject({ ok: false });
      if (!parsed.ok) expect(parsed.error).toMatch(/credential/);
    }
  });
});
