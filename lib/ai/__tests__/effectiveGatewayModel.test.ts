import { describe, expect, it } from "vitest";
import { effectiveGatewayModel, gatewayModelOutputBoundVerified } from "../effectiveGatewayModel";

describe("effective Gateway model output bound", () => {
  it.each([
    [{ defaultModel: "vendor/default" }, "vendor/default"],
    [{ modelSelection: "service-default", defaultModel: "vendor/default" }, "vendor/default"],
    [{ model: "service-default", modelSelection: "vendor/ignored", defaultModel: "vendor/default" }, "vendor/default"],
    [{ model: "vendor/explicit", modelSelection: "vendor/selection", defaultModel: "xai/grok-4.20-multi-agent" }, "vendor/explicit"],
    [{ modelSelection: "vmc/private", defaultModel: "xai/grok-4.20-multi-agent" }, "vmc/private"],
    [{ model: "", modelSelection: "vendor/ignored", defaultModel: "vendor/default" }, "vendor/default"],
  ])("matches actual manager/provider precedence for %j", (input, expected) => {
    expect(effectiveGatewayModel(input)).toBe(expected);
    expect(gatewayModelOutputBoundVerified(expected)).toBe(true);
  });
  it.each([undefined, "", "service-default", "xai/grok-4.20-multi-agent", "spacexai/grok-4.20-multi-agent", "xai/grok-4.20-multi-agent:variant", "xai/grok-4.20-multi-agent-latest"])("refuses unverified model %s", model => {
    expect(gatewayModelOutputBoundVerified(model)).toBe(false);
  });
  it.each(["xai/grok-4.20", "xai/grok-4.20-multi-agentish", "vmc/private"])("retains ordinary model %s", model => {
    expect(gatewayModelOutputBoundVerified(model)).toBe(true);
  });
});
