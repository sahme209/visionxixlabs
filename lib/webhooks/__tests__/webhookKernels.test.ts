import { describe, it, expect } from "vitest";
import {
  isWebhookEventKind,
  normalizeEventKinds,
  endpointSubscribesTo,
} from "../webhookEventKinds";
import { computeWebhookRetry, MAX_ATTEMPTS } from "../computeWebhookRetry";
import { classifyDeliveryOutcome } from "../classifyDeliveryOutcome";
import {
  buildWebhookEnvelope,
  serializeEnvelope,
  buildWebhookHeaders,
  WEBHOOK_PAYLOAD_VERSION,
} from "../buildWebhookPayload";
import {
  selectDeliveriesForEvent,
  validateWebhookUrl,
} from "../selectDeliveriesForEvent";

// ============================ event kinds ============================

describe("isWebhookEventKind", () => {
  it("accepts known kinds", () => {
    expect(isWebhookEventKind("release_gate.passed")).toBe(true);
    expect(isWebhookEventKind("eval.regression_detected")).toBe(true);
    expect(isWebhookEventKind("pipeline.run_completed")).toBe(true);
  });

  it("rejects typos + lookalikes", () => {
    expect(isWebhookEventKind("release_gate.PASSED")).toBe(false);
    expect(isWebhookEventKind("pipeline.completed")).toBe(false);
    expect(isWebhookEventKind("*")).toBe(false);  // wildcard isn't a real event
    expect(isWebhookEventKind("")).toBe(false);
  });
});

describe("normalizeEventKinds", () => {
  it("drops unknowns + dedups", () => {
    const r = normalizeEventKinds([
      "release_gate.passed", "BAD", "release_gate.passed",
      "pipeline.run_completed", 42, null,
    ]);
    expect(r).toEqual(["release_gate.passed", "pipeline.run_completed"]);
  });
});

describe("endpointSubscribesTo", () => {
  it("matches direct subscription", () => {
    expect(endpointSubscribesTo(["release_gate.passed"], "release_gate.passed")).toBe(true);
  });

  it("matches '*' wildcard", () => {
    expect(endpointSubscribesTo(["*"], "pipeline.run_failed")).toBe(true);
  });

  it("misses unsubscribed events", () => {
    expect(endpointSubscribesTo(["eval.run_completed"], "release_gate.passed")).toBe(false);
  });
});

// ============================ retry kernel ============================

describe("computeWebhookRetry", () => {
  it("schedules first retry ~30s after attempt 1 fails", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const r = computeWebhookRetry({ failedAttemptNumber: 1, now, jitterRoll: 0.5 });
    expect(r.kind).toBe("schedule_retry");
    if (r.kind === "schedule_retry") {
      // jitter factor = 0.75 + 0.5*0.5 = 1.0 → exactly 30s
      expect(r.delaySeconds).toBe(30);
      expect(r.nextAttemptAt!.getTime()).toBe(now.getTime() + 30 * 1000);
      expect(r.nextAttemptNumber).toBe(2);
    }
  });

  it("applies escalating backoff (1m, 5m, 30m, ...)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const delays: number[] = [];
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      const r = computeWebhookRetry({ failedAttemptNumber: i, now, jitterRoll: 0.5 });
      if (r.kind === "schedule_retry") delays.push(r.delaySeconds!);
    }
    // baseline schedule (jitter roll=0.5 → 1.0x baseline)
    expect(delays).toEqual([30, 60, 300, 1800, 3600, 21600, 43200]);
  });

  it("deadletters after MAX_ATTEMPTS failed attempts", () => {
    const r = computeWebhookRetry({ failedAttemptNumber: MAX_ATTEMPTS });
    expect(r.kind).toBe("deadletter_max_retries");
  });

  it("applies jitter (delay varies across rolls)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const lo = computeWebhookRetry({ failedAttemptNumber: 5, now, jitterRoll: 0 });
    const hi = computeWebhookRetry({ failedAttemptNumber: 5, now, jitterRoll: 1 });
    // baseline = 3600s. lo factor = 0.75 → 2700s. hi factor = 1.25 → 4500s.
    if (lo.kind === "schedule_retry" && hi.kind === "schedule_retry") {
      expect(lo.delaySeconds).toBe(2700);
      expect(hi.delaySeconds).toBe(4500);
    }
  });
});

// ============================ outcome classifier ============================

describe("classifyDeliveryOutcome", () => {
  it("2xx → delivered", () => {
    expect(classifyDeliveryOutcome({ httpStatus: 200 }).kind).toBe("delivered");
    expect(classifyDeliveryOutcome({ httpStatus: 204 }).kind).toBe("delivered");
  });

  it("5xx → retry", () => {
    const r = classifyDeliveryOutcome({ httpStatus: 503 });
    expect(r.kind).toBe("retry_due_to_5xx");
    expect(r.retryable).toBe(true);
  });

  it("4xx → deadletter (not retried)", () => {
    const r = classifyDeliveryOutcome({ httpStatus: 400 });
    expect(r.kind).toBe("deadletter_4xx");
    expect(r.retryable).toBe(false);
  });

  it("429 specifically deadletters (operator must fix their limit)", () => {
    const r = classifyDeliveryOutcome({ httpStatus: 429 });
    expect(r.kind).toBe("deadletter_4xx");
    expect(r.retryable).toBe(false);
  });

  it("network error → retry", () => {
    const r = classifyDeliveryOutcome({ httpStatus: null, networkError: "ECONNREFUSED" });
    expect(r.kind).toBe("retry_due_to_network");
    expect(r.retryable).toBe(true);
  });

  it("timeout → retry", () => {
    const r = classifyDeliveryOutcome({ httpStatus: null, timedOut: true });
    expect(r.kind).toBe("retry_due_to_timeout");
    expect(r.retryable).toBe(true);
  });

  it("invalid URL → deadletter", () => {
    const r = classifyDeliveryOutcome({ httpStatus: null, invalidUrl: true });
    expect(r.kind).toBe("deadletter_invalid_url");
    expect(r.retryable).toBe(false);
  });

  it("endpoint disabled → deadletter", () => {
    const r = classifyDeliveryOutcome({ httpStatus: 200, endpointDisabled: true });
    expect(r.kind).toBe("deadletter_endpoint_disabled");
    expect(r.retryable).toBe(false);
  });

  it("null status + no other signal → treated as network failure", () => {
    const r = classifyDeliveryOutcome({ httpStatus: null });
    expect(r.kind).toBe("retry_due_to_network");
  });
});

// ============================ payload builder ============================

describe("buildWebhookEnvelope + serializeEnvelope", () => {
  it("constructs the canonical envelope", () => {
    const env = buildWebhookEnvelope({
      eventId: "evt_abc",
      type: "release_gate.passed",
      organizationId: "ws_acme",
      data: { passRate: 0.95 },
      attemptNumber: 1,
      timestampSec: 1700000000,
    });
    expect(env.version).toBe(WEBHOOK_PAYLOAD_VERSION);
    expect(env.type).toBe("release_gate.passed");
    expect(env.timestampSec).toBe(1700000000);
  });

  it("serializes deterministically (byte-stable across calls)", () => {
    const input = {
      eventId: "evt_abc",
      type: "release_gate.passed" as const,
      organizationId: "ws_acme",
      data: { passRate: 0.95 },
      attemptNumber: 1,
      timestampSec: 1700000000,
    };
    const a = serializeEnvelope(buildWebhookEnvelope(input));
    const b = serializeEnvelope(buildWebhookEnvelope(input));
    expect(a).toBe(b);
  });

  it("includes attemptNumber so retries can be deduped", () => {
    const a = serializeEnvelope(buildWebhookEnvelope({
      eventId: "evt_abc", type: "release_gate.passed", organizationId: "ws_acme",
      data: {}, attemptNumber: 1, timestampSec: 1700000000,
    }));
    const b = serializeEnvelope(buildWebhookEnvelope({
      eventId: "evt_abc", type: "release_gate.passed", organizationId: "ws_acme",
      data: {}, attemptNumber: 2, timestampSec: 1700000000,
    }));
    expect(a).not.toBe(b);
  });
});

describe("buildWebhookHeaders", () => {
  it("includes all expected X-VXL-* headers", () => {
    const h = buildWebhookHeaders({
      signatureHex: "deadbeef",
      timestampSec: 1700000000,
      eventId: "evt_abc",
      eventKind: "release_gate.passed",
      attemptNumber: 3,
    });
    expect(h["Content-Type"]).toBe("application/json");
    expect(h["X-VXL-Event-Id"]).toBe("evt_abc");
    expect(h["X-VXL-Event-Type"]).toBe("release_gate.passed");
    expect(h["X-VXL-Timestamp"]).toBe("1700000000");
    expect(h["X-VXL-Signature"]).toBe("deadbeef");
    expect(h["X-VXL-Attempt"]).toBe("3");
  });
});

// ============================ selection kernel ============================

describe("selectDeliveriesForEvent", () => {
  it("includes endpoints subscribed to the event", () => {
    const r = selectDeliveriesForEvent({
      eventKind: "release_gate.passed",
      endpoints: [
        { id: "1", url: "https://a.com", subscribedEvents: ["release_gate.passed"], revokedAt: null },
        { id: "2", url: "https://b.com", subscribedEvents: ["pipeline.run_completed"], revokedAt: null },
      ],
    });
    expect(r.toDeliver.map((d) => d.id)).toEqual(["1"]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["unsubscribed_event"]);
  });

  it("'*' subscription matches everything", () => {
    const r = selectDeliveriesForEvent({
      eventKind: "pipeline.run_failed",
      endpoints: [
        { id: "1", url: "https://a.com", subscribedEvents: ["*"], revokedAt: null },
      ],
    });
    expect(r.toDeliver.length).toBe(1);
  });

  it("skips revoked endpoints", () => {
    const r = selectDeliveriesForEvent({
      eventKind: "release_gate.passed",
      endpoints: [
        { id: "1", url: "https://a.com", subscribedEvents: ["*"], revokedAt: new Date() },
      ],
    });
    expect(r.toDeliver.length).toBe(0);
    expect(r.skipped[0].reason).toBe("revoked");
  });

  it("auto-disables endpoints over failure threshold", () => {
    const r = selectDeliveriesForEvent({
      eventKind: "release_gate.passed",
      endpoints: [
        {
          id: "1", url: "https://a.com",
          subscribedEvents: ["*"], revokedAt: null,
          consecutiveFailures: 50, autoDisableThreshold: 50,
        },
      ],
    });
    expect(r.toDeliver.length).toBe(0);
    expect(r.skipped[0].reason).toBe("auto_disabled_too_many_failures");
  });
});

describe("validateWebhookUrl", () => {
  it("accepts a normal https URL", () => {
    expect(validateWebhookUrl("https://hooks.acme.com/webhook").ok).toBe(true);
  });

  it("rejects http by default", () => {
    const r = validateWebhookUrl("http://hooks.acme.com");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong_protocol");
  });

  it("allows http when explicitly opted in (dev/test)", () => {
    expect(validateWebhookUrl("http://hooks.acme.com", { allowHttp: true }).ok).toBe(true);
  });

  it("rejects unparseable URLs", () => {
    expect(validateWebhookUrl("not a url").ok).toBe(false);
  });

  it("blocks localhost", () => {
    expect(validateWebhookUrl("https://localhost/hook").reason).toBe("localhost_blocked");
    expect(validateWebhookUrl("https://127.0.0.1/hook").reason).toBe("localhost_blocked");
  });

  it("blocks private IP ranges", () => {
    expect(validateWebhookUrl("https://10.0.0.5/hook").reason).toBe("private_ip_blocked");
    expect(validateWebhookUrl("https://192.168.1.1/hook").reason).toBe("private_ip_blocked");
    expect(validateWebhookUrl("https://172.16.0.1/hook").reason).toBe("private_ip_blocked");
  });

  it("allows private when explicitly opted in", () => {
    expect(validateWebhookUrl("https://10.0.0.5/hook", { allowPrivate: true }).ok).toBe(true);
  });
});
