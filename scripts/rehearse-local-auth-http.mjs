import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { rehearseLocalDesktopPairingHttp } from "./rehearse-local-desktop-pairing-http.mjs";
import { startOwnedAwsWireFixture } from "./fixtures/ownedAwsWireFixture.mjs";
import { localAwsChildEnvironment } from "./fixtures/localAwsChildEnvironment.mjs";
import { rehearseLocalCloudHttp } from "./rehearse-local-cloud-http.mjs";
import { rehearseLocalAgentReceiptHttp } from "./rehearse-local-agent-receipt-http.mjs";
import { rehearseLocalAgentReadinessHttp } from "./rehearse-local-agent-readiness-http.mjs";
import { rehearseLocalApprovalHttp } from "./rehearse-local-approval-http.mjs";
import { rehearseLocalSavedTerraformHttp } from "./rehearse-local-saved-terraform-http.mjs";
import { validateSavedPlanFixtureExecutable } from "./fixtures/savedTerraformPlanFixture.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export function validateLocalAuthHttpTarget(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("isolated_auth_http_target_required"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || !url.port ||
      !/^\/axiom_auth_http_[a-f0-9]{12}$/.test(url.pathname) || url.search || url.hash) throw new Error("isolated_auth_http_target_required");
  return url.toString();
}
export function assertNoRuntimeDotenv(directory) {
  // Checked-in example is not a dotenv runtime input. Everything else fails closed.
  assert.ok(readdirSync(directory).every((name) => !name.startsWith(".env") || name === ".env.example"), "runtime_dotenv_forbidden");
}
/** Bind every versioned source/config dependency to the reported commit. */
export function assertCommittedApplicationSource(directory) {
  const source = spawnSync("git", ["rev-parse", "HEAD"], { cwd: directory, encoding: "utf8" });
  assert.equal(source.status, 0, "source_commit_required");
  const changes = spawnSync("git", ["diff", "--quiet", "HEAD", "--"], { cwd: directory });
  assert.equal(changes.status, 0, "committed_application_source_required");
  const added = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: directory, encoding: "utf8" });
  assert.equal(added.status, 0, "source_inventory_required");
  assert.equal(added.stdout.trim(), "", "untracked_application_source_forbidden");
  return source.stdout.trim();
}

/** Synthetic-only diagnostics: unique private directory, no shared path overwrite. */
export function writePrivateAuthHttpDiagnostics(details, directory = tmpdir()) {
  const privateDirectory = mkdtempSync(join(directory, "axiom-auth-http-private-"));
  const path = join(privateDirectory, "diagnostics.json");
  writeFileSync(path, JSON.stringify(details), { mode: 0o600, flag: "wx" });
  return path;
}

/** @returns {Record<string, string>} */
export function localAuthChildEnvironment(inherited, fixture) {
  const allowed = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "CODEX_PROXY_CERT"];
  const env = Object.fromEntries(allowed.filter((key) => typeof inherited[key] === "string").map((key) => [key, inherited[key]]));
  const databaseUrl = validateLocalAuthHttpTarget(fixture.databaseUrl);
  for (const value of [fixture.appOrigin, fixture.mailOrigin]) {
    const url = new URL(value);
    assert.ok(url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password, "loopback_origin_required");
  }
  return { ...env, DATABASE_URL: databaseUrl, NEXTAUTH_URL: fixture.appOrigin, NEXT_PUBLIC_BASE_URL: fixture.appOrigin,
    NEXTAUTH_SECRET: "isolated-http-fixture-secret-not-production", RESEND_API_KEY: "re_local_http_fixture_only", RESEND_BASE_URL: fixture.mailOrigin,
    RESEND_FROM_EMAIL: "Axiom Fixture <fixture@example.test>", NEXT_TELEMETRY_DISABLED: "1", PRISMA_HIDE_UPDATE_MESSAGE: "true", NODE_ENV: "development" };
}
async function listen(server) {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
async function unusedPort() { const server = createServer(); const origin = await listen(server); await new Promise((resolve) => server.close(resolve)); return new URL(origin).port; }
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Actual app HTTP + real disposable PostgreSQL; local mail capture, not browser/provider acceptance. */
export async function rehearseLocalAuthHttp(value, { awsWireFixture = false, agentReceiptFixture = false, agentReadinessFixture = false, savedTerraformFixture = false, savedTerraformExecutable } = {}) {
  assert.equal(typeof awsWireFixture, "boolean", "explicit_aws_fixture_option_required");
  assert.equal(typeof agentReceiptFixture, "boolean", "explicit_receipt_fixture_option_required");
  assert.equal(typeof agentReadinessFixture, "boolean", "explicit_agent_readiness_fixture_option_required");
  assert.equal(typeof savedTerraformFixture, "boolean", "explicit_saved_terraform_fixture_option_required");
  if (savedTerraformFixture) { validateSavedPlanFixtureExecutable(savedTerraformExecutable); assert.equal(awsWireFixture, false, "separate_owned_terraform_fixture_required"); }
  const databaseUrl = validateLocalAuthHttpTarget(value);
  assertNoRuntimeDotenv(root);
  const sourceCommit = assertCommittedApplicationSource(root);
  assert.ok(!existsSync(join(root, ".next/dev/lock")), "existing_dev_server_forbidden");
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const journeyDeadline = Date.now() + 240_000;
  const mail = [];
  const mailServer = createServer(async (request, response) => {
    try {
      assert.equal(request.method, "POST"); assert.equal(request.url, "/emails");
      assert.equal(request.headers.authorization, "Bearer re_local_http_fixture_only");
      let text = "";
      for await (const chunk of request) { text += chunk; assert.ok(text.length < 32_768); }
      const message = JSON.parse(text);
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      assert.ok(recipients.length === 1 && recipients[0] === "fixture-customer@example.test", "synthetic_mail_only");
      mail.push(message);
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: `fixture-mail-${mail.length}` }));
    } catch { response.writeHead(400).end(); }
  });
  let app;
  let awsWire;
  let appLog = "";
  try {
    const [tables] = await client.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') AND schemaname NOT LIKE 'pg_toast%'");
    assert.equal(tables.count, 0, "empty_disposable_database_required_never_reset");
    const mailOrigin = await listen(mailServer);
    const appPort = await unusedPort();
    const appOrigin = `http://127.0.0.1:${appPort}`;
    const env = localAuthChildEnvironment(process.env, { databaseUrl, appOrigin, mailOrigin });
    const bootstrap = spawnSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", join(root, "prisma/schema.prisma")], { cwd: root, env, encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(bootstrap.status, 0, "current_schema_fixture_bootstrap_failed");
    if (awsWireFixture) awsWire = await startOwnedAwsWireFixture();
    const savedTerraformKey = savedTerraformFixture ? `synthetic-saved-plan-${randomBytes(24).toString("hex")}` : undefined;
    const appEnv = awsWire ? localAwsChildEnvironment(env, { appOrigin, mailOrigin, fixture: awsWire }) : savedTerraformKey ? { ...env, CREDENTIAL_ENCRYPTION_KEY: savedTerraformKey } : env;
    app = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", appPort], { cwd: root, env: appEnv, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of [app.stdout, app.stderr]) stream.on("data", (data) => { appLog = (appLog + data).slice(-100_000); });
    const jar = new Map();
    async function request(path, options = {}) {
      assert.ok(path.startsWith("/") && !path.startsWith("//"), "local_path_required");
      const url = new URL(path, appOrigin); assert.equal(url.origin, appOrigin);
      assert.ok(Date.now() < journeyDeadline, "local_http_journey_deadline");
      const response = await fetch(url, { ...options, headers: { ...options.headers, cookie: [...jar].map(([key, entry]) => `${key}=${entry}`).join("; ") }, redirect: "manual", signal: AbortSignal.timeout(Math.min(90_000, journeyDeadline - Date.now())) });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";", 1)[0]; const at = pair.indexOf("="); jar.set(pair.slice(0, at), pair.slice(at + 1));
      }
      return response;
    }
    let ready = false;
    const deadline = Math.min(journeyDeadline, Date.now() + 150_000);
    while (Date.now() < deadline) {
      assert.equal(app.exitCode, null, "local_app_exited_before_ready");
      try { const response = await request("/api/auth/providers"); if (response.status === 200) { ready = true; break; } } catch {}
      await wait(250);
    }
    assert.ok(ready, "local_http_startup_timeout");
    const jsonPost = (path, body) => request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const pairing = await jsonPost("/api/desktop/pair/start", { deviceFingerprint: "isolated-http-fixture", deviceLabel: "Synthetic HTTP fixture", platform: "unknown", intent: "sign_up" });
    assert.equal(pairing.status, 201, "actual_pairing_start_failed");
    const challenge = (await pairing.json()).challenge;
    const callbackUrl = `/desktop/connect?challenge=${challenge}&intent=sign_up`;
    const signup = await jsonPost("/api/auth/signup", { email: "fixture-customer@example.test", name: "Synthetic Customer", password: "Fixture-only-password-2026!", desktopChallenge: challenge, callbackUrl, acceptedTerms: true });
    assert.equal(signup.status, 200, "actual_signup_failed"); assert.equal((await signup.json()).verificationRequired, true);
    assert.equal(mail.length, 1, "local_verification_email_not_captured");
    let proofUrl = new URL(mail[0].html.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&"));
    assert.equal(proofUrl.origin, appOrigin); assert.equal(proofUrl.pathname, "/api/auth/verify-email");
    assert.equal(proofUrl.searchParams.get("callbackUrl"), callbackUrl);
    async function login(password) {
      const csrf = await (await request("/api/auth/csrf")).json();
      return request("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: "fixture-customer@example.test", password, callbackUrl: appOrigin + callbackUrl, json: "true" }).toString() });
    }
    assert.equal((await login("Fixture-only-password-2026!")).status, 401, "unverified_password_login_must_fail");
    assert.ok(!(await (await request("/api/auth/session")).json()).user, "unverified_account_must_not_have_session");
    await client.emailVerificationToken.updateMany({ where: { usedAt: null }, data: { expiresAt: new Date(Date.now() - 1) } });
    assert.equal((await request(proofUrl.pathname + proofUrl.search)).status, 400, "expired_proof_must_fail");
    const resend = await jsonPost("/api/auth/resend-verification", { email: "fixture-customer@example.test", callbackUrl });
    assert.equal(resend.status, 200); assert.equal(mail.length, 2, "actual_resend_not_captured");
    proofUrl = new URL(mail[1].html.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&"));
    assert.equal(proofUrl.origin, appOrigin); assert.equal(proofUrl.searchParams.get("callbackUrl"), callbackUrl);
    const proof = await request(proofUrl.pathname + proofUrl.search);
    assert.equal(proof.status, 307, "actual_email_verification_failed");
    const destination = new URL(proof.headers.get("location"));
    assert.equal(destination.pathname, "/auth/signin"); assert.equal(destination.searchParams.get("callbackUrl"), callbackUrl);
    assert.equal((await request(proofUrl.pathname + proofUrl.search)).status, 400, "proof_replay_must_fail");
    assert.equal((await login("incorrect-fixture-password")).status, 401, "wrong_password_must_fail");
    assert.equal((await login("Fixture-only-password-2026!")).status, 200, "verified_password_login_failed");
    const session = await (await request("/api/auth/session")).json();
    assert.equal(session.user?.email, "fixture-customer@example.test", "actual_session_identity_missing");
    const user = await client.user.findUnique({ where: { email: "fixture-customer@example.test" } });
    assert.ok(user?.emailVerifiedAt && user.passwordHash && user.passwordHash !== "Fixture-only-password-2026!");
    const memberships = await client.orgMembership.findMany({ where: { userId: user.id } });
    const expectedWorkspace = `ws_${createHash("sha256").update(user.email).digest("hex").slice(0, 16)}`;
    assert.equal(memberships.length, 1); assert.equal(memberships[0].organizationId, expectedWorkspace); assert.equal(memberships[0].role, "owner"); assert.ok(memberships[0].acceptedAt);
    assert.equal(await client.tenantBillingPlan.count(), 0, "identity_flow_must_not_provision_billing");
    let agentReceipt;
    let agentReadiness;
    let savedTerraform;
    const desktopPairing = await rehearseLocalDesktopPairingHttp({ appOrigin, webRequest: request, challenge,
      deviceFingerprint: "isolated-http-fixture", expectedWorkspace, email: user.email,
      ...((awsWire || agentReceiptFixture || agentReadinessFixture || savedTerraformFixture) ? { onPaired: async ({ token, deviceRequest }) => {
        if (savedTerraformFixture) savedTerraform = await rehearseLocalSavedTerraformHttp({ databaseUrl, client, deviceRequest, token, organizationId: expectedWorkspace, userId: user.id, executablePath: savedTerraformExecutable, encryptionSecret: savedTerraformKey });
        if (agentReadinessFixture) agentReadiness = await rehearseLocalAgentReadinessHttp({ databaseUrl, client, deviceRequest, token, organizationId: expectedWorkspace, userId: user.id });
        const cloud = awsWire ? await rehearseLocalCloudHttp({ databaseUrl, client, deviceRequest, token, organizationId: expectedWorkspace, userId: user.id, fixture: awsWire, encryptionSecret: awsWire.encryptionSecret }) : undefined;
        if (agentReceiptFixture) agentReceipt = await rehearseLocalAgentReceiptHttp({ databaseUrl, client, deviceRequest, token, organizationId: expectedWorkspace, userId: user.id });
        return cloud;
      } } : {}) });
    const approvalDecisions = await rehearseLocalApprovalHttp({ databaseUrl, client, request, appOrigin,
      userId: user.id, organizationId: expectedWorkspace });
    assert.equal(assertCommittedApplicationSource(root), sourceCommit, "application_source_changed_during_journey");
    return { sourceCommit, desktopPairing, approvalDecisions, ...(agentReceipt ? { agentReceipt } : {}), ...(agentReadiness ? { agentReadiness } : {}), ...(savedTerraform ? { savedTerraform } : {}), schemaFixture: "current_schema_not_migration_recovery", transport: "real_local_next_http", database: "disposable_synthetic_postgresql", mail: "loopback_capture_not_provider_delivery",
      verified: ["desktop_origin_challenge", "signup_requires_email_proof", "actual_sdk_mail_capture", "unverified_password_denied", "expired_proof_denied", "actual_resend_replacement", "single_use_proof_and_callback", "incorrect_password_denied", "verified_credentials_csrf_cookie_session", "accepted_personal_workspace_only", "no_billing_plan_created"],
      notVerified: ["browser_render_or_interaction", "production_recovery_or_login", "google_github_oauth", "native_pairing_or_vault", "external_mail_delivery", "cloud_execution_or_billing"] };
  } catch (error) {
    // Only a fixed assertion label is public. App logs may contain synthetic
    // secrets and remain private/in-memory rather than entering the report.
    writePrivateAuthHttpDiagnostics({ name: error.name, message: error.message, appLog });
    throw new Error(`local_auth_http_failed:${error instanceof assert.AssertionError ? error.message : "runtime_failure"}`);
  } finally {
    if (app && app.exitCode === null) {
      try { process.kill(-app.pid, "SIGTERM"); } catch { /* owned process already exited */ }
      await Promise.race([new Promise((resolve) => app.once("exit", resolve)), wait(5_000)]);
      if (app.exitCode === null) { try { process.kill(-app.pid, "SIGKILL"); } catch { /* already exited */ } }
    }
    // A wire cleanup failure must never skip independently owned mail/DB cleanup.
    try {
      if (awsWire) await awsWire.close();
    } finally {
      try {
        if (mailServer.listening) await new Promise((resolve) => mailServer.close(resolve));
      } finally { await client.$disconnect(); }
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await rehearseLocalAuthHttp(process.env.AUTH_HTTP_TEST_DATABASE_URL), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
