/**
 * Vitest unit tests for the pure desktop notification builder.
 */

import { describe, it, expect } from "vitest";
import {
  buildDesktopNotificationForAll, buildLinuxNotification,
  buildMacOsNotification, buildWindowsToast, pickByOs,
  type DesktopNotificationSeed,
} from "../desktopNotificationBuilder";

const SEED: DesktopNotificationSeed = {
  kind: "approval_packet_ready",
  title: "Approval needed: Tighten S3 PAB",
  subtitle: "single resource · low blast",
  body: "Reviewers: alice@example.com, bob@example.com",
  severity: "high",
  deepLink: "axiom://approvals/pkt-42",
  primaryAction: { label: "Open packet", deepLink: "axiom://approvals/pkt-42" },
};

describe("buildMacOsNotification", () => {
  it("clips title to 60 and body to 200", () => {
    const long = "x".repeat(500);
    const p = buildMacOsNotification({ ...SEED, title: long, body: long });
    expect(p.title.length).toBe(60);
    expect(p.body.length).toBe(200);
  });

  it("severity critical → ping sound; low → silent", () => {
    expect(buildMacOsNotification({ ...SEED, severity: "critical" }).sound).toBe("ping");
    expect(buildMacOsNotification({ ...SEED, severity: "low" }).sound).toBe("");
  });

  it("threadIdentifier mirrors kind so notifications group", () => {
    const p = buildMacOsNotification(SEED);
    expect(p.threadIdentifier).toBe("approval_packet_ready");
  });

  it("userInfo carries deepLink + primaryAction", () => {
    const p = buildMacOsNotification(SEED);
    expect(p.userInfo.deepLink).toBe("axiom://approvals/pkt-42");
    expect(p.userInfo.primaryActionLabel).toBe("Open packet");
  });
});

describe("buildWindowsToast", () => {
  it("emits valid-shape Toast XML", () => {
    const p = buildWindowsToast(SEED);
    expect(p.toastXml.startsWith("<toast")).toBe(true);
    expect(p.toastXml).toContain("<text>");
    expect(p.toastXml).toContain("Approval needed: Tighten S3 PAB");
  });

  it("severity=critical adds scenario='urgent'", () => {
    const p = buildWindowsToast({ ...SEED, severity: "critical" });
    expect(p.toastXml).toContain('scenario="urgent"');
  });

  it("escapes XML-sensitive characters", () => {
    const p = buildWindowsToast({ ...SEED, title: 'A & B <x> "y" \'z\'' });
    expect(p.toastXml).toContain("A &amp; B &lt;x&gt; &quot;y&quot; &apos;z&apos;");
  });

  it("primaryAction renders an <action> element", () => {
    const p = buildWindowsToast(SEED);
    expect(p.toastXml).toContain('<actions>');
    expect(p.toastXml).toContain('content="Open packet"');
  });
});

describe("buildLinuxNotification", () => {
  it("severity → urgency mapping", () => {
    expect(buildLinuxNotification({ ...SEED, severity: "critical" }).urgency).toBe("critical");
    expect(buildLinuxNotification({ ...SEED, severity: "low" }).urgency).toBe("low");
    expect(buildLinuxNotification({ ...SEED, severity: "medium" }).urgency).toBe("normal");
  });

  it("hints carry kind + deepLink", () => {
    const p = buildLinuxNotification(SEED);
    expect(p.hints["x-axiom-kind"]).toBe("approval_packet_ready");
    expect(p.hints["x-axiom-deeplink"]).toBe("axiom://approvals/pkt-42");
  });

  it("actions empty when no primaryAction", () => {
    const p = buildLinuxNotification({ ...SEED, primaryAction: undefined });
    expect(p.actions).toEqual([]);
  });
});

describe("buildDesktopNotificationForAll + pickByOs", () => {
  it("emits all three OS payloads in one call", () => {
    const p = buildDesktopNotificationForAll(SEED);
    expect(p.macos).toBeDefined();
    expect(p.windows).toBeDefined();
    expect(p.linux).toBeDefined();
  });

  it("pickByOs returns the right shape per platform + null for unknown", () => {
    expect(pickByOs(SEED, "macos")).toMatchObject({ threadIdentifier: "approval_packet_ready" });
    expect(pickByOs(SEED, "windows")).toMatchObject({ toastXml: expect.any(String) });
    expect(pickByOs(SEED, "linux")).toMatchObject({ summary: expect.any(String) });
    expect(pickByOs(SEED, "unknown")).toBeNull();
  });
});
