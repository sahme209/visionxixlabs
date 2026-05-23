import { describe, it, expect } from "vitest";
import {
  isValidScope,
  normalizeScopes,
  assertScope,
  type ApiKeyScope,
} from "../apiKeyScope";

describe("isValidScope", () => {
  it("accepts every known scope", () => {
    const all: ApiKeyScope[] = [
      "pipeline:read", "pipeline:trigger", "pipeline:*",
      "eval:read", "eval:write", "eval:*",
      "release_gate:read", "release_gate:*",
      "webhook:read", "webhook:write", "webhook:admin", "webhook:*",
      "*",
    ];
    for (const s of all) expect(isValidScope(s)).toBe(true);
  });

  it("rejects typos", () => {
    expect(isValidScope("pipelines:read")).toBe(false);
    expect(isValidScope("pipeline:READ")).toBe(false);
    expect(isValidScope("eval:")).toBe(false);
    expect(isValidScope("foo")).toBe(false);
    expect(isValidScope("")).toBe(false);
  });
});

describe("normalizeScopes", () => {
  it("drops unknowns + dedups", () => {
    const out = normalizeScopes([
      "pipeline:read", "BAD", "pipeline:read",  // dup
      "eval:read", 42, null, undefined, "*",
    ]);
    expect(out).toEqual(["pipeline:read", "eval:read", "*"]);
  });

  it("returns empty array for all-invalid input", () => {
    expect(normalizeScopes(["bad", "also bad"])).toEqual([]);
  });
});

describe("assertScope — exact match", () => {
  it("allows when scope is listed directly", () => {
    const r = assertScope("pipeline:read", ["pipeline:read", "eval:read"]);
    expect(r.allowed).toBe(true);
  });

  it("denies when scope absent", () => {
    const r = assertScope("pipeline:trigger", ["pipeline:read"]);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("missing_scope");
    expect(r.required).toBe("pipeline:trigger");
  });
});

describe("assertScope — resource wildcard", () => {
  it("allows when resource:* is granted", () => {
    expect(assertScope("pipeline:read", ["pipeline:*"]).allowed).toBe(true);
    expect(assertScope("pipeline:trigger", ["pipeline:*"]).allowed).toBe(true);
    expect(assertScope("eval:read", ["eval:*"]).allowed).toBe(true);
  });

  it("does NOT cross-allow across resources", () => {
    // eval:* should not grant pipeline:read
    const r = assertScope("pipeline:read", ["eval:*"]);
    expect(r.allowed).toBe(false);
  });
});

describe("assertScope — universal wildcard", () => {
  it("'*' allows every required scope", () => {
    expect(assertScope("pipeline:read", ["*"]).allowed).toBe(true);
    expect(assertScope("eval:write", ["*"]).allowed).toBe(true);
    expect(assertScope("release_gate:read", ["*"]).allowed).toBe(true);
    expect(assertScope("webhook:admin", ["*"]).allowed).toBe(true);
  });
});

describe("assertScope — empty grants", () => {
  it("denies everything when no scopes granted", () => {
    const r = assertScope("pipeline:read", []);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("missing_scope");
  });
});

describe("assertScope — multiple grants", () => {
  it("allows when any of multiple grants covers the required scope", () => {
    const r = assertScope("eval:write", ["pipeline:read", "eval:*", "webhook:read"]);
    expect(r.allowed).toBe(true);
  });
});
