/**
 * Vitest unit tests for the pure integration catalog + readiness checker.
 */

import { describe, it, expect } from "vitest";
import { checkIntegrationReadiness, findIntegration, listIntegrations } from "../integrationCatalog";

describe("integrationCatalog", () => {
  it("listIntegrations includes slack, teams, outlook, gmail, pagerduty, webhook_generic", () => {
    const names = listIntegrations().map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(["slack", "teams", "outlook", "gmail", "pagerduty", "webhook_generic"]));
  });

  it("findIntegration returns null for unknown", () => {
    // @ts-expect-error - intentionally pass invalid name
    expect(findIntegration("not-a-real-integration")).toBeNull();
  });

  it("each integration has at least one supported mode + required keys per mode", () => {
    for (const def of listIntegrations()) {
      expect(def.supportedModes.length).toBeGreaterThan(0);
      for (const mode of def.supportedModes) {
        expect(def.requiredKeysByMode[mode]).toBeDefined();
        expect(def.requiredKeysByMode[mode].length).toBeGreaterThan(0);
      }
    }
  });

  it("readiness: configured=true when all required env keys set", () => {
    const r = checkIntegrationReadiness({
      modeByIntegration: { slack: "webhook" },
      envSet: { SLACK_WEBHOOK_URL: true },
    });
    expect(r[0].configured).toBe(true);
    expect(r[0].missingKeys).toEqual([]);
  });

  it("readiness: configured=false when keys missing, missingKeys lists them", () => {
    const r = checkIntegrationReadiness({
      modeByIntegration: { slack: "bot_token" },
      envSet: { SLACK_CLIENT_ID: true },
    });
    expect(r[0].configured).toBe(false);
    expect(r[0].missingKeys).toEqual(expect.arrayContaining(["SLACK_CLIENT_SECRET", "SLACK_BOT_TOKEN"]));
  });

  it("readiness: skips integrations without a chosen mode", () => {
    const r = checkIntegrationReadiness({
      modeByIntegration: {},
      envSet: {},
    });
    expect(r).toEqual([]);
  });

  it("readiness: skips unknown mode silently", () => {
    const r = checkIntegrationReadiness({
      modeByIntegration: { slack: "not-a-real-mode" },
      envSet: {},
    });
    expect(r).toEqual([]);
  });

  it("Outlook requires Microsoft Graph creds", () => {
    const def = findIntegration("outlook");
    expect(def?.requiredKeysByMode.graph_user).toEqual(expect.arrayContaining(["MS_CLIENT_ID", "MS_TENANT_ID"]));
  });
});
