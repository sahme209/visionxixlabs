/**
 * Vitest unit tests for the pure dependency graph builder.
 */

import { describe, it, expect } from "vitest";
import { blastRadiusOf, buildDependencyGraph, type ResourceNode } from "../dependencyGraphBuilder";

const NODE = (id: string, service: string, account: string, upstreams: string[] = []): ResourceNode =>
  ({ id, service, account, upstreams });

describe("dependencyGraphBuilder", () => {
  it("empty input → empty graph", () => {
    const g = buildDependencyGraph([]);
    expect(g.topoOrder).toEqual([]);
    expect(g.cycles).toEqual([]);
  });

  it("computes reverse edges", () => {
    const g = buildDependencyGraph([
      NODE("a", "svc", "acct", []),
      NODE("b", "svc", "acct", ["a"]),
    ]);
    expect(g.reverse.a).toEqual(["b"]);
    expect(g.forward.b).toEqual(["a"]);
  });

  it("drops dangling upstream references", () => {
    const g = buildDependencyGraph([
      NODE("a", "svc", "acct", ["ghost"]),
    ]);
    expect(g.forward.a).toEqual([]);
    expect(g.topoOrder).toEqual(["a"]);
  });

  it("produces a topological order for a DAG", () => {
    const g = buildDependencyGraph([
      NODE("c", "svc", "acct", ["b"]),
      NODE("b", "svc", "acct", ["a"]),
      NODE("a", "svc", "acct", []),
    ]);
    expect(g.topoOrder).toEqual(["a", "b", "c"]);
    expect(g.cycles).toEqual([]);
  });

  it("detects cycles and reports them", () => {
    const g = buildDependencyGraph([
      NODE("a", "svc", "acct", ["b"]),
      NODE("b", "svc", "acct", ["a"]),
      NODE("c", "svc", "acct", []),
    ]);
    expect(g.cycles.length).toBe(1);
    expect(g.cycles[0].sort()).toEqual(["a", "b"]);
    expect(g.topoOrder).toContain("c");
  });

  it("blastRadiusOf returns single_resource for a leaf with no consumers", () => {
    const g = buildDependencyGraph([NODE("a", "svc", "acct", [])]);
    const r = blastRadiusOf(g, "a");
    expect(r.radius).toBe("single_resource");
    expect(r.impactedIds).toEqual([]);
  });

  it("blastRadiusOf returns 'service' when consumers share service", () => {
    const g = buildDependencyGraph([
      NODE("db", "checkout", "aws:1", []),
      NODE("api", "checkout", "aws:1", ["db"]),
    ]);
    const r = blastRadiusOf(g, "db");
    expect(r.radius).toBe("service");
    expect(r.impactedIds).toEqual(["api"]);
  });

  it("blastRadiusOf returns 'account' when consumers span services in one account", () => {
    const g = buildDependencyGraph([
      NODE("db", "checkout", "aws:1", []),
      NODE("api", "checkout", "aws:1", ["db"]),
      NODE("reporter", "billing", "aws:1", ["db"]),
    ]);
    const r = blastRadiusOf(g, "db");
    expect(r.radius).toBe("account");
  });

  it("blastRadiusOf returns 'org' when consumers span multiple accounts", () => {
    const g = buildDependencyGraph([
      NODE("db", "checkout", "aws:1", []),
      NODE("api", "checkout", "aws:1", ["db"]),
      NODE("reporter", "billing", "aws:2", ["db"]),
    ]);
    const r = blastRadiusOf(g, "db");
    expect(r.radius).toBe("org");
  });

  it("blastRadiusOf returns single_resource for unknown id", () => {
    const g = buildDependencyGraph([NODE("a", "svc", "acct", [])]);
    expect(blastRadiusOf(g, "ghost").radius).toBe("single_resource");
  });
});
