import { describe, it, expect } from "vitest";
import { buildRefinementMessages } from "../buildRefinementMessages";
import { CODE_PROPOSE_SYSTEM_PROMPT } from "../buildCodeProposeMessages";
import type { ValidateProposalResult } from "../validateProposal";

const baseValidation: ValidateProposalResult = {
  parseOk: true,
  parseFailureReason: null,
  parseFailureDetail: null,
  files: [{ path: "foo.ts", changeKind: "modified", ok: false, reason: "context_mismatch", detail: "line 5 mismatch" }],
  applyOk: false,
};

describe("buildRefinementMessages — structure", () => {
  it("emits the same system prompt as code_propose (cache-stable)", () => {
    const r = buildRefinementMessages({
      instruction: "x", repoRef: "a/b", branchHint: null,
      brokenPatchText: "broken", validation: baseValidation,
    });
    expect(r.system[0].text).toBe(CODE_PROPOSE_SYSTEM_PROMPT);
    expect(r.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("conversation has user → assistant → user", () => {
    const r = buildRefinementMessages({
      instruction: "x", repoRef: "a/b", branchHint: null,
      brokenPatchText: "broken", validation: baseValidation,
    });
    expect(r.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("includes the broken patch verbatim in the assistant turn", () => {
    const r = buildRefinementMessages({
      instruction: "x", repoRef: "a/b", branchHint: null,
      brokenPatchText: "BROKEN_PATCH_TEXT",
      validation: baseValidation,
    });
    expect(r.messages[1].content).toBe("BROKEN_PATCH_TEXT");
  });

  it("includes the operator instruction in the first user turn", () => {
    const r = buildRefinementMessages({
      instruction: "Add /healthz", repoRef: "a/b", branchHint: null,
      brokenPatchText: "broken", validation: baseValidation,
    });
    expect(r.messages[0].content).toContain("Add /healthz");
  });
});

describe("buildRefinementMessages — parse-failure feedback", () => {
  it("formats parse_failure with reason + actionable hints", () => {
    const r = buildRefinementMessages({
      instruction: "x", repoRef: "a/b", branchHint: null,
      brokenPatchText: "garbage",
      validation: {
        parseOk: false,
        parseFailureReason: "no_diff_block",
        parseFailureDetail: "No '--- ' marker found.",
        files: [],
        applyOk: false,
      },
    });
    const lastUser = r.messages[2].content;
    expect(lastUser).toContain("Parse failure");
    expect(lastUser).toContain("no_diff_block");
    expect(lastUser).toContain("```diff");
    expect(lastUser).toContain("`--- a/path`");
  });
});

describe("buildRefinementMessages — apply-failure feedback", () => {
  it("lists each failed file with reason + detail", () => {
    const r = buildRefinementMessages({
      instruction: "x", repoRef: "a/b", branchHint: null,
      brokenPatchText: "broken",
      validation: {
        parseOk: true,
        parseFailureReason: null,
        parseFailureDetail: null,
        files: [
          { path: "foo.ts", changeKind: "modified", ok: false, reason: "context_mismatch", detail: "line 5 mismatch" },
          { path: "bar.ts", changeKind: "modified", ok: false, reason: "delete_mismatch", detail: "line 10 expected X got Y" },
        ],
        applyOk: false,
      },
    });
    const lastUser = r.messages[2].content;
    expect(lastUser).toContain("Apply failures");
    expect(lastUser).toContain("foo.ts");
    expect(lastUser).toContain("context_mismatch");
    expect(lastUser).toContain("bar.ts");
    expect(lastUser).toContain("delete_mismatch");
  });

  it("ok files are NOT mentioned (only failures)", () => {
    const r = buildRefinementMessages({
      instruction: "x", repoRef: "a/b", branchHint: null,
      brokenPatchText: "broken",
      validation: {
        parseOk: true,
        parseFailureReason: null,
        parseFailureDetail: null,
        files: [
          { path: "good.ts", changeKind: "modified", ok: true },
          { path: "bad.ts", changeKind: "modified", ok: false, reason: "context_mismatch", detail: "x" },
        ],
        applyOk: false,
      },
    });
    expect(r.messages[2].content).not.toContain("good.ts");
    expect(r.messages[2].content).toContain("bad.ts");
  });
});

describe("buildRefinementMessages — caching invariants", () => {
  it("identical input → byte-identical messages (refinement cache stability)", () => {
    const input = {
      instruction: "Add /healthz", repoRef: "a/b", branchHint: "main",
      brokenPatchText: "broken", validation: baseValidation,
    };
    const a = buildRefinementMessages(input);
    const b = buildRefinementMessages(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
