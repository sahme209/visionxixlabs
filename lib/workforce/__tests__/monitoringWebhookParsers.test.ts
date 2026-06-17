/**
 * monitoringWebhookParsers — Phase 645.
 *
 * Five real provider payload shapes (one for each tool the Phase 643
 * ingester accepts) plus malformed-input edges. Realistic payloads
 * matter because webhook regressions are silent — the ingest endpoint
 * returns 202 either way, and the operator only notices when the
 * dashboard shows "(no title)" hours later. These tests are the
 * canary.
 */

import { describe, it, expect } from "vitest";
import { parseWebhookPayload } from "../domains/monitoringWebhookParsers";

describe("parseWebhookPayload :: datadog", () => {
  it("normalizes a triggered metric alert into firing/high", () => {
    const raw = {
      event_id: "dd_evt_12345",
      event_type: "metric_alert",
      alert_title: "[Triggered] CPU > 85% on api-gateway",
      alert_status: "alert",
      alert_metric: "system.cpu.user",
      alert_transition: "triggered",
      priority: "p2",
      body: "Triggered: CPU usage exceeded 85% on api-gateway-prod-us-east-1.",
      tags: ["env:prod", "service:api-gateway"],
    };
    const a = parseWebhookPayload("datadog", raw);
    expect(a.alertId).toBe("dd_evt_12345");
    expect(a.title).toBe("[Triggered] CPU > 85% on api-gateway");
    expect(a.severity).toBe("high");
    expect(a.state).toBe("firing");
    expect(a.affectedService).toBe("system.cpu.user");
    expect(a.tags).toEqual(["env:prod", "service:api-gateway"]);
  });

  it("treats alert_status=ok as resolved", () => {
    const a = parseWebhookPayload("datadog", {
      event_id: "dd_evt_2",
      alert_title: "Recovered: CPU back below 85%",
      alert_status: "ok",
      priority: "p2",
    });
    expect(a.state).toBe("resolved");
  });

  it("falls back to generic title when alert_title is missing", () => {
    const a = parseWebhookPayload("datadog", {
      event_id: "dd_evt_3",
      title: "Generic title",
      alert_status: "alert",
    });
    expect(a.title).toBe("Generic title");
  });
});

describe("parseWebhookPayload :: prometheus_alertmanager", () => {
  it("normalizes a single firing alert with labels + annotations", () => {
    const raw = {
      receiver: "axiom",
      status: "firing",
      alerts: [
        {
          status: "firing",
          labels: {
            alertname: "HighRequestLatency",
            severity: "critical",
            service: "checkout",
            job: "checkout-api",
            instance: "checkout-prod-7",
          },
          annotations: {
            summary: "p99 latency > 2s on checkout for 10m",
            description: "Latency exceeded 2s p99 sustained — likely DB contention.",
          },
          startsAt: "2026-06-16T12:34:56Z",
          endsAt: "0001-01-01T00:00:00Z",
        },
      ],
    };
    const a = parseWebhookPayload("prometheus_alertmanager", raw);
    expect(a.title).toBe("p99 latency > 2s on checkout for 10m");
    expect(a.severity).toBe("critical");
    expect(a.state).toBe("firing");
    expect(a.affectedService).toBe("checkout");
    expect(a.tags).toContain("alertname=HighRequestLatency");
    expect(a.tags).toContain("severity=critical");
  });

  it("calls out the batch count when multiple alerts come in one push", () => {
    const raw = {
      status: "firing",
      alerts: [
        { status: "firing", labels: { alertname: "A", severity: "high" }, annotations: { summary: "A fires", description: "A details" } },
        { status: "firing", labels: { alertname: "B", severity: "high" }, annotations: { summary: "B fires", description: "B details" } },
        { status: "firing", labels: { alertname: "C", severity: "high" }, annotations: { summary: "C fires", description: "C details" } },
      ],
    };
    const a = parseWebhookPayload("prometheus_alertmanager", raw);
    expect(a.description).toContain("3 alerts in this batch");
  });

  it("returns generic fallback when alerts array is empty", () => {
    const a = parseWebhookPayload("prometheus_alertmanager", { alerts: [] });
    expect(a.title).toBe("(no title)");
  });
});

describe("parseWebhookPayload :: pagerduty", () => {
  it("normalizes a triggered incident with high urgency", () => {
    const raw = {
      messages: [
        {
          event: "incident.trigger",
          incident: {
            id: "PT4KHLK",
            incident_key: "checkout-down",
            title: "Checkout service unavailable",
            status: "triggered",
            urgency: "high",
            description: "All checkout endpoints returning 503 since 12:34Z.",
            service: { name: "checkout-api", summary: "checkout-api" },
          },
        },
      ],
    };
    const a = parseWebhookPayload("pagerduty", raw);
    expect(a.alertId).toBe("PT4KHLK");
    expect(a.title).toBe("Checkout service unavailable");
    expect(a.severity).toBe("high");
    expect(a.state).toBe("firing");
    expect(a.affectedService).toBe("checkout-api");
  });

  it("maps status=resolved to resolved", () => {
    const a = parseWebhookPayload("pagerduty", {
      messages: [{ incident: { id: "PT2", title: "Resolved", status: "resolved", urgency: "low" } }],
    });
    expect(a.state).toBe("resolved");
    expect(a.severity).toBe("low");
  });

  it("falls back to top-level incident when messages[] is missing", () => {
    const a = parseWebhookPayload("pagerduty", {
      incident: { id: "PT3", title: "Direct payload", status: "triggered", urgency: "high" },
    });
    expect(a.alertId).toBe("PT3");
    expect(a.state).toBe("firing");
  });
});

describe("parseWebhookPayload :: grafana", () => {
  it("treats grafana legacy state=alerting as firing", () => {
    const a = parseWebhookPayload("grafana", {
      ruleId: "42",
      ruleName: "Disk usage > 90% on logs-prod-1",
      state: "alerting",
      message: "Disk usage exceeded 90% for 15m on logs-prod-1.",
    });
    expect(a.alertId).toBe("gr_42");
    expect(a.title).toBe("Disk usage > 90% on logs-prod-1");
    expect(a.state).toBe("firing");
    expect(a.description).toContain("Disk usage exceeded 90%");
  });

  it("dispatches to prometheus parser when unified v9 alerts[] is present", () => {
    const a = parseWebhookPayload("grafana", {
      alerts: [
        {
          status: "firing",
          labels: { alertname: "PodCrashLoop", severity: "critical" },
          annotations: { summary: "Pod crash loop", description: "Restart count > 10" },
        },
      ],
    });
    expect(a.title).toBe("Pod crash loop");
    expect(a.severity).toBe("critical");
  });
});

describe("parseWebhookPayload :: opsgenie", () => {
  it("treats action=Create as firing and uses message as title", () => {
    const a = parseWebhookPayload("opsgenie", {
      action: "Create",
      alert: {
        alertId: "abc-123-xyz",
        message: "Memory pressure on db-replica-2",
        description: "RSS sustained over 92% for 8m.",
        priority: "P1",
        entity: "db-replica-2",
        tags: ["db", "memory", "p1"],
      },
    });
    expect(a.alertId).toBe("abc-123-xyz");
    expect(a.title).toBe("Memory pressure on db-replica-2");
    expect(a.severity).toBe("critical");
    expect(a.state).toBe("firing");
    expect(a.affectedService).toBe("db-replica-2");
    expect(a.tags).toEqual(["db", "memory", "p1"]);
  });

  it("treats action=Close as resolved", () => {
    const a = parseWebhookPayload("opsgenie", {
      action: "Close",
      alert: { alertId: "x1", message: "Cleared" },
    });
    expect(a.state).toBe("resolved");
  });
});

describe("parseWebhookPayload :: generic + edges", () => {
  it("extracts well-known fields from a generic payload", () => {
    const a = parseWebhookPayload("generic", {
      id: "custom-1",
      title: "Custom title",
      description: "Custom desc",
      severity: "error",
      state: "alerting",
      service: "custom-svc",
      tags: ["a", "b"],
    });
    expect(a.alertId).toBe("custom-1");
    expect(a.title).toBe("Custom title");
    expect(a.severity).toBe("high"); // "error" maps to high
    expect(a.state).toBe("firing");
    expect(a.affectedService).toBe("custom-svc");
    expect(a.tags).toEqual(["a", "b"]);
  });

  it("never throws on null payload — returns the empty default", () => {
    const a = parseWebhookPayload("generic", null);
    expect(a.title).toBe("(no title)");
    expect(a.state).toBe("unknown");
  });

  it("never throws on a string payload", () => {
    const a = parseWebhookPayload("generic", "this is not json");
    expect(a.title).toBe("(no title)");
  });

  it("clamps oversized description to a sane length", () => {
    const a = parseWebhookPayload("generic", {
      title: "ok",
      description: "x".repeat(5000),
    });
    expect(a.description.length).toBeLessThanOrEqual(1200);
  });

  it("ignores tags that are not strings", () => {
    const a = parseWebhookPayload("generic", {
      title: "ok",
      tags: ["good", 42, null, { bad: 1 }, "also-good"],
    });
    expect(a.tags).toEqual(["good", "also-good"]);
  });

  it("maps severity aliases (p1/sev1/emergency → critical)", () => {
    expect(parseWebhookPayload("generic", { title: "t", severity: "p1" }).severity).toBe("critical");
    expect(parseWebhookPayload("generic", { title: "t", severity: "sev1" }).severity).toBe("critical");
    expect(parseWebhookPayload("generic", { title: "t", severity: "emergency" }).severity).toBe("critical");
  });
});
