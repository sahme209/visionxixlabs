import { describe, expect, it } from "vitest";
import { resolveVariables, resolvedDigest, validateVariable } from "../scopedVariables";
import { matchingSets, resolveWithSets, selectorMatches, validateSetDefinition } from "../variableSets";

const vars = [
  { key: "LOG_LEVEL", value: "info", scopeKey: "workspace" },
  { key: "REGION", value: "us-east-1", scopeKey: "workspace" },
  { key: "REGION", value: "eu-west-1", scopeKey: "set:eu" },
  { key: "CDN", value: "eu.cdn", scopeKey: "set:eu" },
  { key: "CDN", value: "acme.cdn", scopeKey: "set:acme" },
  { key: "LOG_LEVEL", value: "debug", scopeKey: "env:e1" },
];
const sets = [{ slug: "eu", name: "EU region", selector: "region:eu" }, { slug: "acme", name: "Acme tenant", selector: "tenant:acme" }, { slug: "unused", name: "Unused", selector: "region:apac" }];

describe("variable sets", () => {
  it("validates definitions and set-scoped variables", () => {
    expect(validateSetDefinition({ slug: "eu", name: "EU", selector: "region:eu" })).toEqual([]);
    expect(validateSetDefinition({ slug: "EU!", name: "", selector: "eu" })).toEqual(["slug_invalid", "name_invalid", "selector_invalid"]);
    expect(validateVariable({ key: "CDN", value: "x", scopeKey: "set:eu" })).toEqual([]);
    expect(validateVariable({ key: "CDN", value: "x", scopeKey: "set:../x" })).toContain("scope_invalid");
  });
  it("matches by tag selector, including wildcards, in slug order", () => {
    expect(selectorMatches(["tenant:acme", "region:eu"], "tenant:* region:eu")).toBe(true);
    expect(selectorMatches(["region:eu"], "tenant:*")).toBe(false);
    expect(selectorMatches(["region:eu"], "not a selector")).toBe(false);
    expect(matchingSets(["region:eu", "tenant:acme"], sets).map((s) => s.slug)).toEqual(["acme", "eu"]);
  });
  it("applies workspace < sets < environment and reports conflicts between sets", () => {
    const r = resolveWithSets(vars, { id: "e1", tags: ["region:eu", "tenant:acme"] }, sets);
    expect(r.appliedSets).toEqual(["acme", "eu"]);
    expect(r.resolved).toEqual([
      { key: "CDN", value: "eu.cdn", source: "set", set: "eu" },
      { key: "LOG_LEVEL", value: "debug", source: "environment" },
      { key: "REGION", value: "eu-west-1", source: "set", set: "eu" },
    ]);
    expect(r.conflicts).toEqual([{ key: "CDN", sets: ["acme", "eu"] }]);
  });
  it("matches the existing resolution and digest when no set applies", () => {
    const r = resolveWithSets(vars, { id: "e2", tags: [] }, sets);
    expect(r.resolved).toEqual(resolveVariables(vars, "e2"));
    expect(resolvedDigest(r.resolved)).toBe(resolvedDigest(resolveVariables(vars, "e2")));
    expect(r.conflicts).toEqual([]);
  });
});
