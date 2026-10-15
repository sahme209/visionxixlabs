import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { parse } from "yaml";

vi.mock("server-only", () => ({}));

interface Step { uses?: string; name?: string; run?: string; with?: Record<string, unknown> }
interface Job { if?: string; environment?: string; steps: Step[]; outputs?: Record<string, string> }
const workflow = parse(readFileSync(join(process.cwd(), ".github/workflows/desktop-release.yml"), "utf8")) as { permissions: Record<string, string>; on: { workflow_dispatch: { inputs: { publish: { default: boolean } } } }; jobs: Record<string, Job> };
function step(job: string, name: string): Step { const found = workflow.jobs[job].steps.find(item => item.name === name); if (!found?.run) throw Error(`Missing actual workflow step: ${name}`); return found; }
function nodeBlock(job: string, name: string) { const match = step(job, name).run!.match(/node <<'NODE'\n([\s\S]*?)\nNODE/); if (!match) throw Error("Node boundary missing"); return match[1]; }
const temporary: string[] = [];
function directory() { const value = mkdtempSync(join(tmpdir(), "axiom-native-release-")); temporary.push(value); return value; }
function put(root: string, name: string, content: string | Buffer) { const file = join(root, name); mkdirSync(join(file, ".."), { recursive: true }); writeFileSync(file, content); }
function json(root: string, name: string, value: unknown) { put(root, name, JSON.stringify(value)); }
function hash(bytes: string | Buffer) { return createHash("sha256").update(bytes).digest("hex"); }
const expected = { SOURCE_SHA: "a".repeat(40), RELEASE_TAG: "desktop-v0.1.21", VERSION: "0.1.21", CANDIDATE_RUN_ID: "12345" };
function nodeRun(code: string, cwd: string, env: Record<string, string | undefined> = {}) { return spawnSync(process.execPath, ["-e", code], { cwd, env: { ...process.env, ...expected, ...env }, encoding: "utf8", timeout: 15_000 }); }
function shellRun(code: string, cwd: string, env: Record<string, string | undefined> = {}) { return spawnSync("bash", ["-euo", "pipefail", "-c", code], { cwd, env: { ...process.env, ...expected, RUNNER_TEMP: join(cwd, "runner"), ...env }, encoding: "utf8", timeout: 20_000 }); }
const platforms = { "macos-arm": "aarch64-apple-darwin", "macos-intel": "x86_64-apple-darwin", "windows-x64": "x86_64-pc-windows-msvc", "linux-x64": "x86_64-unknown-linux-gnu", sbom: "source" };
function rawCandidate() {
  const cwd = directory(); mkdirSync(join(cwd, "runner"));
  for (const [platform, target] of Object.entries(platforms)) {
    const fileName = platform === "sbom" ? "axiom-agent.sbom.cdx.json" : `Axiom_${expected.VERSION}_${platform}.${platform.startsWith("macos") ? "dmg" : platform === "windows-x64" ? "msi" : "AppImage"}`;
    const bytes = platform === "sbom" ? JSON.stringify({ bomFormat: "CycloneDX", components: [] }) : `synthetic installer ${platform}`;
    put(cwd, `artifacts/${platform}/${fileName}`, bytes);
    json(cwd, `artifacts/${platform}/candidate-${platform}.json`, { schema: 1, sourceSha: expected.SOURCE_SHA, releaseTag: expected.RELEASE_TAG, version: expected.VERSION, runId: expected.CANDIDATE_RUN_ID, platform, target, assets: [{ fileName, sizeBytes: Buffer.byteLength(bytes), sha256: hash(bytes) }] });
    if (platform !== "sbom") put(cwd, `artifacts/${platform}/release-attestation-${platform}.env`, `platform=${platform}\nartifact_signed=false\nartifact_notarized=false\n`);
  }
  json(cwd, "candidate-artifacts.json", { total_count: 6, artifacts: ["axiom-macos-arm", "axiom-macos-intel", "axiom-windows-x64", "axiom-linux-x64", "axiom-sbom", "axiom-sbom-provenance"].map((name, i) => ({ id: i + 1, name, expired: false, digest: `sha256:${"b".repeat(64)}`, workflow_run: { id: Number(expected.CANDIDATE_RUN_ID), head_sha: expected.SOURCE_SHA } })) });
  return cwd;
}
function flatten(cwd: string) { return nodeRun(nodeBlock("verify-candidate", "Validate and flatten candidate artifacts"), cwd); }
function validCandidate() { const cwd = rawCandidate(); const result = flatten(cwd); expect(result.stderr).toBe(""); expect(result.status).toBe(0); return cwd; }
function mutate(root: string, file: string, update: (value: Record<string, unknown>) => void) { const data = JSON.parse(readFileSync(join(root, file), "utf8")); update(data); json(root, file, data); }
afterEach(() => { vi.unstubAllGlobals(); for (const cwd of temporary.splice(0)) rmSync(cwd, { recursive: true, force: true }); });

// This command is a local fake. It never contacts GitHub; it records the actual
// workflow shell's API operations and emulates public draft asset digests.
function fakeGitHub(cwd: string) {
  const bin = join(cwd, "bin"); mkdirSync(bin);
  writeFileSync(join(bin, "gh"), `#!${process.execPath}\n` + String.raw`
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const args = process.argv.slice(2), env = process.env;
const endpoint = args.find(value => value.startsWith('repos/') || value.startsWith('https://uploads.github.com/')) || '';
const method = args[args.indexOf('--method') + 1] || 'GET';
const stateFile = path.join(process.cwd(), 'mock-github.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : { calls: [], assets: [] };
state.calls.push({ method, endpoint });
function save() { fs.writeFileSync(stateFile, JSON.stringify(state)); }
function reply(value, status = 200) {
  if (status === 'network') { save(); process.exit(1); }
  if (args.includes('--include')) process.stdout.write('HTTP/2.0 ' + status + ' synthetic\n\n');
  if (value !== undefined) process.stdout.write(typeof value === 'string' ? value : JSON.stringify(value));
  save(); process.exit(Number(status) >= 400 ? 1 : 0);
}
if (endpoint.endsWith('/contents/axiom-public-key.asc')) reply(fs.readFileSync(env.MOCK_PUBLIC_KEY_FILE).toString('base64'));
if (method === 'POST' && endpoint.endsWith('/git/refs')) reply({ ref: 'created' }, env.MOCK_TAG_COLLISION ? 422 : 201);
if (method === 'POST' && endpoint.endsWith('/releases')) reply('31', env.MOCK_RELEASE_FAILURE ? 500 : 201);
if (method === 'POST' && endpoint.startsWith('https://uploads.github.com/')) {
  const file = args[args.indexOf('--input') + 1], bytes = fs.readFileSync(file), name = new URL(endpoint).searchParams.get('name');
  state.assets.push({ name, size: bytes.length, digest: env.MOCK_BAD_DIGEST === 'missing' ? null : 'sha256:' + (env.MOCK_BAD_DIGEST ? '0'.repeat(64) : crypto.createHash('sha256').update(bytes).digest('hex')) });
  reply({ id: state.assets.length }, 201);
}
if (method === 'PATCH') { state.published = true; reply({ id: 31 }); }
if (endpoint.endsWith('/releases/31')) reply({ id: 31, tag_name: env.RELEASE_TAG, draft: true, assets: state.assets });
if (endpoint.includes('/commits/')) reply('c'.repeat(40));
if (endpoint.includes('/releases/tags/')) reply(undefined, env.MOCK_RELEASE_STATUS || '404');
if (endpoint.includes('/git/ref/tags/')) reply(undefined, env.MOCK_TAG_STATUS || '404');
if (endpoint === 'repos/sahme209/axiom-releases') reply(args.includes('--jq') ? 'main' : { default_branch: 'main' }, env.MOCK_REPO_STATUS || '200');
reply(undefined, 500);
`, { mode: 0o755 });
  return { PATH: `${bin}:${process.env.PATH}` };
}

describe("actual native workflow publication eligibility", () => {
  it("prevents candidate actions from using implicit release upload permissions", () => {
    expect(workflow.permissions.contents).toBe("read");
    const sbomSteps = workflow.jobs.sbom.steps.filter(item => item.uses?.startsWith("anchore/sbom-action@"));
    expect(sbomSteps).toHaveLength(1);
    expect(sbomSteps[0].with?.["upload-release-assets"]).toBe(false);
    const tauriSteps = workflow.jobs.build.steps.filter(item => item.uses?.startsWith("tauri-apps/tauri-action@"));
    expect(tauriSteps).toHaveLength(1);
    for (const key of ["releaseId", "tagName", "releaseName", "releaseBody"]) expect(tauriSteps[0].with?.[key]).toBeUndefined();
  });
  it("defaults dispatches to candidate-only and does not publish tag pushes", () => {
    expect(workflow.on.workflow_dispatch.inputs.publish.default).toBe(false);
    const expression = workflow.jobs.publish.if!;
    for (const [event, publish, ready, allowed] of [["push", true, "true", false], ["workflow_dispatch", undefined, "true", false], ["workflow_dispatch", true, undefined, false], ["workflow_dispatch", true, "false", false], ["workflow_dispatch", true, "true", true]]) {
      expect(runInNewContext(expression, { github: { event_name: event }, inputs: { publish }, vars: { AXIOM_DESKTOP_PUBLICATION_READY: ready } })).toBe(allowed);
    }
    expect(workflow.jobs.publish.environment).toBe("desktop-release"); // actual reviewer configuration remains unverified
    expect(workflow.jobs.publish.steps.find(item => item.with?.["artifact-ids"] !== undefined)?.with?.["artifact-ids"]).toBe("${{ needs.verify-candidate.outputs.artifact_id }}");
  });
});

describe("actual candidate artifact verification boundary", () => {
  it("does not promote build-app notarization into downloadable artifact approval", () => {
    const cwd = rawCandidate();
    put(cwd, "artifacts/macos-arm/release-attestation-macos-arm.env", "platform=macos-arm\nartifact_signed=true\nartifact_notarized=true\n");
    expect(flatten(cwd).status).not.toBe(0);
    expect(step("publish", "Create new public release without replacing existing assets").run).toContain("macos-artifact-notarized: false");
  });
  it("binds all targets and raw artifact IDs to unchanged source/run/installer/SBOM bytes", () => {
    const cwd = validCandidate(); const manifest = JSON.parse(readFileSync(join(cwd, `flat/Axiom-Agent-${expected.RELEASE_TAG}-candidate-manifest.json`), "utf8"));
    expect(manifest.sourceSha).toBe(expected.SOURCE_SHA); expect(manifest.rawArtifacts).toHaveLength(6); expect(manifest.assets).toHaveLength(5);
    expect(new Set(manifest.assets.map((asset: { platform: string }) => asset.platform))).toEqual(new Set(Object.keys(platforms)));
  });
  it.each(["sourceSha", "runId", "target"])("rejects mismatched platform provenance %s", field => {
    const cwd = rawCandidate(); mutate(cwd, "artifacts/macos-arm/candidate-macos-arm.json", value => { value[field] = "wrong"; }); expect(flatten(cwd).status).not.toBe(0);
  });
  it.each(["Axiom_0.1.21#label.dmg", "Axiom_0.1.21\n.dmg", "Axiom_0.1.21\\evil.dmg"])("rejects unsafe asset names %j before flattening or upload", fileName => {
    const cwd = rawCandidate(); mutate(cwd, "artifacts/macos-arm/candidate-macos-arm.json", value => { (value.assets as Array<{ fileName: string }>)[0].fileName = fileName; });
    const result = flatten(cwd); expect(result.status).not.toBe(0); expect(result.stderr).toContain("Unsafe or duplicate candidate asset");
  });
  it("rejects a provenance filename bound to a different platform", () => {
    const cwd = rawCandidate(); mutate(cwd, "artifacts/macos-arm/candidate-macos-arm.json", value => { value.platform = "macos-intel"; value.target = platforms["macos-intel"]; }); expect(flatten(cwd).status).not.toBe(0);
  });
  it("rejects a different artifact graph source even with matching copied manifests", () => {
    const cwd = rawCandidate(); mutate(cwd, "candidate-artifacts.json", value => { (value.artifacts as Array<{ workflow_run: { head_sha: string } }>)[0].workflow_run.head_sha = "d".repeat(40); }); expect(flatten(cwd).status).not.toBe(0);
  });
  it("rejects missing platform and unexpected installer files", () => {
    let cwd = rawCandidate(); rmSync(join(cwd, "artifacts/linux-x64/candidate-linux-x64.json")); expect(flatten(cwd).status).not.toBe(0);
    cwd = rawCandidate(); put(cwd, "artifacts/windows-x64/unmanifested.exe", "extra"); expect(flatten(cwd).status).not.toBe(0);
  });
  it("rejects changed payload bytes", () => {
    const cwd = rawCandidate(); put(cwd, `artifacts/macos-arm/Axiom_${expected.VERSION}_macos-arm.dmg`, "modified"); expect(flatten(cwd).status).not.toBe(0);
  });
  it.each(["artifact_signed=false", "artifact_signed=true"])("rejects conflicting or duplicated signing lines: %s", line => {
    const cwd = rawCandidate(); const name = "artifacts/macos-arm/release-attestation-macos-arm.env"; put(cwd, name, readFileSync(join(cwd, name), "utf8") + line + "\n"); expect(flatten(cwd).status).not.toBe(0);
  });
  it("rejects flattening collisions rather than silently copying over a platform asset", () => {
    const cwd = rawCandidate(); const name = `Axiom_${expected.VERSION}_macos-arm.dmg`;
    put(cwd, `artifacts/macos-intel/${name}`, "collision"); expect(flatten(cwd).status).not.toBe(0);
  });
  it("rejects changed verified-candidate bytes immediately before signing", () => {
    const cwd = validCandidate(); put(cwd, `flat/Axiom_${expected.VERSION}_macos-arm.dmg`, "changed after review");
    expect(nodeRun(nodeBlock("publish", "Validate candidate again before signing or upload"), cwd).status).not.toBe(0);
  });
  it("checks the actual checkout rather than trusting a SHA environment annotation", () => {
    const cwd = directory(); mkdirSync(join(cwd, "runner"));
    expect(spawnSync("git", ["init", "--quiet"], { cwd }).status).toBe(0);
    put(cwd, "desktop/src-tauri/Cargo.lock", "reviewed lock");
    expect(spawnSync("git", ["add", "desktop/src-tauri/Cargo.lock"], { cwd }).status).toBe(0);
    expect(spawnSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "synthetic source"], { cwd }).status).toBe(0);
    const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).stdout.trim();
    put(cwd, `desktop/src-tauri/target/${platforms["linux-x64"]}/release/bundle/appimage/Axiom_${expected.VERSION}.AppImage`, "synthetic");
    const block = nodeBlock("build", "Record platform candidate provenance");
    expect(nodeRun(block, cwd, { PLATFORM: "linux-x64", TARGET: platforms["linux-x64"] }).status).not.toBe(0);
    expect(nodeRun(block, cwd, { SOURCE_SHA: sha, PLATFORM: "linux-x64", TARGET: platforms["linux-x64"] }).status).toBe(0);
    put(cwd, "desktop/src-tauri/Cargo.lock", "unreviewed dependency change");
    expect(nodeRun(block, cwd, { SOURCE_SHA: sha, PLATFORM: "linux-x64", TARGET: platforms["linux-x64"] }).status).not.toBe(0);
  });
});

describe("website consumer of actual publication notes", () => {
  it("keeps build-only notarization evidence out of downloadable artifact trust", async () => {
    vi.resetModules();
    const notes = step("publish", "Create new public release without replacing existing assets").run!;
    const body = notes.match(/cat > release-notes.md <<NOTES\n([\s\S]*?)\nNOTES/)![1];
    const names = ["Axiom.Agent_0.1.21_aarch64.dmg", "Axiom.Agent_0.1.21_x64.dmg"];
    const release = { tag_name: expected.RELEASE_TAG, html_url: "https://example.invalid/release", published_at: "2026-10-15T00:00:00Z", prerelease: false, draft: false, body, assets: names.map(name => ({ name, browser_download_url: `https://example.invalid/${name}`, size: 20, digest: "sha256:abc123" })) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([release]), { status: 200 })));
    const { getDesktopReleaseManifest } = await import("../releaseManifest");
    const manifest = await getDesktopReleaseManifest();
    expect(manifest.assets["macos-arm"]?.notarized).toBe(false);
    expect(manifest.assets["macos-arm"]?.installFriction).not.toContain("Signed + notarized");
    expect(manifest.allSignedAndNotarized).toBe(false);
  });
});

describe("actual public identity absence shell", () => {
  it("accepts only real 404 absence after a successful repository lookup", () => {
    const cwd = rawCandidate(); const env = fakeGitHub(cwd);
    expect(shellRun(step("publish", "Reject existing or unknown public release identity").run!, cwd, env).status).toBe(0);
  });
  it.each([{ MOCK_REPO_STATUS: "404" }, { MOCK_RELEASE_STATUS: "200" }, { MOCK_TAG_STATUS: "200" }, { MOCK_RELEASE_STATUS: "403" }, { MOCK_TAG_STATUS: "500" }, { MOCK_RELEASE_STATUS: "network" }])("refuses existing/unknown public state %j", scenario => {
    const cwd = rawCandidate(); const env = fakeGitHub(cwd);
    expect(shellRun(step("publish", "Reject existing or unknown public release identity").run!, cwd, { ...env, ...scenario }).status).not.toBe(0);
    const calls = JSON.parse(readFileSync(join(cwd, "mock-github.json"), "utf8")).calls;
    expect(calls.every((call: { method: string }) => call.method === "GET")).toBe(true);
  });
});

let keyDirectory: string; let publicKey: Buffer; let privateKey: string; let fingerprint: string;
beforeAll(() => {
  // Synthetic test-only keys in an explicit temporary homedir, never personal
  // or configured release credentials. No provider/network request occurs.
  keyDirectory = mkdtempSync(join(tmpdir(), "axiom-synthetic-release-key-"));
  const generated = spawnSync("gpg", ["--homedir", keyDirectory, "--batch", "--pinentry-mode", "loopback", "--passphrase", "", "--quick-generate-key", "Axiom isolated release test <fixture@example.invalid>", "ed25519", "sign", "0"], { encoding: "utf8", timeout: 20_000 });
  expect(generated.status).toBe(0);
  const listed = spawnSync("gpg", ["--homedir", keyDirectory, "--batch", "--with-colons", "--fingerprint"], { encoding: "utf8" });
  fingerprint = listed.stdout.split("\n").find(line => line.startsWith("fpr:"))!.split(":")[9];
  publicKey = spawnSync("gpg", ["--homedir", keyDirectory, "--armor", "--export", fingerprint]).stdout;
  privateKey = spawnSync("gpg", ["--homedir", keyDirectory, "--armor", "--export-secret-keys", fingerprint], { encoding: "utf8" }).stdout;
});
afterAll(() => { rmSync(keyDirectory, { recursive: true, force: true }); });
function signCandidate(cwd: string, override: Record<string, string> = {}) {
  put(cwd, "published-public-key.asc", publicKey); mkdirSync(join(cwd, "test-signing-home"), { mode: 0o700 });
  return shellRun(step("publish", "Import GPG key and verify detached signatures").run!, cwd, { ...fakeGitHub(cwd), GNUPGHOME: join(cwd, "test-signing-home"), MOCK_PUBLIC_KEY_FILE: join(cwd, "published-public-key.asc"), GPG_PRIVATE_KEY: privateKey, EXPECTED_GPG_FINGERPRINT: fingerprint, ...override });
}
describe("actual intended-public-key verification and immutable publication shell", () => {
  it("signs unchanged candidate bytes and verifies with the published intended public key", () => {
    const cwd = validCandidate(); const result = signCandidate(cwd); expect(result.stderr).toBe(""); expect(result.status).toBe(0);
    expect(readdirSync(join(cwd, "flat")).filter(name => name.endsWith(".asc"))).toHaveLength(6);
  });
  it("refuses a different configured public fingerprint before creating signatures", () => {
    const cwd = validCandidate(); expect(signCandidate(cwd, { EXPECTED_GPG_FINGERPRINT: "0".repeat(40) }).status).not.toBe(0);
    expect(readdirSync(join(cwd, "flat")).some(name => name.endsWith(".asc"))).toBe(false);
  });
  it("publishes only the exact newly-created ID after remote asset digest verification", () => {
    const cwd = validCandidate(); expect(signCandidate(cwd).status).toBe(0);
    const result = shellRun(step("publish", "Create new public release without replacing existing assets").run!, cwd, { PATH: `${join(cwd, "bin")}:${process.env.PATH}` });
    expect(result.stderr).toBe(""); expect(result.status).toBe(0);
    const state = JSON.parse(readFileSync(join(cwd, "mock-github.json"), "utf8"));
    expect(state.published).toBe(true);
    expect(state.calls.filter((call: { method: string }) => call.method === "PATCH")).toEqual([{ method: "PATCH", endpoint: "repos/sahme209/axiom-releases/releases/31" }]);
    expect(JSON.parse(readFileSync(join(cwd, "runner/publication-verification.json"), "utf8")).sourceSha).toBe(expected.SOURCE_SHA);
  });
  it.each([{ MOCK_BAD_DIGEST: "wrong" }, { MOCK_BAD_DIGEST: "missing" }, { MOCK_TAG_COLLISION: "true" }, { MOCK_RELEASE_FAILURE: "true" }])("leaves partial outcomes unpublished on bad digests or exclusive-create failure %j", scenario => {
    const cwd = validCandidate(); expect(signCandidate(cwd).status).toBe(0);
    const result = shellRun(step("publish", "Create new public release without replacing existing assets").run!, cwd, { PATH: `${join(cwd, "bin")}:${process.env.PATH}`, ...scenario });
    expect(result.status).not.toBe(0);
    const state = JSON.parse(readFileSync(join(cwd, "mock-github.json"), "utf8"));
    expect(state.published).not.toBe(true); expect(state.calls.some((call: { method: string }) => call.method === "PATCH")).toBe(false);
  });
});
