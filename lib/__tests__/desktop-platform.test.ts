import { describe, expect, it } from "vitest";
import { platformFromSystemInfo } from "../../desktop/src/lib/desktopPairing";

describe("desktop platform detection", () => {
  it("distinguishes Apple Silicon from Intel macOS", () => {
    expect(platformFromSystemInfo("macos", "aarch64")).toBe("macos-arm");
    expect(platformFromSystemInfo("macos", "x86_64")).toBe("macos-intel");
  });

  it("maps Windows and Linux independently of architecture", () => {
    expect(platformFromSystemInfo("windows", "x86_64")).toBe("windows");
    expect(platformFromSystemInfo("linux", "aarch64")).toBe("linux");
  });

  it("does not guess unsupported operating systems", () => {
    expect(platformFromSystemInfo("freebsd", "x86_64")).toBe("unknown");
  });
});

