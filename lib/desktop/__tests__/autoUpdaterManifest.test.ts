/**
 * Vitest unit tests for the pure desktop auto-updater manifest.
 */

import { describe, it, expect } from "vitest";
import { buildUpdateManifest, decideUpdate, type ReleaseArtifact } from "../autoUpdaterManifest";

const sha = (label: string): string => label.padEnd(64, "0");

const A = (os: ReleaseArtifact["os"]): ReleaseArtifact => ({
  os, url: `https://updates.example.com/${os}/1.4.0`, sha256: sha("a"), sizeBytes: 100_000,
});

describe("buildUpdateManifest", () => {
  it("happy path produces a manifest with per-OS slots", () => {
    const r = buildUpdateManifest({
      version: "1.4.0",
      releasedAtIso: "2026-05-20T12:00:00Z",
      releaseNotes: "fix: misc",
      artifacts: [A("macos"), A("windows"), A("linux")],
    });
    expect(r.errors).toEqual([]);
    expect(r.manifest?.artifacts.macos).not.toBeNull();
    expect(r.manifest?.artifacts.windows).not.toBeNull();
    expect(r.manifest?.artifacts.linux).not.toBeNull();
  });

  it("rejects non-semver version", () => {
    const r = buildUpdateManifest({
      version: "not-semver",
      releasedAtIso: "x",
      releaseNotes: "notes",
      artifacts: [A("macos")],
    });
    expect(r.manifest).toBeNull();
    expect(r.errors.join(" ")).toContain("semver");
  });

  it("rejects bad sha256 hex", () => {
    const r = buildUpdateManifest({
      version: "1.0.0",
      releasedAtIso: "x", releaseNotes: "n",
      artifacts: [{ os: "macos", url: "u", sha256: "deadbeef", sizeBytes: 100 }],
    });
    expect(r.manifest).toBeNull();
    expect(r.errors.join(" ")).toContain("64-char");
  });

  it("rejects zero/negative sizeBytes", () => {
    const r = buildUpdateManifest({
      version: "1.0.0",
      releasedAtIso: "x", releaseNotes: "n",
      artifacts: [{ os: "macos", url: "u", sha256: sha("a"), sizeBytes: 0 }],
    });
    expect(r.errors.join(" ")).toContain("sizeBytes");
  });

  it("rejects duplicate OS slot", () => {
    const r = buildUpdateManifest({
      version: "1.0.0", releasedAtIso: "x", releaseNotes: "n",
      artifacts: [A("macos"), A("macos")],
    });
    expect(r.errors.join(" ")).toContain("duplicate");
  });

  it("missing-OS slots null but manifest still emitted", () => {
    const r = buildUpdateManifest({
      version: "1.0.0", releasedAtIso: "x", releaseNotes: "n",
      artifacts: [A("macos")],
    });
    expect(r.manifest?.artifacts.macos).not.toBeNull();
    expect(r.manifest?.artifacts.windows).toBeNull();
    expect(r.manifest?.artifacts.linux).toBeNull();
  });
});

describe("decideUpdate", () => {
  function manifest(version = "1.4.0", minSupported?: string) {
    return buildUpdateManifest({
      version, releasedAtIso: "x", releaseNotes: "n",
      artifacts: [A("macos"), A("windows"), A("linux")],
      minSupportedVersion: minSupported,
    }).manifest!;
  }

  it("installed = manifest → up_to_date", () => {
    const r = decideUpdate({ installedVersion: "1.4.0", manifest: manifest(), os: "macos" });
    expect(r.verdict).toBe("up_to_date");
  });

  it("installed < manifest → update_available + artifact slot", () => {
    const r = decideUpdate({ installedVersion: "1.3.0", manifest: manifest(), os: "windows" });
    expect(r.verdict).toBe("update_available");
    expect(r.artifact?.os).toBe("windows");
  });

  it("installed < minSupportedVersion → must_update", () => {
    const r = decideUpdate({ installedVersion: "1.0.0", manifest: manifest("1.4.0", "1.3.0"), os: "linux" });
    expect(r.verdict).toBe("must_update");
  });

  it("unknown OS → unsupported_os", () => {
    const r = decideUpdate({ installedVersion: "1.0.0", manifest: manifest(), os: "unknown" });
    expect(r.verdict).toBe("unsupported_os");
  });

  it("no artifact for this OS → unsupported_os", () => {
    const m = buildUpdateManifest({
      version: "1.4.0", releasedAtIso: "x", releaseNotes: "n",
      artifacts: [A("macos")],
    }).manifest!;
    const r = decideUpdate({ installedVersion: "1.0.0", manifest: m, os: "linux" });
    expect(r.verdict).toBe("unsupported_os");
  });

  it("newer installed → up_to_date (e.g. dev build)", () => {
    const r = decideUpdate({ installedVersion: "2.0.0", manifest: manifest(), os: "macos" });
    expect(r.verdict).toBe("up_to_date");
  });
});
