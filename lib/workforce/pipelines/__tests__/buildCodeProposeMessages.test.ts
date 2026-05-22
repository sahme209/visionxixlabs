import { describe, it, expect } from "vitest";
import {
  buildCodeProposeMessages,
  CODE_PROPOSE_SYSTEM_PROMPT,
} from "../buildCodeProposeMessages";

describe("buildCodeProposeMessages", () => {
  it("emits exactly one system block with ephemeral cache_control", () => {
    const r = buildCodeProposeMessages({
      instruction: "Add a /healthz endpoint.",
      repoRef: "sahme209/visionxixlabs",
      branchHint: "main",
    });
    expect(r.system).toHaveLength(1);
    expect(r.system[0].type).toBe("text");
    expect(r.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("system prompt is frozen — equals CODE_PROPOSE_SYSTEM_PROMPT verbatim", () => {
    const r = buildCodeProposeMessages({
      instruction: "Foo bar baz.",
      repoRef: "x/y",
      branchHint: null,
    });
    expect(r.system[0].text).toBe(CODE_PROPOSE_SYSTEM_PROMPT);
  });

  it("system prompt contains no timestamps or UUIDs (silent-invalidator audit)", () => {
    expect(CODE_PROPOSE_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(CODE_PROPOSE_SYSTEM_PROMPT).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    expect(CODE_PROPOSE_SYSTEM_PROMPT).not.toMatch(/Date\.now|new Date/);
  });

  it("system prompt is identical across two builds with different inputs (cache-stable)", () => {
    const a = buildCodeProposeMessages({ instruction: "X", repoRef: "a/b", branchHint: null });
    const b = buildCodeProposeMessages({ instruction: "Y", repoRef: "c/d", branchHint: "feature" });
    expect(a.system[0].text).toBe(b.system[0].text);
  });

  it("user message includes repoRef, branch, and instruction", () => {
    const r = buildCodeProposeMessages({
      instruction: "Add /healthz",
      repoRef: "sahme209/visionxixlabs",
      branchHint: "main",
    });
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].role).toBe("user");
    expect(r.messages[0].content).toContain("sahme209/visionxixlabs");
    expect(r.messages[0].content).toContain("main");
    expect(r.messages[0].content).toContain("Add /healthz");
  });

  it("user message omits branch line when branchHint is null", () => {
    const r = buildCodeProposeMessages({
      instruction: "X",
      repoRef: "a/b",
      branchHint: null,
    });
    expect(r.messages[0].content).not.toContain("Branch:");
  });

  it("repo context section only appears when supplied", () => {
    const without = buildCodeProposeMessages({
      instruction: "X",
      repoRef: "a/b",
      branchHint: null,
    });
    expect(without.messages[0].content).not.toContain("Repo context:");

    const withCtx = buildCodeProposeMessages({
      instruction: "X",
      repoRef: "a/b",
      branchHint: null,
      repoContext: "files: foo.ts, bar.ts",
    });
    expect(withCtx.messages[0].content).toContain("Repo context:");
    expect(withCtx.messages[0].content).toContain("files: foo.ts, bar.ts");
  });

  it("instruction always appears after the Operator instruction header (caller can reliably parse)", () => {
    const r = buildCodeProposeMessages({
      instruction: "Add a healthz endpoint.",
      repoRef: "a/b",
      branchHint: null,
    });
    const content = r.messages[0].content;
    const headerIdx = content.indexOf("Operator instruction:");
    const instrIdx = content.indexOf("Add a healthz endpoint.");
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(instrIdx).toBeGreaterThan(headerIdx);
  });

  it("output contract section is in the system prompt (not user content)", () => {
    const r = buildCodeProposeMessages({ instruction: "X", repoRef: "a/b", branchHint: null });
    expect(r.system[0].text).toContain("Output contract:");
    expect(r.messages[0].content).not.toContain("Output contract:");
  });
});
