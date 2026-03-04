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
});
