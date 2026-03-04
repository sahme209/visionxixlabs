import { describe, it, expect } from "vitest";
import { mapIntentToPlugin } from "../intentToPluginMap";

describe("mapIntentToPlugin", () => {
  it('maps "Analyze my AWS environment" to aws:infra-discovery', () => {
    const result = mapIntentToPlugin("Analyze my AWS environment");
    expect(result).not.toBeNull();
    expect(result!.pluginId).toBe("aws:infra-discovery");
    expect(result!.readOnly).toBe(true);
    expect(result!.confidence).toBe("high");
  });

  it('maps "Scan my environment" to aws:infra-discovery', () => {
    const result = mapIntentToPlugin("Scan my environment");
    expect(result).not.toBeNull();
    expect(result!.pluginId).toBe("aws:infra-discovery");
    expect(result!.readOnly).toBe(true);
    expect(result!.confidence).toBe("high");
  });

  it('maps "What infrastructure do I have?" to aws:infra-discovery', () => {
    const result = mapIntentToPlugin("What infrastructure do I have?");
    expect(result).not.toBeNull();
    expect(result!.pluginId).toBe("aws:infra-discovery");
    expect(result!.readOnly).toBe(true);
    expect(result!.confidence).toBe("high");
  });

  it('maps "Analyze my AWS costs" to aws:cost-explorer-summary', () => {
    const result = mapIntentToPlugin("Analyze my AWS costs");
    expect(result).not.toBeNull();
    expect(result!.pluginId).toBe("aws:cost-explorer-summary");
    expect(result!.readOnly).toBe(true);
    expect(result!.confidence).toBe("high");
  });

  it('maps "aws spend" to aws:cost-explorer-summary', () => {
    const result = mapIntentToPlugin("aws spend");
    expect(result).not.toBeNull();
    expect(result!.pluginId).toBe("aws:cost-explorer-summary");
  });

  it('maps "check S3 security" to aws:s3-public-bucket-scan', () => {
    const result = mapIntentToPlugin("check S3 security");
    expect(result).not.toBeNull();
    expect(result!.pluginId).toBe("aws:s3-public-bucket-scan");
    expect(result!.readOnly).toBe(true);
  });

  it('maps "create CICD" to github:create-cicd-pipeline', () => {
    const result = mapIntentToPlugin("create CICD");
    expect(result).not.toBeNull();
    expect(result!.pluginId).toBe("github:create-cicd-pipeline");
    expect(result!.readOnly).toBe(false);
  });

  it('maps "GitHub actions" to github:create-cicd-pipeline', () => {
    const result = mapIntentToPlugin("Set up GitHub actions");
    expect(result).not.toBeNull();
    expect(result!.pluginId).toBe("github:create-cicd-pipeline");
  });
});
