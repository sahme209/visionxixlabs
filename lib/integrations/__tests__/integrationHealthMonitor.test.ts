/**
 * Vitest unit tests for the pure integration health monitor.
 */

import { describe, it, expect } from "vitest";
import { buildIntegrationHealth, type IntegrationAttempt } from "../integrationHealthMonitor";

const A = (integration: IntegrationAttempt["integration"], ok: boolean, latencyMs = 100, endedAtIso = "2026-05-20T01:00:00.000Z", errorKind?: string): IntegrationAttempt =>
  ({ integration, ok, latencyMs, endedAtIso, errorKind });

describe("integrationHealthMonitor", () => {
  it("empty attempts → no rows, overall operational", () => {
    const r = buildIntegrationHealth([]);
    expect(r.rows.length).toBe(0);
    expect(r.overall).toBe("operational");
  });

  it("all-ok → operational verdict", () => {
    const r = buildIntegrationHealth([
      A("slack", true), A("slack", true), A("slack", true),
    ]);
    expect(r.rows[0].verdict).toBe("operational");
    expect(r.overall).toBe("operational");
  });

  it("60-95% success → degraded", () => {
    const r = buildIntegrationHealth([
      A("teams", true), A("teams", true), A("teams", true), A("teams", false), A("teams", false),
    ]);
    expect(r.rows[0].verdict).toBe("degraded");
  });

  it("< 60% success → down", () => {
    const r = buildIntegrationHealth([
      A("outlook", true), A("outlook", false), A("outlook", false), A("outlook", false),
    ]);
    expect(r.rows[0].verdict).toBe("down");
  });

  it("rows sorted down → degraded → idle → operational", () => {
    const r = buildIntegrationHealth([
      A("slack", true), A("slack", true),
      A("teams", true), A("teams", false), A("teams", false), A("teams", false), A("teams", false),
    ]);
    expect(r.rows[0].verdict).toBe("down");
    expect(r.rows[1].verdict).toBe("operational");
  });

  it("avgLatencyMs is rounded mean per integration", () => {
    const r = buildIntegrationHealth([
      A("slack", true, 100), A("slack", true, 200), A("slack", true, 300),
    ]);
    expect(r.rows[0].avgLatencyMs).toBe(200);
  });

  it("lastAttemptAt + lastErrorKind from most-recent ts", () => {
    const r = buildIntegrationHealth([
      A("slack", true,  100, "2026-05-20T01:00:00.000Z"),
      A("slack", false, 100, "2026-05-20T03:00:00.000Z", "rate_limited"),
      A("slack", true,  100, "2026-05-20T02:00:00.000Z"),
    ]);
    expect(r.rows[0].lastAttemptAt).toBe("2026-05-20T03:00:00.000Z");
    expect(r.rows[0].lastErrorKind).toBe("rate_limited");
  });

  it("overall reflects worst-case", () => {
    const r = buildIntegrationHealth([
      A("slack",  true), A("slack",  true),
      A("teams",  true), A("teams",  false), A("teams",  false), A("teams",  false), A("teams",  false),
    ]);
    expect(r.overall).toBe("down");
  });
});
