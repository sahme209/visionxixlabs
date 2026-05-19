/**
 * Vitest unit tests for the Terraform HCL drafter.
 *
 * Verifies per-cloud resource shape, jsonencode embedding, slug
 * derivation, and that validation warnings surface for malformed
 * inputs (never silently produce broken HCL).
 */

import { describe, it, expect } from "vitest";
import { draftTerraform } from "../terraformDrafter";

const AWS_RECIPE = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    { Effect: "Deny", Action: "s3:DeleteBucket", Resource: "*" },
  ],
});

const AZURE_RECIPE = JSON.stringify({
  properties: {
    displayName: "Audit storage public access",
    policyType: "Custom",
    mode: "Indexed",
    policyRule: {
      if: { field: "type", equals: "Microsoft.Storage/storageAccounts" },
      then: { effect: "audit" },
    },
  },
});

const GCP_RECIPE = JSON.stringify({
  name: "policies/storage.publicAccessPrevention",
  spec: { rules: [{ enforce: true }] },
});

describe("terraform drafter", () => {
  it("emits aws_organizations_policy for AWS recipes", () => {
    const d = draftTerraform({ cloud: "aws", label: "Deny S3 deletes", policyJson: AWS_RECIPE });
    expect(d.resourceName).toMatch(/^aws_organizations_policy\./);
    expect(d.hcl).toContain("aws_organizations_policy");
    expect(d.hcl).toContain("jsonencode(");
    expect(d.warnings).toEqual([]);
  });

  it("emits azurerm_policy_definition for Azure recipes", () => {
    const d = draftTerraform({ cloud: "azure", label: "Audit storage", policyJson: AZURE_RECIPE });
    expect(d.resourceName).toMatch(/^azurerm_policy_definition\./);
    expect(d.hcl).toContain("azurerm_policy_definition");
    expect(d.hcl).toContain("policy_rule");
    expect(d.warnings).toEqual([]);
  });

  it("emits google_org_policy_policy for GCP recipes with the constraint path", () => {
    const d = draftTerraform({ cloud: "gcp", label: "Storage PAP", policyJson: GCP_RECIPE });
    expect(d.resourceName).toMatch(/^google_org_policy_policy\./);
    expect(d.hcl).toContain("google_org_policy_policy");
    expect(d.hcl).toContain("storage.publicAccessPrevention");
  });

  it("slugifies the label into a terraform-safe identifier", () => {
    const d = draftTerraform({
      cloud: "aws",
      label: "Deny PutBucketPublicAccessBlock! (severity: high)",
      policyJson: AWS_RECIPE,
    });
    // The slug component appears after "aws_organizations_policy."
    const slug = d.resourceName.split(".")[1];
    expect(slug).toMatch(/^[a-z0-9_]+$/);
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it("emits warnings for AWS policies missing Version or Statement", () => {
    const broken = JSON.stringify({ Statement: [{ Effect: "Deny" }] });
    const d = draftTerraform({ cloud: "aws", label: "Broken", policyJson: broken });
    expect(d.warnings.some((w) => /Version/.test(w))).toBe(true);
  });

  it("emits a parse-warning for unparseable JSON instead of crashing", () => {
    const d = draftTerraform({ cloud: "aws", label: "Bad json", policyJson: "{not json" });
    expect(d.warnings.some((w) => /parse/i.test(w))).toBe(true);
    // HCL is still generated (with the raw string embedded via JSON.stringify).
    expect(d.hcl).toContain("aws_organizations_policy");
  });
});
