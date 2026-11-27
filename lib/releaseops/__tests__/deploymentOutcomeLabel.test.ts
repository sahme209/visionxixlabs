import { describe, expect, it } from "vitest";
import { deploymentOutcomeLabel } from "../deploymentOutcomeLabel";
describe("deploymentOutcomeLabel", () => {
  it("names recorded outcomes plainly", () => {
    expect(deploymentOutcomeLabel("completed", "success")).toEqual({ label: "Succeeded", tone: "ok" });
    expect(deploymentOutcomeLabel("completed", "failure")).toEqual({ label: "Failed (failure)", tone: "bad" });
    expect(deploymentOutcomeLabel("completed", "cancelled")).toEqual({ label: "Cancelled", tone: "neutral" });
    expect(deploymentOutcomeLabel("completed", null)).toEqual({ label: "Finished, result not recorded", tone: "neutral" });
    expect(deploymentOutcomeLabel("in_progress", null).label).toBe("Running");
    expect(deploymentOutcomeLabel("queued", null).label).toBe("Queued");
  });
});
