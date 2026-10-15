import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { desktopVersionAlignmentErrors } from "../../../scripts/desktop-release-versions.mjs";

const fixture = () => ({
  desktopPackage: { name: "axiom-desktop", version: "1.2.3" },
  desktopLock: { name: "axiom-desktop", version: "1.2.3", packages: { "": { name: "axiom-desktop", version: "1.2.3" } } },
  tauriConfig: { version: "1.2.3" },
  cargoManifest: '[package]\nname = "axiom-desktop"\nversion = "1.2.3"\n[dependencies]\nother = { version = "9.9.9" }\n',
  cargoLock: 'version = 4\n[[package]]\nname = "other"\nversion = "9.9.9"\n[[package]]\nname = "axiom-desktop"\nversion = "1.2.3"\ndependencies = [\n "other",\n]\n',
});

describe("desktop native release version alignment", () => {
  it("matches only the application's literal identities, not dependency versions", () => {
    expect(desktopVersionAlignmentErrors(fixture())).toEqual([]);
  });
  it.each(["cargoManifest", "cargoLock"] as const)("rejects a stale %s application version", field => {
    const input = fixture(); input[field] = input[field].replace('version = "1.2.3"', 'version = "1.2.2"');
    expect(desktopVersionAlignmentErrors(input)).not.toEqual([]);
  });
  it("does not let a matching dependency hide a stale Cargo package version", () => {
    const input = fixture(); input.cargoManifest = '[package]\nname="axiom-desktop"\nversion="1.2.2"\n[dependencies]\nversion="1.2.3"\n';
    expect(desktopVersionAlignmentErrors(input)).toContain("Cargo.toml [package] version does not match desktop/package.json version 1.2.3");
  });
  it.each(["", '[[package]]\nname="other"\nversion="1.2.3"', fixture().cargoLock + '\n[[package]]\nname="axiom-desktop"\nversion="1.2.3"', '[[package]]\nname="axiom-desktop"\nversion="1.2.3"\nsource="registry+fixture"'])("rejects missing, ambiguous, or nonlocal Cargo lock authority", cargoLock => {
    expect(desktopVersionAlignmentErrors({ ...fixture(), cargoLock })).toContain("Cargo.lock must contain exactly one local axiom-desktop [[package]] identity");
  });
  it.each(['[package]\nname="axiom-desktop"\nversion.workspace=true', '[package]\nname="axiom-desktop"\nversion="1.2.3"\nversion="1.2.3"', '[package]\nname="different"\nversion="1.2.3"'])("fails closed for unsupported or malformed Cargo manifest identity", cargoManifest => {
    expect(desktopVersionAlignmentErrors({ ...fixture(), cargoManifest })).not.toEqual([]);
  });
  it("supports normal literal TOML quoting, comments and CRLF without drifting table scope", () => {
    const input = fixture(); input.cargoManifest = "[package] # root\r\nname = 'axiom-desktop'\r\nversion = '1.2.3' # release\r\n[package.metadata.fixture]\r\nversion = '9.9.9'\r\n";
    expect(desktopVersionAlignmentErrors(input)).toEqual([]);
  });
  it.each(["top", "root"])("rejects stale npm lock %s version", field => {
    const input = fixture(); if (field === "top") input.desktopLock.version = "1.2.2"; else input.desktopLock.packages[""].version = "1.2.2";
    expect(desktopVersionAlignmentErrors(input)).not.toEqual([]);
  });
});

describe("actual release-check command", () => {
  it.each(["desktop/src-tauri/Cargo.toml", "desktop/src-tauri/Cargo.lock", "desktop/package-lock.json"])("refuses a stale source fixture in %s", changedFile => {
    const directory = mkdtempSync(path.join(tmpdir(), "axiom-release-versions-"));
    const paths = ["scripts/check-desktop-release.mjs", "scripts/desktop-release-versions.mjs", "desktop/package.json", "desktop/package-lock.json", "desktop/src-tauri/tauri.conf.json", "desktop/src-tauri/Cargo.toml", "desktop/src-tauri/Cargo.lock", ".github/workflows/desktop-release.yml", "lib/desktop/releaseManifest.ts", "desktop/src/components/ConnectionBanner.tsx", "components/Footer.tsx", "app/demo/page.tsx"];
    try {
      for (const relative of paths) { const target = path.join(directory, relative); mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(relative, target); }
      const baseline = spawnSync(process.execPath, [path.join(directory, "scripts/check-desktop-release.mjs")], { encoding: "utf8", timeout: 10_000 });
      expect(baseline.status).toBe(0);
      const target = path.join(directory, changedFile);
      const current = JSON.parse(readFileSync("desktop/package.json", "utf8")).version;
      const source = readFileSync(target, "utf8");
      const changed = changedFile.endsWith("Cargo.lock")
        ? source.replace(/(\[\[package\]\]\s*\nname = "axiom-desktop"\s*\nversion = ")[^"]+"/, (_match, prefix) => `${prefix}0.0.0"`)
        : source.replace(current, "0.0.0");
      writeFileSync(target, changed);
      const result = spawnSync(process.execPath, [path.join(directory, "scripts/check-desktop-release.mjs")], { encoding: "utf8", timeout: 10_000 });
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain("version does not match desktop/package.json");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
