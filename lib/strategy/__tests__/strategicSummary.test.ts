import { describe, expect, it } from "vitest";

import { providerDepthEvidence } from "../strategicSummary";

describe("providerDepthEvidence", () => {
  it("does not claim a live provider when the current state has none", () => {
    expect(providerDepthEvidence([
      { provider: "aws", mode: "preview" },
      { provider: "github", mode: "partial_live" },
    ] as never)).toBe("No provider is live-validated. Other configured or preview providers: aws, github.");
  });
});
