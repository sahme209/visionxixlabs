/**
 * Vitest unit tests for the pure desktop platform detector + caps.
 */

import { describe, it, expect } from "vitest";
import { capabilitiesOf, detectAndDescribe, detectDesktopOs } from "../platformCapabilities";

describe("detectDesktopOs", () => {
  it("uses nodePlatform when supplied (darwin → macos)", () => {
    expect(detectDesktopOs({ nodePlatform: "darwin" })).toBe("macos");
    expect(detectDesktopOs({ nodePlatform: "win32" })).toBe("windows");
    expect(detectDesktopOs({ nodePlatform: "linux" })).toBe("linux");
  });

  it("falls back to user-agent when nodePlatform absent", () => {
    expect(detectDesktopOs({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0)" })).toBe("macos");
    expect(detectDesktopOs({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })).toBe("windows");
    expect(detectDesktopOs({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)" })).toBe("linux");
  });

  it("unknown when neither matches", () => {
    expect(detectDesktopOs({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0)" })).toBe("unknown");
    expect(detectDesktopOs({})).toBe("unknown");
  });
});

describe("capabilitiesOf", () => {
  it("macOS requires signed updates + has tray + dmg packaging", () => {
    const c = capabilitiesOf("macos");
    expect(c.requiresSignedUpdates).toBe(true);
    expect(c.hasTrayIcon).toBe(true);
    expect(c.packageExt).toBe("dmg");
  });

  it("Linux: AppImage + no signed-update requirement", () => {
    const c = capabilitiesOf("linux");
    expect(c.packageExt).toBe("AppImage");
    expect(c.requiresSignedUpdates).toBe(false);
  });

  it("Windows: exe packaging + signed updates", () => {
    const c = capabilitiesOf("windows");
    expect(c.packageExt).toBe("exe");
    expect(c.requiresSignedUpdates).toBe(true);
  });

  it("unknown: every capability defaults to safe-disabled", () => {
    const c = capabilitiesOf("unknown");
    expect(c.hasNativeKeychain).toBe(false);
    expect(c.hasOsNotifications).toBe(false);
    expect(c.hasTrayIcon).toBe(false);
    expect(c.supportsCustomScheme).toBe(false);
  });
});

describe("detectAndDescribe", () => {
  it("returns os + capability fields in one call", () => {
    const c = detectAndDescribe({ nodePlatform: "darwin" });
    expect(c.os).toBe("macos");
    expect(c.packageExt).toBe("dmg");
  });
});
