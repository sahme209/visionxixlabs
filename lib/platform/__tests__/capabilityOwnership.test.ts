import { describe, expect, it } from "vitest";

import { CAPABILITY_OWNERSHIP, ownershipFor } from "../capabilityOwnership";

describe("platform capability ownership", () => {
  it("keeps protected enforcement exclusively in the backend", () => {
    expect(CAPABILITY_OWNERSHIP).not.toHaveLength(0);
    expect(CAPABILITY_OWNERSHIP.every((entry) => entry.enforcement === "backend")).toBe(true);
  });

  it("keeps engineering operations in desktop while web owns policy", () => {
    expect(ownershipFor("repository_engineering")).toMatchObject({
      administration: "web",
      operation: "desktop",
      enforcement: "backend",
    });
    expect(ownershipFor("deployment_execution")).toMatchObject({
      administration: "web",
      operation: "desktop",
      enforcement: "backend",
    });
  });

  it("keeps durable autonomous execution out of either client", () => {
    expect(ownershipFor("autonomous_execution")).toMatchObject({
      administration: "web",
      operation: "backend",
      enforcement: "backend",
    });
  });
});
