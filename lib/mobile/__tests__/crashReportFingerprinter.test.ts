/**
 * Vitest unit tests for the pure mobile crash-report fingerprinter.
 */

import { describe, it, expect } from "vitest";
import { buildCrashGroups, fingerprintCrash, type RawCrashReport } from "../crashReportFingerprinter";

const R = (id: string, platform: string, appVersion: string, occurredAtIso: string, frames: Array<{ symbol: string; file?: string; line?: number }>): RawCrashReport =>
  ({ id, platform, appVersion, occurredAtIso, message: "boom", stackFrames: frames });

describe("crashReportFingerprinter", () => {
  it("identical top-N frames → identical fingerprint", () => {
    const a = R("a", "ios", "1.0.0", "2026-05-20T01:00:00Z", [
      { symbol: "AxiomApp.RootView.body" },
      { symbol: "AxiomApp.LoginView.viewDidAppear" },
      { symbol: "AxiomApp.SessionManager.refresh" },
    ]);
    const b = R("b", "ios", "1.0.1", "2026-05-20T02:00:00Z", [
      { symbol: "AxiomApp.RootView.body" },
      { symbol: "AxiomApp.LoginView.viewDidAppear" },
      { symbol: "AxiomApp.SessionManager.refresh" },
    ]);
    expect(fingerprintCrash(a)).toBe(fingerprintCrash(b));
  });

  it("memory addresses normalized out", () => {
    const a = R("a", "ios", "1.0", "2026-05-20T01:00:00Z", [
      { symbol: "Foo 0xdeadbeef" },
      { symbol: "Bar 0xdeafc0fe" },
      { symbol: "Baz" },
    ]);
    const b = R("b", "ios", "1.0", "2026-05-20T02:00:00Z", [
      { symbol: "Foo 0x1234abcd" },
      { symbol: "Bar 0x99999999" },
      { symbol: "Baz" },
    ]);
    expect(fingerprintCrash(a)).toBe(fingerprintCrash(b));
  });

  it("iOS-style 'Symbol + 1234' noise stripped", () => {
    const a = R("a", "ios", "1.0", "2026-05-20T01:00:00Z", [{ symbol: "RootView.body + 1234" }, { symbol: "X" }, { symbol: "Y" }]);
    const b = R("b", "ios", "1.0", "2026-05-20T02:00:00Z", [{ symbol: "RootView.body + 9999" }, { symbol: "X" }, { symbol: "Y" }]);
    expect(fingerprintCrash(a)).toBe(fingerprintCrash(b));
  });

  it("different platforms → different fingerprints even with same frames", () => {
    const a = R("a", "ios",     "1.0", "2026-05-20T01:00:00Z", [{ symbol: "X" }, { symbol: "Y" }, { symbol: "Z" }]);
    const b = R("b", "android", "1.0", "2026-05-20T01:00:00Z", [{ symbol: "X" }, { symbol: "Y" }, { symbol: "Z" }]);
    expect(fingerprintCrash(a)).not.toBe(fingerprintCrash(b));
  });

  it("changes in deeper frames (below topN) don't affect fingerprint", () => {
    const a = R("a", "ios", "1.0", "t", [
      { symbol: "X" }, { symbol: "Y" }, { symbol: "Z" }, { symbol: "deep1" },
    ]);
    const b = R("b", "ios", "1.0", "t", [
      { symbol: "X" }, { symbol: "Y" }, { symbol: "Z" }, { symbol: "deep2" },
    ]);
    expect(fingerprintCrash(a)).toBe(fingerprintCrash(b));
  });

  it("groups identical fingerprints + counts occurrences", () => {
    const r = buildCrashGroups([
      R("a", "ios", "1.0", "2026-05-20T01:00:00Z", [{ symbol: "X" }, { symbol: "Y" }, { symbol: "Z" }]),
      R("b", "ios", "1.0", "2026-05-20T02:00:00Z", [{ symbol: "X" }, { symbol: "Y" }, { symbol: "Z" }]),
      R("c", "ios", "1.0", "2026-05-20T03:00:00Z", [{ symbol: "Q" }, { symbol: "Q" }, { symbol: "Q" }]),
    ]);
    expect(r.groups.length).toBe(2);
    expect(r.groups[0].occurrences).toBe(2);
    expect(r.groups[1].occurrences).toBe(1);
  });

  it("aggregates affectedPlatforms + affectedAppVersions + firstSeen/lastSeen", () => {
    const r = buildCrashGroups([
      R("a", "ios",     "1.0", "2026-05-20T05:00:00Z", [{ symbol: "X" }, { symbol: "Y" }, { symbol: "Z" }]),
      R("b", "ios",     "1.1", "2026-05-20T01:00:00Z", [{ symbol: "X" }, { symbol: "Y" }, { symbol: "Z" }]),
    ]);
    expect(r.groups[0].affectedPlatforms).toEqual(["ios"]);
    expect(r.groups[0].affectedAppVersions).toEqual(["1.0", "1.1"]);
    expect(r.groups[0].firstSeen).toBe("2026-05-20T01:00:00Z");
    expect(r.groups[0].lastSeen).toBe("2026-05-20T05:00:00Z");
  });

  it("fingerprint is a 16-char hex prefix", () => {
    const a = R("a", "ios", "1.0", "t", [{ symbol: "X" }, { symbol: "Y" }, { symbol: "Z" }]);
    const fp = fingerprintCrash(a);
    expect(fp).toMatch(/^[a-f0-9]{16}$/);
  });
});
