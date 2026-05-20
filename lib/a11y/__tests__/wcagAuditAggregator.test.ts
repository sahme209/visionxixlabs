/**
 * Vitest unit tests for the pure WCAG a11y aggregator.
 */

import { describe, it, expect } from "vitest";
import { aggregateA11yFindings, type RawA11yFinding } from "../wcagAuditAggregator";

const F = (ruleId: string, impact: RawA11yFinding["impact"], route = "/", wcagLevels: RawA11yFinding["wcagLevels"] = ["AA"]): RawA11yFinding =>
  ({ ruleId, impact, route, wcagLevels, nodeCount: 1, description: `${ruleId} on ${route}` });

describe("aggregateA11yFindings", () => {
  it("empty findings → ok overall", () => {
    const r = aggregateA11yFindings({ findings: [] });
    expect(r.overall).toBe("ok");
    expect(r.routes).toEqual([]);
    expect(r.failsRequiredLevel).toBe(false);
  });

  it("critical AA finding → fails required level (default AA)", () => {
    const r = aggregateA11yFindings({ findings: [F("color-contrast", "critical", "/")] });
    expect(r.failsRequiredLevel).toBe(true);
    expect(r.overall).toBe("fail");
  });

  it("minor finding → warn route, ok overall", () => {
    const r = aggregateA11yFindings({ findings: [F("label", "minor", "/")] });
    expect(r.routes[0].status).toBe("warn");
    expect(r.overall).toBe("warn");
  });

  it("AAA-only finding doesn't trip required-AA failure", () => {
    const r = aggregateA11yFindings({
      findings: [F("color-contrast-enhanced", "critical", "/", ["AAA"])],
      options: { requiredLevel: "AA" },
    });
    expect(r.failsRequiredLevel).toBe(false);
  });

  it("custom blockingImpact='moderate' bumps moderate findings to fail", () => {
    const r = aggregateA11yFindings({
      findings: [F("region", "moderate", "/")],
      options: { blockingImpact: "moderate" },
    });
    expect(r.routes[0].status).toBe("fail");
  });

  it("topRules sorted by count desc", () => {
    const r = aggregateA11yFindings({
      findings: [
        F("aria-label", "minor", "/a"),
        F("aria-label", "minor", "/b"),
        F("color-contrast", "serious", "/a"),
      ],
    });
    expect(r.topRules[0].ruleId).toBe("aria-label");
    expect(r.topRules[0].count).toBe(2);
  });

  it("perRule.affectedRoutes counts distinct routes", () => {
    const r = aggregateA11yFindings({
      findings: [F("aria-label", "minor", "/a"), F("aria-label", "minor", "/a"), F("aria-label", "minor", "/b")],
    });
    const rule = r.topRules.find((x) => x.ruleId === "aria-label")!;
    expect(rule.affectedRoutes).toBe(2);
  });

  it("routes sorted fail → warn → ok", () => {
    const r = aggregateA11yFindings({
      findings: [
        F("label", "minor", "/ok-route"),         // warn
        F("color-contrast", "critical", "/bad"), // fail
      ],
    });
    expect(r.routes[0].route).toBe("/bad");
    expect(r.routes[1].route).toBe("/ok-route");
  });

  it("byImpact counts split per route", () => {
    const r = aggregateA11yFindings({
      findings: [F("a", "critical", "/x"), F("b", "minor", "/x")],
    });
    expect(r.routes[0].byImpact.critical).toBe(1);
    expect(r.routes[0].byImpact.minor).toBe(1);
  });
});
