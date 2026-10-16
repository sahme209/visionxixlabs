import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { rehearseLocalAuthHttp } from "./rehearse-local-auth-http.mjs";
import { validateSavedPlanFixtureExecutable } from "./fixtures/savedTerraformPlanFixture.mjs";

const socket = ["--host", "unix:///var/run/docker.sock"];
const image = "postgres:17-alpine";
const ownerLabel = "io.axiom.local-auth-owner";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function isolatedEnvironment(env) {
  const names = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "CODEX_PROXY_CERT"];
  return Object.fromEntries(names.filter(key => typeof env[key] === "string").map(key => [key, env[key]]));
}

/** Creates only a new owned local fixture. Never accepts an existing DB/container.
 * Adapters permit protocol safety tests; CLI always uses the actual Docker socket
 * and existing application HTTP rehearsal, with no external fixture overrides.
 */
export async function runOwnedLocalAuthHttp(env, adapters = {}) {
  assert.equal(env.AXIOM_RUN_LOCAL_AUTH_HTTP, "1", "local_auth_http_opt_in_required");
  assert.ok(!Object.entries(env).some(([key, value]) => value && (
    /^(DATABASE_URL|DIRECT_URL|AUTH_HTTP_TEST_DATABASE_URL|PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|PGSERVICE|PGSERVICEFILE|PGPASSFILE|PGOPTIONS|PGSSLMODE|NEXTAUTH_URL|NEXT_PUBLIC_BASE_URL|RESEND_BASE_URL|POSTGRES_PASSWORD|POSTGRES_DB|POSTGRES_USER|DOCKER_HOST|DOCKER_CONTEXT|DOCKER_TLS_VERIFY|DOCKER_CERT_PATH|NODE_OPTIONS|NEXTAUTH_SECRET|DESKTOP_SESSION_SIGNING_KEY|RESEND_API_KEY|GH_TOKEN|GITHUB_TOKEN)$/.test(key) ||
    /^(STRIPE_|AWS_|AZURE_|GOOGLE_|OPENAI_|ANTHROPIC_|VERCEL_)/.test(key)
  )), "local_auth_http_external_binding_forbidden");
  assert.ok(env.AXIOM_RUN_LOCAL_AZURE_HTTP === undefined || env.AXIOM_RUN_LOCAL_AZURE_HTTP === "1", "local_azure_http_opt_in_invalid");
  if (env.AXIOM_RUN_LOCAL_AZURE_HTTP === "1") assert.ok(env.AXIOM_RUN_LOCAL_AWS_HTTP !== "1" && env.AXIOM_RUN_LOCAL_TERRAFORM_HTTP !== "1", "separate_owned_azure_fixture_required");
  assert.ok(env.AXIOM_RUN_LOCAL_AWS_HTTP === undefined || env.AXIOM_RUN_LOCAL_AWS_HTTP === "1", "local_aws_http_opt_in_invalid");
  assert.ok(env.AXIOM_RUN_LOCAL_AGENT_RECEIPT_HTTP === undefined || env.AXIOM_RUN_LOCAL_AGENT_RECEIPT_HTTP === "1", "local_agent_receipt_http_opt_in_invalid");
  assert.ok(env.AXIOM_RUN_LOCAL_AGENT_READINESS_HTTP === undefined || env.AXIOM_RUN_LOCAL_AGENT_READINESS_HTTP === "1", "local_agent_readiness_http_opt_in_invalid");
  assert.ok(env.AXIOM_RUN_LOCAL_TERRAFORM_HTTP === undefined || env.AXIOM_RUN_LOCAL_TERRAFORM_HTTP === "1", "local_terraform_http_opt_in_invalid");
  if (env.AXIOM_RUN_LOCAL_TERRAFORM_HTTP === "1") validateSavedPlanFixtureExecutable(env.AXIOM_LOCAL_TERRAFORM_EXECUTABLE);
  else assert.ok(env.AXIOM_LOCAL_TERRAFORM_EXECUTABLE === undefined, "terraform_fixture_opt_in_required");
  const suffix = randomBytes(6).toString("hex");
  const owner = randomBytes(16).toString("hex");
  const password = randomBytes(24).toString("hex");
  const database = `axiom_auth_http_${suffix}`;
  const childEnv = { ...isolatedEnvironment(env), POSTGRES_PASSWORD: password };
  const execute = adapters.execute ?? (async args => spawnSync("docker", args, { env: childEnv, encoding: "utf8", timeout: 30_000, maxBuffer: 128 * 1024 }));
  const rehearse = adapters.rehearse ?? rehearseLocalAuthHttp;
  const pause = adapters.sleep ?? sleep;
  const signal = adapters.signal;
  let id;
  let cleanupPromise;
  async function command(args) { return execute([...socket, ...args]); }
  async function cleanup() {
    if (!id) return;
    if (!cleanupPromise) cleanupPromise = (async () => {
      const ownership = await command(["inspect", "--format", `{{index .Config.Labels "${ownerLabel}"}}`, id]);
      assert.ok(ownership.status === 0 && ownership.stdout.trim() === owner, "owned_local_auth_http_cleanup_unverified");
      const removed = await command(["rm", "--force", "--volumes", id]);
      assert.equal(removed.status, 0, "owned_local_auth_http_cleanup_unverified");
    })();
    return cleanupPromise;
  }
  const onAbort = () => { if (id) void cleanup().catch(() => {}); };
  signal?.addEventListener("abort", onAbort, { once: true });
  let report;
  try {
    signal?.throwIfAborted();
    assert.equal((await command(["image", "inspect", image])).status, 0);
    const started = await command(["run", "--detach", "--rm", "--pull=never", "--name", `axiom-auth-http-${suffix}`, "--label", `${ownerLabel}=${owner}`, "--publish", "127.0.0.1::5432", "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_USER=fixture", "--env", `POSTGRES_DB=${database}`, image]);
    assert.ok(started.status === 0 && /^[a-f0-9]{64}$/.test(started.stdout.trim()));
    id = started.stdout.trim();
    signal?.throwIfAborted();
    const binding = await command(["port", id, "5432/tcp"]);
    assert.ok(binding.status === 0 && /^127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(binding.stdout.trim()));
    const port = Number(binding.stdout.trim().split(":")[1]);
    assert.ok(port <= 65535);
    let ready = false;
    const readyDeadline = Date.now() + 30_000;
    for (let attempt = 0; attempt < 60 && Date.now() < readyDeadline; attempt++) {
      signal?.throwIfAborted();
      const probe = await command(["exec", id, "pg_isready", "-h", "127.0.0.1", "-U", "fixture", "-d", database]);
      if (probe.status === 0) { ready = true; break; }
      await pause(500);
    }
    assert.ok(ready);
    const target = `postgresql://fixture:${password}@127.0.0.1:${port}/${database}`;
    const options = { ...(env.AXIOM_RUN_LOCAL_AZURE_HTTP === "1" ? { azureWireFixture: true } : {}), ...(env.AXIOM_RUN_LOCAL_AWS_HTTP === "1" ? { awsWireFixture: true } : {}), ...(env.AXIOM_RUN_LOCAL_AGENT_RECEIPT_HTTP === "1" ? { agentReceiptFixture: true } : {}), ...(env.AXIOM_RUN_LOCAL_AGENT_READINESS_HTTP === "1" ? { agentReadinessFixture: true } : {}), ...(env.AXIOM_RUN_LOCAL_TERRAFORM_HTTP === "1" ? { savedTerraformFixture: true, savedTerraformExecutable: env.AXIOM_LOCAL_TERRAFORM_EXECUTABLE } : {}) };
    report = Object.keys(options).length ? await rehearse(target, options) : await rehearse(target);
    signal?.throwIfAborted();
  } catch {
    throw new Error("owned_local_auth_http_failed");
  } finally {
    try { await cleanup(); } catch { throw new Error("owned_local_auth_http_cleanup_unverified"); }
    signal?.removeEventListener("abort", onAbort);
  }
  return { ...report, fixtureCleanup: "owned_disposable_container_removed" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
  try { console.log(JSON.stringify(await runOwnedLocalAuthHttp(process.env, { signal: controller.signal }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt); }
}
