import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "lib/releaseops/instrumentedAiFetcher.ts"), "utf8");

describe("instrumented release-workflow AI policy contract", () => {
  it("fails closed on unavailable or exhausted workspace credit controls", () => {
    expect(source).toContain("checkWorkspaceAICredits");
    expect(source).toContain("failClosedOnUsageReadError: true");
    expect(source).toContain("workspace_ai_credit_meter_unavailable");
    expect(source).toContain("workspace_ai_credit_pool_exhausted");
  });

  it("attributes provider-reported usage without retaining prompts", () => {
    expect(source).toContain("recordAIUsageEvent");
    expect(source).toContain("provider: raw.provider");
    expect(source).toContain('source: "releaseops.instrumented_fetcher"');
    expect(source).not.toContain("prompt: prompt");
  });
});
