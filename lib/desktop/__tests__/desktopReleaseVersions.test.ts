import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { desktopVersionAlignmentErrors, desktopReleaseWorkflowErrors } from "../../../scripts/desktop-release-versions.mjs";

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
    const paths = ["scripts/check-desktop-release.mjs", "scripts/desktop-release-versions.mjs", "scripts/demo-download-link.mjs", "desktop/package.json", "desktop/package-lock.json", "desktop/src-tauri/tauri.conf.json", "desktop/src-tauri/Cargo.toml", "desktop/src-tauri/Cargo.lock", ".github/workflows/desktop-release.yml", "lib/desktop/releaseManifest.ts", "desktop/src/components/ConnectionBanner.tsx", "components/Footer.tsx", "app/demo/page.tsx"];
    try {
      for (const relative of paths) { const target = path.join(directory, relative); mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(relative, target); }
      symlinkSync(path.resolve("desktop/node_modules"), path.join(directory, "desktop/node_modules"), "dir");
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


describe("literal manual release workflow contract", () => {
  const workflow = readFileSync(".github/workflows/desktop-release.yml", "utf8");
  it("accepts the actual manual workflow without the obsolete tag-glob marker", () => {
    expect(workflow.includes("desktop-v*")).toBe(false);
    expect(desktopReleaseWorkflowErrors(workflow)).toEqual([]);
  });
  it.each([
    (s: string) => s.replace("  validate-release:", "  unrelated-identity-job:"),
    (s: string) => s.replace("on:\n", "on:\n  push:\n    tags: [desktop-v*]\n"),
    (s: string) => s.replace("on:\n", "on:\n  schedule:\n    - cron: '* * * * *'\n"),
    (s: string) => s + "\non:\n  push:\n",
    (s: string) => s + '\n"on": {push: null}\n',
    (s: string) => s.replace("on:\n", "on: *automatic\n"),
    (s: string) => s.replace("  workflow_dispatch:", "  <<: *automatic\n  workflow_dispatch:"),
    (s: string) => s.replace("on:\n", "# on:\n"),
    (s: string) => s.replace("RELEASE_EVENT: ${{ github.event_name }}", "RELEASE_EVENT: workflow_dispatch"),
    (s: string) => s.replace("RELEASE_REF: ${{ github.ref }}", "RELEASE_REF: refs/tags/fake"),
    (s: string) => s.replace('test "$RELEASE_EVENT" = workflow_dispatch', '# test "$RELEASE_EVENT" = workflow_dispatch'),
    (s: string) => s.replace('test "$RELEASE_REF" = "refs/tags/$REQUESTED_TAG"', '# test "$RELEASE_REF" = "refs/tags/$REQUESTED_TAG"'),
    (s: string) => s.replace('          test "$RELEASE_EVENT"', '          node unreviewed-tool.mjs\n          test "$RELEASE_EVENT"'),
  ])("refuses automatic/ambiguous trigger or missing actual early event/ref binding", mutate => {
    expect(desktopReleaseWorkflowErrors(mutate(workflow))).not.toEqual([]);
  });
});


describe("cold release tooling contract", () => {
  const current = readFileSync(".github/workflows/desktop-release.yml", "utf8");
  const install = "          npm --prefix desktop ci --ignore-scripts";
  const checker = "          node scripts/check-desktop-release.mjs";
  const prepared = current.includes(install) ? current : current.replace(checker, install + "\n" + checker);
  it("accepts locked script-free tooling after authority and before the full checker", () => {
    expect(desktopReleaseWorkflowErrors(prepared)).toEqual([]);
  });
  it.each([
    (s: string) => s.replace(install + "\n", ""),
    (s: string) => s.replace(install, "          npm --prefix desktop install"),
    (s: string) => s.replace(install, "          npm --prefix desktop ci"),
    (s: string) => s.replace(install + "\n" + checker, checker + "\n" + install),
    (s: string) => s.replace(install, install + "\n" + install),
    (s: string) => s.replace(install + "\n", "").replace('          test "$RELEASE_EVENT"', install + '\n          test "$RELEASE_EVENT"'),
  ])("refuses missing, unsafe, duplicated or premature dependency installation", mutate => {
    expect(desktopReleaseWorkflowErrors(mutate(prepared))).not.toEqual([]);
  });
});
