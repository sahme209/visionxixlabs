import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import vm from "node:vm";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const root = process.cwd();
const require = createRequire(import.meta.url);
const { applyOwnedWebsiteConfig } = require("../../scripts/fixtures/ownedWebsiteConfig.cjs");
const framework = require("../../scripts/fixtures/ownedWebsiteFramework.cjs");
const directories: string[] = [];
const helper = join(root, "scripts/fixtures/ownedWebsiteConfig.cjs");
afterEach(() => { vi.unstubAllEnvs(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true }); });

function fixture() {
  const directory = mkdtempSync("/tmp/axiom-website-");
  if (!existsSync(join(root, ".next"))) mkdirSync(join(root, ".next"), { mode: 0o700 });
  const dist = mkdtempSync(join(root, ".next/visual-"));
  directories.push(dist, directory);
  writeFileSync(join(dist, "tsconfig.json"), JSON.stringify({ extends: join(root, "tsconfig.next.json") }), { mode: 0o600 });
  const configPath = join(directory, "config.json");
  const config = { root, directory, dist, nonce: "a".repeat(32), framework: framework.captureOwnedWebsiteFramework(root), hashes: { [helper]: createHash("sha256").update(readFileSync(helper)).digest("hex") } };
  const persist = () => writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  persist();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AXIOM_WEBSITE_VISUAL_MODE", "owned-website-visual");
  vi.stubEnv("AXIOM_WEBSITE_CONFIG", configPath);
  return { config, configPath, persist, dist, directory };
}

it("preserves the original configuration object in ordinary development and production", () => {
  vi.stubEnv("AXIOM_WEBSITE_VISUAL_MODE", undefined); vi.stubEnv("AXIOM_WEBSITE_CONFIG", undefined);
  const actual = { typescript: { tsconfigPath: "tsconfig.next.json" }, experimental: { cpus: 1 } };
  for (const phase of ["phase-development-server", "phase-production-build", "phase-production-server"]) expect(applyOwnedWebsiteConfig(phase, actual)).toBe(actual);
});

it.each(["phase-production-build", "phase-production-server", "unknown"])("refuses fixture configuration during %s", (phase) => {
  fixture(); expect(() => applyOwnedWebsiteConfig(phase, {})).toThrow("website_config_context");
});

it.each(["production", "test"])("refuses a non-development environment %s", (value) => {
  fixture(); vi.stubEnv("NODE_ENV", value); expect(() => applyOwnedWebsiteConfig("phase-development-server", {})).toThrow("website_config_context");
});

it.each([undefined, "other"])("refuses an absent or unsupported fixture mode", (value) => {
  fixture(); vi.stubEnv("AXIOM_WEBSITE_VISUAL_MODE", value); expect(() => applyOwnedWebsiteConfig("phase-development-server", {})).toThrow("website_config_context");
});

it.each(["root", "directory", "nonce", "dist", "hashes", "framework"] as const)("refuses a contradictory private %s binding", (key) => {
  const state = fixture();
  if (key === "hashes") state.config.hashes[helper] = "0".repeat(64);
  else if (key === "framework") state.config.framework = {};
  else state.config[key] = "/unowned";
  state.persist();
  expect(() => applyOwnedWebsiteConfig("phase-development-server", {})).toThrow();
});

it.each([undefined, "/tmp/unowned/config.json", "/tmp/axiom-website-owned/../other/config.json"])("refuses an absent or unowned config path", (path) => {
  fixture(); vi.stubEnv("AXIOM_WEBSITE_CONFIG", path); expect(() => applyOwnedWebsiteConfig("phase-development-server", {})).toThrow("website_config_private_path");
});

it("refuses configuration and output symlinks without reading their targets", () => {
  const state = fixture();
  const link = join(state.directory, "actual.json");
  writeFileSync(link, readFileSync(state.configPath), { mode: 0o600 });
  rmSync(state.configPath); symlinkSync(link, state.configPath);
  expect(() => applyOwnedWebsiteConfig("phase-development-server", {})).toThrow();
  rmSync(state.configPath); state.persist();
  const target = mkdtempSync(join(root, ".next/visual-")); directories.push(target);
  rmSync(state.dist, { recursive: true }); symlinkSync(target, state.dist);
  expect(() => applyOwnedWebsiteConfig("phase-development-server", {})).toThrow();
});

it("refuses a public-readable config or an altered tsconfig", () => {
  const state = fixture();
  chmodSync(state.configPath, 0o644);
  expect(() => applyOwnedWebsiteConfig("phase-development-server", {})).toThrow("website_config_private_file");
  chmodSync(state.configPath, 0o600);
  writeFileSync(join(state.dist, "tsconfig.json"), JSON.stringify({ extends: "/unowned/tsconfig.json" }));
  expect(() => applyOwnedWebsiteConfig("phase-development-server", {})).toThrow("website_config_tsconfig_content");
});

it("refuses a symlinked tsconfig", () => {
  const state = fixture();
  const file = join(state.dist, "tsconfig.json");
  rmSync(file); symlinkSync(join(root, "tsconfig.next.json"), file);
  expect(() => applyOwnedWebsiteConfig("phase-development-server", {})).toThrow();
});

it("changes only owned paths and disables fixture debug channel while preserving actual configuration", () => {
  const { dist } = fixture();
  const actual = { turbopack: { root }, experimental: { cpus: 1, reactDebugChannel: true }, typescript: { tsconfigPath: "tsconfig.next.json", ignoreBuildErrors: false }, serverExternalPackages: ["provider-sdk"] };
  expect(applyOwnedWebsiteConfig("phase-development-server", actual)).toEqual({ ...actual, experimental: { ...actual.experimental, reactDebugChannel: false }, distDir: dist.slice(root.length + 1), typescript: { ...actual.typescript, tsconfigPath: `${dist.slice(root.length + 1)}/tsconfig.json` } });
  expect(actual.typescript.tsconfigPath).toBe("tsconfig.next.json"); expect(actual.experimental.reactDebugChannel).toBe(true);
});

it("includes the nested dev directory in the existing owned-root byte accounting", () => {
  const { dist } = fixture();
  mkdirSync(join(dist, "dev"), { mode: 0o700 });
  writeFileSync(join(dist, "dev", "fixture-only-output"), "contained local bytes");
  const source = readFileSync(join(root, "scripts/run-owned-website-visual.mjs"), "utf8");
  const start = source.indexOf("function directoryBytes(");
  const end = source.indexOf("async function execute(", start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const count = vm.compileFunction(`${source.slice(start, end)}; return directoryBytes(path);`, ["path", "readdirSync", "join", "statSync"]);
  expect(count(dist, readdirSync, join, statSync)).toBe(statSync(join(dist, "tsconfig.json")).size + statSync(join(dist, "dev", "fixture-only-output")).size);
});

it("loads owned output paths through the real config-file path without customConfig", () => {
  const script = `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const path = require('node:path');
    const crypto = require('node:crypto');
    const root = process.cwd();
    const directory = fs.mkdtempSync('/tmp/axiom-website-');
    if(!fs.existsSync(path.join(root,'.next'))) fs.mkdirSync(path.join(root,'.next'),{mode:0o700});
    const dist = fs.mkdtempSync(path.join(root, '.next/visual-'));
    const configPath = path.join(directory, 'config.json');
    const helper = path.join(root, 'scripts/fixtures/ownedWebsiteConfig.cjs');
    const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    try {
      fs.writeFileSync(path.join(dist, 'tsconfig.json'), JSON.stringify({ extends: path.join(root, 'tsconfig.next.json') }), {mode:0o600});
      const framework = require('./scripts/fixtures/ownedWebsiteFramework.cjs');
      const identity = framework.captureOwnedWebsiteFramework(root);
      fs.writeFileSync(configPath, JSON.stringify({root, directory, dist, nonce:'a'.repeat(32), appPort:38001, proxyPort:38002, cdpPort:38003, assets:[], hashes:fs.existsSync(helper)?{[helper]:digest(helper)}:{}, framework:identity}), {mode:0o600});
      process.env.AXIOM_WEBSITE_VISUAL_MODE='owned-website-visual';
      process.env.AXIOM_WEBSITE_CONFIG=configPath;
      const guard = require('./scripts/fixtures/ownedWebsiteGuard.cjs').installOwnedWebsiteGuard();
      const mode = framework.installOwnedWebsiteFramework({root,role:'website-server',environment:process.env,identity});
      const loadConfig = require('next/dist/server/config').default;
      (async () => {
        try {
          const first = await loadConfig('phase-development-server', root);
          const second = await loadConfig('phase-development-server', root);
          assert.equal(first.distDirRoot,path.relative(root,dist));
          assert.equal(first.distDir,path.join(path.relative(root,dist),'dev'));
          assert.equal(first.typescript.tsconfigPath,path.relative(root,path.join(dist,'tsconfig.json')));
          assert.equal(second.distDir,first.distDir);
          assert.equal(first.experimental.reactDebugChannel,false);
          assert.equal(second.experimental.reactDebugChannel,false);
          delete process.env.AXIOM_WEBSITE_VISUAL_MODE;
          delete process.env.AXIOM_WEBSITE_CONFIG;
          const ordinary = await loadConfig('phase-production-build',root);
          assert.equal(ordinary.distDirRoot,'.next');
          assert.equal(ordinary.distDir,'.next');
          assert.equal(ordinary.typescript.tsconfigPath,'tsconfig.next.json');
          assert.equal(ordinary.experimental.reactDebugChannel,true);
          assert.deepEqual(guard.report(),{transport:0,process:0,worker:0,listener:0,policy:'deny-all-outbound-and-new-processes',productionEquivalent:false});
          mode.report();
          console.log('real_config_file_owned_paths');
        } finally { mode.restore(); fs.rmSync(dist,{recursive:true}); fs.rmSync(directory,{recursive:true}); }
      })().catch(error=>{console.error(String(error));process.exitCode=1});
    } catch(error) {fs.rmSync(dist,{recursive:true});fs.rmSync(directory,{recursive:true});throw error;}
  `;
  expect(execFileSync(process.execPath, ["-e", script], {
    cwd: root, env: { ...process.env, NODE_ENV: "development" }, encoding: "utf8", timeout: 15000,
  })).toContain("real_config_file_owned_paths");
});
