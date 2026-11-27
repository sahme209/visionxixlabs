import { describe, expect, it } from "vitest";
import { stateLabel, toneFor } from "../statusTone";
describe("cockpit status tone", () => {
  it("maps recorded states to one palette", () => {
    expect(toneFor("success")).toBe("success");
    expect(toneFor("RUNNING")).toBe("running");
    expect(toneFor("up_for_retry")).toBe("attention");
    expect(toneFor("upstream_failed")).toBe("failed");
    expect(toneFor("validation_overdue")).toBe("attention");
    expect(toneFor("not_connected")).toBe("idle");
    expect(toneFor(null)).toBe("idle");
  });
  it("labels states in plain words", () => {
    expect(stateLabel("up_for_retry")).toBe("Up for retry");
    expect(stateLabel(null)).toBe("Unknown");
  });
});
