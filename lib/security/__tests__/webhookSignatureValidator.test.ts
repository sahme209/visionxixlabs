/**
 * Vitest unit tests for the webhook signature validator.
 */

import { describe, it, expect } from "vitest";
import { signWebhookPayload, validateWebhookSignature } from "../webhookSignatureValidator";

const SECRET = "whsec_test_secret_value";
const BODY = `{"event":"approval_packet_ready","id":"pkt-42"}`;

describe("webhookSignatureValidator", () => {
  it("valid signature passes", () => {
    const sig = signWebhookPayload(SECRET, BODY);
    const r = validateWebhookSignature({ rawBody: BODY, signatureHex: sig, secret: SECRET });
    expect(r.valid).toBe(true);
  });

  it("missing secret → reason missing_secret", () => {
    const r = validateWebhookSignature({ rawBody: BODY, signatureHex: "deadbeef", secret: "" });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("missing_secret");
  });

  it("non-hex signature → malformed_hex", () => {
    const r = validateWebhookSignature({ rawBody: BODY, signatureHex: "not-hex!", secret: SECRET });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("malformed_hex");
  });

  it("tampered body → bad_signature", () => {
    const sig = signWebhookPayload(SECRET, BODY);
    const r = validateWebhookSignature({ rawBody: BODY + "x", signatureHex: sig, secret: SECRET });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("bad_signature");
  });

  it("timestamp anti-replay: stale fails", () => {
    const ts = 1_000_000;
    const sig = signWebhookPayload(SECRET, BODY, ts);
    const r = validateWebhookSignature({
      rawBody: BODY, signatureHex: sig, secret: SECRET,
      timestampSec: ts, nowSec: ts + 1000, toleranceSec: 300,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("stale_timestamp");
  });

  it("timestamp anti-replay: future fails", () => {
    const ts = 1_000_000;
    const sig = signWebhookPayload(SECRET, BODY, ts);
    const r = validateWebhookSignature({
      rawBody: BODY, signatureHex: sig, secret: SECRET,
      timestampSec: ts, nowSec: ts - 1000, toleranceSec: 300,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("future_timestamp");
  });

  it("timestamp within tolerance: valid", () => {
    const ts = 1_000_000;
    const sig = signWebhookPayload(SECRET, BODY, ts);
    const r = validateWebhookSignature({
      rawBody: BODY, signatureHex: sig, secret: SECRET,
      timestampSec: ts, nowSec: ts + 60, toleranceSec: 300,
    });
    expect(r.valid).toBe(true);
  });

  it("different secret → bad_signature (timing-safe)", () => {
    const sig = signWebhookPayload("other_secret", BODY);
    const r = validateWebhookSignature({ rawBody: BODY, signatureHex: sig, secret: SECRET });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("bad_signature");
  });
});
