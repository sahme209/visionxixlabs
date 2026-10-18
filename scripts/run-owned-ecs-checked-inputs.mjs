import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runOwnedLocalAuthHttp } from "./run-owned-local-auth-http.mjs";
import { validateLocalAuthHttpTarget, assertNoRuntimeDotenv, assertCommittedApplicationSource } from "./rehearse-local-auth-http.mjs";
import { startOwnedEcsCheckedInputWire, ECS_WIRE } from "./fixtures/ownedEcsCheckedInputWire.mjs";
import diagnostics from "./fixtures/ecsCheckedInputDiagnostics.cjs";
import completionProtocol from "./fixtures/ownedEcsCompletion.cjs";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const opaqueEnvironment = ["PATH", "TMPDIR", "LANG", "LC_ALL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "CODEX_PROXY_CERT"];
export function ownedEcsBaseEnvironment(env) {
  assert.equal(env.AXIOM_RUN_OWNED_ECS_CHECKED_INPUTS, "1", "owned_ecs_explicit_opt_in_required");
  assert.ok(!Object.keys(env).some(key => !opaqueEnvironment.includes(key) && key !== "AXIOM_RUN_OWNED_ECS_CHECKED_INPUTS" && (/^(DATABASE_URL|DIRECT_URL|PG|DOCKER_|NODE_OPTIONS|NODE_TLS_|NODE_USE_ENV_PROXY|NEXTAUTH_|DESKTOP_SESSION_|CREDENTIAL_|STARTER_TOKEN_|POSTGRES_|AWS_|AZURE_|ARM_|GOOGLE_|GCP_|GITHUB_|GH_|STRIPE_|VERCEL_|AXIOM_)/.test(key))), "owned_ecs_inherited_binding_forbidden");
  return Object.fromEntries(opaqueEnvironment.filter(key => typeof env[key] === "string").map(key => [key, env[key]]));
}
export function ownedEcsChildEnvironment(base, { databaseUrl, origin, proof, sourceCommit, privateKey, encryptionKey, desktopKey }) {
  assert.ok(Object.keys(base).every(key => opaqueEnvironment.includes(key)), "owned_ecs_child_base_required");
  const target = validateLocalAuthHttpTarget(databaseUrl), url = new URL(origin);
  assert.ok(url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash);
  assert.match(proof, /^[a-f0-9]{32}$/); assert.match(sourceCommit, /^[a-f0-9]{40}$/);
  assert.ok(privateKey.startsWith("-----BEGIN PRIVATE KEY-----") && encryptionKey.length >= 32 && desktopKey.length >= 32);
  const preload = fileURLToPath(new URL("./fixtures/ownedEcsCheckedInputPreload.cjs", import.meta.url)); assert.ok(!/\s/.test(preload));
  return { ...base, DATABASE_URL: target, DIRECT_URL: target, NODE_ENV: "test", NODE_OPTIONS: `--require=${preload}`, PRISMA_HIDE_UPDATE_MESSAGE: "true", CHECKPOINT_DISABLE: "1",
    AXIOM_OWNED_ECS_CHECKED_INPUTS: "1", AXIOM_OWNED_ECS_ORIGIN: url.origin, AXIOM_OWNED_ECS_PROOF: proof, AXIOM_OWNED_ECS_SOURCE_COMMIT: sourceCommit,
    CREDENTIAL_ENCRYPTION_KEY: encryptionKey, DESKTOP_SESSION_SIGNING_KEY: desktopKey, GITHUB_APP_ID: String(ECS_WIRE.appId), GITHUB_PRIVATE_KEY: privateKey,
    AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_EC2_METADATA_DISABLED: "true", AWS_SCAN_MODE: "live", AWS_CONNECTOR_BROKER_ACCESS_KEY_ID: ECS_WIRE.brokerKey, AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY: ECS_WIRE.secret };
}
/** Fixed synthetic continuation only; no caller module/URL/adapter or shared runner flag. */
export async function runOwnedEcsCheckedInputs(env) {
  const base = ownedEcsBaseEnvironment(env), diagnostic = diagnostics.createDiagnostics("owner", null);
  const phase = (stage, values = {}) => { diagnostic.update({ ...values, stage }); diagnostic.write(); };
  phase("validating_source");
  let sourceCommit, activeCompletion;
  try { assertNoRuntimeDotenv(root); sourceCommit = assertCommittedApplicationSource(root); }
  catch (error) { diagnostic.fail(error); diagnostic.write(); throw error; }
  // Bind once after the existing committed-source check, without serializing any source content.
  diagnostic.bindSource(sourceCommit);
  const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 240_000);
  const interrupt = () => controller.abort(); process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
  try {
    phase("owned_container_startup", { cleanupContainer: "pending" });
    const result = await runOwnedLocalAuthHttp({ ...base, AXIOM_RUN_LOCAL_AUTH_HTTP: "1" }, { signal: controller.signal, rehearse: async databaseUrl => {
      validateLocalAuthHttpTarget(databaseUrl); phase("wire_startup");
      const keys = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
      const proof = randomBytes(16).toString("hex"), wire = await startOwnedEcsCheckedInputWire({ proof, publicKey: keys.publicKey });
      diagnostic.update({ cleanupWire: "pending", cleanupChild: "not_created" }); diagnostic.write();
      const completion = completionProtocol.createCompletionReceiver({ proof, sourceCommit }); activeCompletion = completion;
      let child, exited = false, childClosed, closeCheck, report, lastControlId = 0, pendingControls = 0;
      async function requireChildClose() {
        if (!childClosed) return;
        if (!closeCheck) closeCheck = (async () => { let timer; try { await Promise.race([childClosed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("owned_ecs_child_cleanup_unverified")), 3000); })]); } finally { clearTimeout(timer); } })();
        return closeCheck;
      }
      try {
        // No query/reset against an arbitrary target: parent created this URL/container just above.
        const schemaEnvironment = { ...base, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: "true", CHECKPOINT_DISABLE: "1" };
        const emptyProof = `DO $$ BEGIN IF current_database() <> '${new URL(databaseUrl).pathname.slice(1)}' OR EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public') THEN RAISE EXCEPTION 'owned_ecs_empty_database_required'; END IF; END $$;`;
        phase("database_preflight");
        const preflight = spawnSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), "db", "execute", "--stdin", "--schema", join(root, "prisma/schema.prisma")], { cwd: root, env: schemaEnvironment, input: emptyProof, timeout: 30_000, encoding: "utf8", maxBuffer: 128 * 1024 });
        assert.equal(preflight.status, 0, "owned_ecs_empty_database_preflight_failed");
        phase("schema_bootstrap");
        const bootstrap = spawnSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", join(root, "prisma/schema.prisma")], { cwd: root, env: schemaEnvironment, timeout: 120_000, encoding: "utf8", maxBuffer: 1024 * 1024 });
        assert.equal(bootstrap.status, 0, "owned_ecs_schema_bootstrap_failed"); controller.signal.throwIfAborted();
        const childEnv = ownedEcsChildEnvironment(base, { databaseUrl, origin: wire.origin, proof, sourceCommit, privateKey: keys.privateKey, encryptionKey: randomBytes(32).toString("hex"), desktopKey: randomBytes(32).toString("hex") });
        if (diagnostic.directory) childEnv.AXIOM_OWNED_ECS_DIAGNOSTIC_DIRECTORY = diagnostic.directory;
        phase("child_startup");
        const probe = fileURLToPath(new URL("./fixtures/ecsCheckedInputSourceProbe.cjs", import.meta.url));
        child = spawn(process.execPath, ["--conditions=react-server", probe], { cwd: root, env: childEnv, detached: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
        diagnostic.update({ cleanupChild: "pending" }); diagnostic.write();
        childClosed = new Promise(resolve => child.once("close", () => { exited = true; completion.close(); resolve(); }));
        wire.bindProcess(child.pid); phase("child_running");
        const stop = () => { if (child && !exited) { try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw new Error("owned_ecs_child_cleanup_failed"); } } };
        controller.signal.addEventListener("abort", stop, { once: true });
        const failProtocol = reason => {
          try { completion.fail(reason); }
          catch (error) { phase(completion.stage()); diagnostic.fail(error); diagnostic.write(); controller.abort(); }
        };
        const observe = chunk => { try { completion.observeBytes(chunk.length); } catch { failProtocol("byte_limit"); } };
        child.stdout.on("data", observe); child.stderr.on("data", observe); // Count and discard all raw output; never parse/log it.
        function reply(value) {
          try { if (!child.connected) { failProtocol("disconnected"); return; } child.send(value, error => { if (error) failProtocol("send_failed"); }); }
          catch { failProtocol("send_failed"); }
        }
        child.on("message", async message => {
          try { completion.assertCanReceive(); } catch { failProtocol("terminal_message"); return; }
          if (message?.command === "complete") {
            try {
              completion.accept(message, lastControlId + 1, pendingControls); lastControlId = message.id;
              phase("receipt_wait_close"); reply({ kind: "owned_ecs_completion_ack", proof, sourceCommit, id: message.id, ok: true });
            } catch { failProtocol("protocol"); }
            return;
          }
          if (!message || message.kind !== "owned_ecs_control" || message.proof !== proof || !Number.isSafeInteger(message.id) || message.id !== lastControlId + 1) { failProtocol("protocol"); return; }
          lastControlId = message.id; pendingControls++;
          try { const result = await wire.control(message); reply({ kind: "owned_ecs_control_reply", id: message.id, ok: true, result }); }
          catch { failProtocol("protocol"); }
          finally { pendingControls--; }
        });
        try {
          const status = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code, signal) => { exited = true; completion.exit(code, signal); resolve(code); }); });
          assert.equal(status, 0, "owned_ecs_source_probe_failed"); controller.signal.throwIfAborted();
          phase("receipt_wait_close");
          await requireChildClose();
          controller.signal.throwIfAborted(); phase("receipt_validation"); report = completion.result({ aborted: controller.signal.aborted });
        } finally { controller.signal.removeEventListener("abort", stop); stop(); }
        phase("source_validation");
        assert.equal(assertCommittedApplicationSource(root), sourceCommit, "owned_ecs_source_changed");
        phase("wire_validation");
        const transport = wire.summary(); assert.equal(transport.violation, false); assert.equal(transport.pendingResponses, 0); assert.equal(transport.guardProcesses, 1);
        completion.assertHealthy(); controller.signal.throwIfAborted();
        return { ...report, transport, productionProviderCalls: false, schema: "owned_current_schema_not_migration_acceptance" };
      } catch (error) { diagnostic.fail(error); diagnostic.write(); throw error; }
      finally {
        try { diagnostic.wireSummary(wire.summary()); diagnostic.write(); } catch { /* Observation must not interrupt owned cleanup. */ }
        try {
          if (child && !exited) { try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw new Error("owned_ecs_child_cleanup_unverified"); } }
          await requireChildClose();
          diagnostic.update({ cleanupChild: childClosed ? "verified" : "not_created" }); diagnostic.write();
        } catch (error) { diagnostic.fail(error); diagnostic.update({ cleanupChild: "unverified" }); diagnostic.write(); throw error; }
        finally {
          try { await wire.close(); diagnostic.update({ cleanupWire: "verified" }); diagnostic.write(); }
          catch (error) { diagnostic.fail(error); diagnostic.update({ cleanupWire: "unverified" }); diagnostic.write(); throw error; }
        }
      }
    } });
    activeCompletion.assertHealthy(); controller.signal.throwIfAborted();
    diagnostic.update({ cleanupContainer: result.fixtureCleanup === "owned_disposable_container_removed" ? "verified" : "unobserved", outcome: "completed" }); phase("completed"); return result;
  } catch (error) { diagnostic.fail(error); diagnostic.containerFailure(error); diagnostic.write(); throw error; }
  finally { clearTimeout(deadline); process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await runOwnedEcsCheckedInputs(process.env), null, 2)); }
  catch { console.error("owned_ecs_checked_inputs_failed"); process.exitCode = 1; }
}
