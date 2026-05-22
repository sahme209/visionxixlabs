import { describe, it, expect } from "vitest";
import { parseCodingTaskBody } from "../parseCodingTaskBody";

const valid = () => ({
  instruction: "Add a /healthz endpoint returning 200 with build sha.",
  repoRef: "sahme209/visionxixlabs",
  branchHint: "main",
});

describe("parseCodingTaskBody", () => {
  it("accepts a well-formed body", () => {
    const r = parseCodingTaskBody(valid());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.instruction).toContain("/healthz");
      expect(r.input.repoRef).toBe("sahme209/visionxixlabs");
      expect(r.input.branchHint).toBe("main");
    }
  });

  it("accepts missing/null branchHint", () => {
    const a = parseCodingTaskBody({ ...valid(), branchHint: null });
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.input.branchHint).toBe(null);

    const b = parseCodingTaskBody({ instruction: valid().instruction, repoRef: valid().repoRef });
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.input.branchHint).toBe(null);

    const c = parseCodingTaskBody({ ...valid(), branchHint: "" });
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.input.branchHint).toBe(null);
  });

  it("rejects non-object bodies", () => {
    expect(parseCodingTaskBody(null).ok).toBe(false);
    expect(parseCodingTaskBody("string").ok).toBe(false);
    expect(parseCodingTaskBody(42).ok).toBe(false);
  });

  it("rejects too-short instructions", () => {
    const r = parseCodingTaskBody({ ...valid(), instruction: "fix" });
    expect(r.ok).toBe(false);
  });

  it("rejects too-long instructions (>4000)", () => {
    const r = parseCodingTaskBody({ ...valid(), instruction: "x".repeat(4001) });
    expect(r.ok).toBe(false);
  });

  it("rejects empty repoRef", () => {
    const r = parseCodingTaskBody({ ...valid(), repoRef: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects repoRef with spaces", () => {
    const r = parseCodingTaskBody({ ...valid(), repoRef: "bad ref" });
    expect(r.ok).toBe(false);
  });

  it("rejects repoRef with shell metachars", () => {
    const r = parseCodingTaskBody({ ...valid(), repoRef: "owner/repo;rm -rf /" });
    expect(r.ok).toBe(false);
  });

  it("rejects branchHint with shell metachars", () => {
    const r = parseCodingTaskBody({ ...valid(), branchHint: "feature/x;ls" });
    expect(r.ok).toBe(false);
  });

  it("trims surrounding whitespace from accepted fields", () => {
    const r = parseCodingTaskBody({ ...valid(), instruction: "  Add a /healthz endpoint  ", repoRef: "  sahme209/visionxixlabs  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.instruction).toBe("Add a /healthz endpoint");
      expect(r.input.repoRef).toBe("sahme209/visionxixlabs");
    }
  });
});
