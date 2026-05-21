import { describe, it, expect } from "vitest";
import { resolveSetupSteps, GROUP_LABEL } from "../connectorSetupSteps";

describe("resolveSetupSteps", () => {
  it("turns AZURE_TENANT_ID into a labelled identity step", () => {
    const steps = resolveSetupSteps(["AZURE_TENANT_ID"]);
    expect(steps.length).toBe(1);
    expect(steps[0].label).toMatch(/Azure directory/);
    expect(steps[0].group).toBe("identity");
    expect(steps[0].isSecret).toBe(false);
  });

  it("flags AZURE_CLIENT_SECRET as a secret credential", () => {
    const steps = resolveSetupSteps(["AZURE_CLIENT_SECRET"]);
    expect(steps[0].isSecret).toBe(true);
    expect(steps[0].group).toBe("credential");
  });

  it("expands ' *or* ' alternatives into separate steps", () => {
    const steps = resolveSetupSteps(["GCP_SERVICE_ACCOUNT_JSON  *or*  GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY"]);
    // Splits on " *or* " — the right side is one entry ("GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY"),
    // which is not in the catalog → falls back to UNKNOWN_STEP. The left
    // side resolves to the json key.
    expect(steps.length).toBe(2);
    expect(steps[0].envVar).toBe("GCP_SERVICE_ACCOUNT_JSON");
    expect(steps[0].isSecret).toBe(true);
  });

  it("unknown env var falls back to label = envVar", () => {
    const steps = resolveSetupSteps(["UNKNOWN_VAR_XYZ"]);
    expect(steps[0].label).toBe("UNKNOWN_VAR_XYZ");
    expect(steps[0].group).toBe("other");
  });

  it("GCP_PROJECT_ID is classified as scope", () => {
    const steps = resolveSetupSteps(["GCP_PROJECT_ID"]);
    expect(steps[0].group).toBe("scope");
  });

  it("preserves order across multiple requirements", () => {
    const steps = resolveSetupSteps([
      "AZURE_TENANT_ID",
      "AZURE_CLIENT_ID",
      "AZURE_CLIENT_SECRET",
      "AZURE_SUBSCRIPTION_ID",
    ]);
    expect(steps.map((s) => s.envVar)).toEqual([
      "AZURE_TENANT_ID",
      "AZURE_CLIENT_ID",
      "AZURE_CLIENT_SECRET",
      "AZURE_SUBSCRIPTION_ID",
    ]);
  });

  it("GROUP_LABEL has a label for every group emitted", () => {
    const steps = resolveSetupSteps([
      "AZURE_TENANT_ID",        // identity
      "AZURE_CLIENT_SECRET",    // credential
      "AZURE_SUBSCRIPTION_ID",  // scope
      "UNKNOWN_VAR",            // other
    ]);
    for (const s of steps) {
      expect(GROUP_LABEL[s.group]).toBeTruthy();
    }
  });
});
