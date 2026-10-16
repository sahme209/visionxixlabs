import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const TERRAFORM_FIXTURE_BINARY_DIGEST = "7386e89a97d0f24024955acc79ccf693b75b97f7c6383cb9d966e7d59aa5b223";
export function validateSavedPlanFixtureTarget(value) {
  let url; try { url = new URL(value); } catch { throw new Error("owned_saved_plan_database_required"); }
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "127.0.0.1" && url.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(url.pathname) && !url.search && !url.hash, "owned_saved_plan_database_required");
  return url.toString();
}
export function validateSavedPlanFixtureExecutable(path) {
  assert.ok(typeof path === "string" && /^\/tmp\/axiom-terraform-artifact-[A-Za-z0-9_-]+\/bin\/terraform$/.test(path), "owned_saved_plan_executable_required");
  return path;
}
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

/** Compile only this checked-in narrow source graph in an owned rehearsal.
 * No shared Prisma generation/build output or source module mutation. */
export function loadSavedPlanHarness() {
  const require = createRequire(import.meta.url), ts = require("typescript"), prior = require.extensions[".ts"];
  try {
    require.extensions[".ts"] = (module, path) => {
      assert.ok(path.startsWith(`${root}/lib/`), "owned_saved_plan_source_graph_required");
      const source = readFileSync(path, "utf8").replace(/^import ["']server-only["'];?\s*$/gm, "").replace(/(["'])@\//g, (_match, quote) => `${quote}${root}/`);
      module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, path);
    };
    return { ...require(join(root, "lib/terraform/savedPlanArtifact.ts")), ...require(join(root, "lib/terraform/savedPlanArtifactIO.ts")), ...require(join(root, "lib/terraform/savedPlanStore.ts")) };
  } finally { if (prior) require.extensions[".ts"] = prior; else delete require.extensions[".ts"]; }
}

/** Genuine builtin-only saved binary; no real tenant producer/credentials.
 * Parent supplies only a synthetic envelope key shared with its owned app. */
export async function makeSavedTerraformPlanFixture({ executablePath, encryptionSecret, organizationId, requestId, requestVersion = 1 }) {
  validateSavedPlanFixtureExecutable(executablePath);
  assert.equal(digest(readFileSync(executablePath)), TERRAFORM_FIXTURE_BINARY_DIGEST, "pinned_saved_plan_executable_digest_required");
  assert.ok(typeof encryptionSecret === "string" && encryptionSecret.startsWith("synthetic-saved-plan-") && encryptionSecret.length >= 32, "synthetic_artifact_key_required");
  assert.ok(!process.env.CREDENTIAL_ENCRYPTION_KEY && !process.env.STARTER_TOKEN_SECRET, "inherited_artifact_key_forbidden");
  const directory = mkdtempSync(join(tmpdir(), "axiom-saved-plan-fixture-"));
  process.env.CREDENTIAL_ENCRYPTION_KEY = encryptionSecret;
  try {
    const providerMirror = join(directory, "providers"); mkdirSync(providerMirror, { mode: 0o700 });
    const data = join(directory, "data"); mkdirSync(data, { mode: 0o700 });
    const configPath = join(directory, "terraform.tfrc");
    writeFileSync(configPath, `disable_checkpoint = true\nprovider_installation { filesystem_mirror { path = ${JSON.stringify(providerMirror)} } }\n`, { mode: 0o600 });
    // Deliberately omit HOME. Never inherit provider credentials/proxy/settings.
    const env = { PATH: "/usr/bin:/bin", TF_IN_AUTOMATION: "1", TF_INPUT: "0", CHECKPOINT_DISABLE: "1", TF_CLI_CONFIG_FILE: configPath, TF_DATA_DIR: data };
    const hcl = 'terraform { required_version = "= 1.9.8" }\nresource "terraform_data" "fixture" { input = "synthetic-owned-saved-plan" }\n';
    writeFileSync(join(directory, "main.tf"), hcl, { mode: 0o600 });
    const run = args => { const result = spawnSync(executablePath, args, { cwd: directory, env, encoding: "utf8", timeout: 30_000, maxBuffer: 1024 * 1024 }); assert.equal(result.status, 0, `owned_terraform_${args[0]}_failed`); return result.stdout; };
    run(["init", "-backend=false", "-input=false", "-no-color"]);
    run(["validate", "-json"]);
    run(["plan", "-refresh=false", "-input=false", "-lock=false", "-no-color", "-out=fixture.tfplan"]);
    const binary = readFileSync(join(directory, "fixture.tfplan"));
    const harness = loadSavedPlanHarness();
    const createdAt = new Date(Date.now() - 1000), expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const binding = harness.parseSavedPlanBinding({ schema: "axiom.terraform.saved-plan.v1", organizationId, deploymentRequestId: requestId, requestVersion,
      environmentId: "synthetic-local-fixture-no-cloud", targetDigest: digest("synthetic-owned-local-target"), configurationDigest: digest(hcl), providerLockDigest: digest("builtin-only-no-lock-file"), terraformVersion: "1.9.8", executableDigest: TERRAFORM_FIXTURE_BINARY_DIGEST,
      backend: { kind: "local_fixture", workspace: "default", identityDigest: digest("owned-local-fixture-no-remote-state"), stateLineage: null, stateSerial: null }, credential: null, evidenceScope: "owned_local_fixture", createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() });
    const row = await harness.captureSavedPlan({ id: randomUUID(), binding, binary, executablePath });
    const opened = harness.openSavedPlan(row, { organizationId, requestId, requestVersion }, new Date());
    assert.equal(opened.summary.counts.create, 1); assert.equal(opened.summary.rows[0].address, "terraform_data.fixture");
    await assert.rejects(harness.captureSavedPlan({ id: randomUUID(), binding, binary: Buffer.from("invalid-saved-plan"), executablePath }));
    return { row, harness, report: { executableVersion: "1.9.8", binaryDigest: row.binaryDigest, binaryBytes: row.binaryBytes, showDigest: row.showDigest,
      artifact: "genuine_builtin_terraform_data_plan", authority: "synthetic_owned_local_fixture_only", childEnvironment: "no_HOME_no_inherited_provider_credentials_empty_mirror", invalidSavedPlanRejected: true, applyExecuted: false } };
  } finally { delete process.env.CREDENTIAL_ENCRYPTION_KEY; rmSync(directory, { recursive: true, force: true }); }
}
