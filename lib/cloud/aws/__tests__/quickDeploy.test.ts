import { describe, expect, it } from "vitest";
import { buildAwsQuickDeployUrl, isValidExternalId } from "../quickDeploy";

describe("isValidExternalId", () => {
  it("accepts the format the onboarding page generates", () => {
    expect(isValidExternalId("axiom-P4367g6BL0jq80jdc")).toBe(true);
    expect(isValidExternalId("axiom-12345678")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidExternalId("")).toBe(false);
    expect(isValidExternalId("not-axiom-prefixed")).toBe(false);
    expect(isValidExternalId("axiom-short")).toBe(false); // 5 chars after prefix
    expect(isValidExternalId("axiom-" + "a".repeat(33))).toBe(false); // too long
    expect(isValidExternalId("axiom-with spaces and stuff")).toBe(false);
  });
});

describe("buildAwsQuickDeployUrl", () => {
  it("returns a CloudFormation quick-create URL with every required param", () => {
    const url = buildAwsQuickDeployUrl({
      externalId: "axiom-P4367g6BL0jq80jdc",
      origin: "https://visionxixlabs.com",
    });
    // Region defaults to us-east-1.
    expect(url.startsWith("https://us-east-1.console.aws.amazon.com/cloudformation/home")).toBe(true);
    expect(url).toContain("region=us-east-1");
    expect(url).toContain("#/stacks/quickcreate");
    expect(url).toContain("templateURL=https%3A%2F%2Fvisionxixlabs.com%2Faws%2Faxiom-agent-quick-deploy.yaml");
    expect(url).toContain("stackName=axiom-agent");
    expect(url).toContain("param_ExternalId=axiom-P4367g6BL0jq80jdc");
  });

  it("honors a custom region", () => {
    const url = buildAwsQuickDeployUrl({
      externalId: "axiom-P4367g6BL0jq80jdc",
      origin: "https://visionxixlabs.com",
      region: "eu-west-1",
    });
    expect(url.startsWith("https://eu-west-1.console.aws.amazon.com/cloudformation/home")).toBe(true);
    expect(url).toContain("region=eu-west-1");
  });

  it("strips trailing slash from origin", () => {
    const url = buildAwsQuickDeployUrl({
      externalId: "axiom-P4367g6BL0jq80jdc",
      origin: "https://visionxixlabs.com/",
    });
    // The templateURL inside the encoded query should not have a double slash.
    expect(url).toContain("templateURL=https%3A%2F%2Fvisionxixlabs.com%2Faws%2Faxiom-agent-quick-deploy.yaml");
    expect(url).not.toContain("visionxixlabs.com%2F%2F");
  });

  it("throws when externalId is malformed (catch before sending the user to AWS)", () => {
    expect(() => buildAwsQuickDeployUrl({
      externalId: "totally-not-valid",
      origin: "https://visionxixlabs.com",
    })).toThrow(/invalid externalid/i);
  });
});
