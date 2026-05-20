/**
 * Vitest unit tests for the pure drift detector.
 */

import { describe, it, expect } from "vitest";
import { detectDrift } from "../driftDetector";

describe("driftDetector", () => {
  it("identical objects → ok, no rows", () => {
    const r = detectDrift({ a: 1, b: "x" }, { a: 1, b: "x" });
    expect(r.driftCount).toBe(0);
    expect(r.hasDrift).toBe(false);
    expect(r.severity).toBe("ok");
  });

  it("missing key → kind=missing", () => {
    const r = detectDrift({ a: 1, b: 2 }, { a: 1 });
    expect(r.rows.find((x) => x.path === "b")?.kind).toBe("missing");
  });

  it("extra key → kind=extra", () => {
    const r = detectDrift({ a: 1 }, { a: 1, b: 2 });
    expect(r.rows.find((x) => x.path === "b")?.kind).toBe("extra");
  });

  it("changed leaf → kind=value_changed at the deep path", () => {
    const r = detectDrift({ a: { b: 1 } }, { a: { b: 2 } });
    expect(r.rows.find((x) => x.path === "a.b")?.kind).toBe("value_changed");
  });

  it("array compared whole (not element-wise)", () => {
    const r = detectDrift({ list: [1, 2, 3] }, { list: [1, 2] });
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].kind).toBe("value_changed");
    expect(r.rows[0].path).toBe("list");
  });

  it("ignorePaths drops drift rows under those prefixes", () => {
    const r = detectDrift(
      { metadata: { lastModified: "a" }, name: "axiom" },
      { metadata: { lastModified: "b" }, name: "axiom" },
      { ignorePaths: ["metadata"] },
    );
    expect(r.driftCount).toBe(0);
  });

  it("highPriorityPaths bumps severity to high", () => {
    const r = detectDrift(
      { iam: { policy: "least-privilege" } },
      { iam: { policy: "admin-star" } },
      { highPriorityPaths: ["iam"] },
    );
    expect(r.severity).toBe("high");
  });

  it("severity ladder: 1 = low, 2-4 = medium, >=5 = high", () => {
    const oneDelta = detectDrift({ a: 1 }, { a: 2 });
    const twoDelta = detectDrift({ a: 1, b: 1 }, { a: 2, b: 2 });
    const fiveDelta = detectDrift(
      { a: 1, b: 1, c: 1, d: 1, e: 1 },
      { a: 2, b: 2, c: 2, d: 2, e: 2 },
    );
    expect(oneDelta.severity).toBe("low");
    expect(twoDelta.severity).toBe("medium");
    expect(fiveDelta.severity).toBe("high");
  });
});
