import { describe, expect, it } from "vitest";
import { createLineDiff } from "../../../../desktop/src/lib/lineDiff";

describe("createLineDiff", () => {
  it("reports line additions and removals with their respective line numbers", () => {
    const result = createLineDiff("first\nold\nlast", "first\nnew\nlast");
    expect(result).toContainEqual({ kind: "remove", text: "old", oldLine: 2, newLine: null });
    expect(result).toContainEqual({ kind: "add", text: "new", oldLine: null, newLine: 2 });
  });

  it("collapses unchanged regions around a small edit", () => {
    const before = Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n");
    const after = before.replace("line 10", "changed");
    expect(createLineDiff(before, after).some((line) => line.kind === "omitted")).toBe(true);
  });
});
