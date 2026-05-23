import { describe, it, expect } from "vitest";
import { validateTriggerRunInput } from "../validateTriggerRunInput";

const VALID = {
  pipelineId: "ai_coding",
  instruction: "Add a /healthz route",
  repoRef: "acme/example",
  branchHint: "main",
};

describe("validateTriggerRunInput — happy path", () => {
  it("accepts a fully-valid payload", () => {
    const r = validateTriggerRunInput(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pipelineId).toBe("ai_coding");
      expect(r.instruction).toBe("Add a /healthz route");
      expect(r.repoRef).toBe("acme/example");
      expect(r.branchHint).toBe("main");
      expect(r.metadata).toEqual({});
    }
  });

  it("treats omitted branchHint as null", () => {
    const r = validateTriggerRunInput({ ...VALID, branchHint: undefined });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.branchHint).toBeNull();
  });

  it("strips empty branchHint to null", () => {
    const { branchHint: _bh, ...rest } = VALID;
    const r = validateTriggerRunInput({ ...rest, branchHint: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.branchHint).toBeNull();
  });

  it("trims instruction whitespace", () => {
    const r = validateTriggerRunInput({ ...VALID, instruction: "  Add /healthz  " });
    if (r.ok) expect(r.instruction).toBe("Add /healthz");
  });

  it("accepts valid metadata", () => {
    const r = validateTriggerRunInput({
      ...VALID,
      metadata: { ci_job_id: "12345", commit_sha: "abc123" },
    });
    if (r.ok) expect(r.metadata).toEqual({ ci_job_id: "12345", commit_sha: "abc123" });
  });
});

describe("validateTriggerRunInput — pipelineId failures", () => {
  it("missing → missing_pipeline_id", () => {
    const r = validateTriggerRunInput({ ...VALID, pipelineId: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_pipeline_id");
  });

  it("invalid format → invalid_pipeline_id_format", () => {
    expect(validateTriggerRunInput({ ...VALID, pipelineId: "AI_CODING" }).ok).toBe(false);
    expect(validateTriggerRunInput({ ...VALID, pipelineId: "1coding" }).ok).toBe(false);
    expect(validateTriggerRunInput({ ...VALID, pipelineId: "ai-coding" }).ok).toBe(false);
    expect(validateTriggerRunInput({ ...VALID, pipelineId: "ab" }).ok).toBe(false);
  });
});

describe("validateTriggerRunInput — instruction failures", () => {
  it("missing → missing_instruction", () => {
    const r = validateTriggerRunInput({ ...VALID, instruction: "" });
    if (!r.ok) expect(r.error).toBe("missing_instruction");
  });

  it("whitespace-only → missing_instruction", () => {
    const r = validateTriggerRunInput({ ...VALID, instruction: "   \t\n" });
    if (!r.ok) expect(r.error).toBe("missing_instruction");
  });

  it("too long → instruction_too_long", () => {
    const r = validateTriggerRunInput({ ...VALID, instruction: "a".repeat(4_001) });
    if (!r.ok) expect(r.error).toBe("instruction_too_long");
  });
});

describe("validateTriggerRunInput — repoRef failures", () => {
  it("missing → missing_repo_ref", () => {
    const r = validateTriggerRunInput({ ...VALID, repoRef: "" });
    if (!r.ok) expect(r.error).toBe("missing_repo_ref");
  });

  it("unparseable → invalid_repo_ref", () => {
    const r = validateTriggerRunInput({ ...VALID, repoRef: "not a repo" });
    if (!r.ok) expect(r.error).toBe("invalid_repo_ref");
  });
});

describe("validateTriggerRunInput — branchHint failures", () => {
  it("too long → branch_hint_too_long", () => {
    const r = validateTriggerRunInput({ ...VALID, branchHint: "x".repeat(257) });
    if (!r.ok) expect(r.error).toBe("branch_hint_too_long");
  });

  it("non-string → branch_hint_too_long", () => {
    const r = validateTriggerRunInput({ ...VALID, branchHint: 42 });
    if (!r.ok) expect(r.error).toBe("branch_hint_too_long");
  });
});

describe("validateTriggerRunInput — metadata failures", () => {
  it("array → metadata_not_object", () => {
    const r = validateTriggerRunInput({ ...VALID, metadata: [1, 2, 3] });
    if (!r.ok) expect(r.error).toBe("metadata_not_object");
  });

  it("> 10 keys → metadata_too_many_keys", () => {
    const md: Record<string, string> = {};
    for (let i = 0; i < 11; i++) md[`k${i}`] = "v";
    const r = validateTriggerRunInput({ ...VALID, metadata: md });
    if (!r.ok) expect(r.error).toBe("metadata_too_many_keys");
  });

  it("value > 1000 chars → metadata_value_too_long", () => {
    const r = validateTriggerRunInput({
      ...VALID,
      metadata: { big: "x".repeat(1_001) },
    });
    if (!r.ok) expect(r.error).toBe("metadata_value_too_long");
  });

  it("coerces non-string metadata values to strings", () => {
    const r = validateTriggerRunInput({ ...VALID, metadata: { n: 42, b: true } });
    if (r.ok) {
      expect(r.metadata.n).toBe("42");
      expect(r.metadata.b).toBe("true");
    }
  });
});

describe("validateTriggerRunInput — body shape", () => {
  it("rejects null body", () => {
    const r = validateTriggerRunInput(null);
    expect(r.ok).toBe(false);
  });

  it("rejects non-object body", () => {
    expect(validateTriggerRunInput("string").ok).toBe(false);
    expect(validateTriggerRunInput(42).ok).toBe(false);
  });
});
