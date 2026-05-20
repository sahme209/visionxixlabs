/**
 * Vitest unit tests for the pure push payload builder.
 */

import { describe, it, expect } from "vitest";
import { buildApnsPayload, buildFcmPayload } from "../pushPayloadBuilder";

describe("pushPayloadBuilder", () => {
  it("APNS: severity=critical → interruption-level critical", () => {
    const p = buildApnsPayload({
      kind: "incident_paged", title: "boom", body: "...", severity: "critical",
    });
    expect(p.aps["interruption-level"]).toBe("critical");
  });

  it("APNS: severity=high → time-sensitive", () => {
    const p = buildApnsPayload({ kind: "incident_paged", title: "x", body: "y", severity: "high" });
    expect(p.aps["interruption-level"]).toBe("time-sensitive");
  });

  it("APNS: severity unset → active", () => {
    const p = buildApnsPayload({ kind: "approval_packet_ready", title: "x", body: "y" });
    expect(p.aps["interruption-level"]).toBe("active");
  });

  it("APNS: clips title (60) and body (140)", () => {
    const title = "T".repeat(200);
    const body = "B".repeat(500);
    const p = buildApnsPayload({ kind: "incident_paged", title, body });
    expect(p.aps.alert.title.length).toBe(60);
    expect(p.aps.alert.body.length).toBe(140);
  });

  it("APNS: custom dictionary carries kind + deepLink", () => {
    const p = buildApnsPayload({
      kind: "approval_packet_ready", title: "x", body: "y",
      deepLink: "axiom://approvals/123",
    });
    expect(p.custom.kind).toBe("approval_packet_ready");
    expect(p.custom.deepLink).toBe("axiom://approvals/123");
  });

  it("FCM: high severity → priority high + critical channel", () => {
    const p = buildFcmPayload({
      kind: "incident_paged", title: "x", body: "y", severity: "critical",
    });
    expect(p.android.priority).toBe("high");
    expect(p.android.notification.channel_id).toBe("axiom_critical");
  });

  it("FCM: low severity → priority normal + default channel", () => {
    const p = buildFcmPayload({ kind: "incident_paged", title: "x", body: "y", severity: "low" });
    expect(p.android.priority).toBe("normal");
    expect(p.android.notification.channel_id).toBe("axiom_default");
  });

  it("FCM: data carries kind + deepLink + threadId when supplied", () => {
    const p = buildFcmPayload({
      kind: "approval_packet_ready", title: "x", body: "y",
      deepLink: "axiom://approvals/42", threadId: "thr-42",
    });
    expect(p.data.kind).toBe("approval_packet_ready");
    expect(p.data.deepLink).toBe("axiom://approvals/42");
    expect(p.data.threadId).toBe("thr-42");
  });

  it("FCM: tag mirrors threadId so the same thread collapses on Android", () => {
    const p = buildFcmPayload({
      kind: "approval_packet_ready", title: "x", body: "y", threadId: "t-1",
    });
    expect(p.android.notification.tag).toBe("t-1");
  });
});
