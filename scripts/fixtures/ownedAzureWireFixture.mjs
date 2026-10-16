import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

/** Owned Azure protocol fixture. Synthetic IDs/secret only; no provider SDK replacement. */
export async function startOwnedAzureWireFixture() {
  const proof = randomBytes(16).toString("hex");
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const subscriptionId = "22222222-2222-4222-8222-222222222222";
  const clientId = "33333333-3333-4333-8333-333333333333";
  const clientSecret = "owned-azure-fixture-never-valid-secret";
  const token = "owned-azure-fixture-never-valid-token";
  const requests = [], ready = new Set(), sequences = new Map();
  let violation = false, mode = "success", releaseHeld;
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.headers["x-axiom-fixture-guard"], proof);
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; assert.ok(size <= 16384); chunks.push(chunk); }
      const body = Buffer.concat(chunks).toString();
      if (request.url === "/__fixture_guard_ready") {
        const value = JSON.parse(body); assert.equal(value.kind, "azure_builtin_guard_ready"); assert.ok(Number.isInteger(value.pid)); ready.add(String(value.pid)); response.end("ok"); return;
      }
      const pid = request.headers["x-axiom-fixture-process"];
      const seq = Number(request.headers["x-axiom-fixture-sequence"]);
      assert.ok(ready.has(pid)); assert.equal(seq, (sequences.get(pid) ?? 0) + 1); sequences.set(pid, seq);
      const host = request.headers["x-axiom-original-host"];
      assert.ok(["login.microsoftonline.com", "management.azure.com"].includes(host));
      const url = new URL(request.url, `https://${host}`);
      const operation = host === "login.microsoftonline.com" ? request.method === "POST" ? "Token" : "Metadata" : url.pathname.endsWith("resourcegroups") ? "ResourceGroupsFirstPage" : "Subscription";
      requests.push(operation);
      response.setHeader("content-type", "application/json");
      if (operation === "Metadata") {
        assert.equal(request.method, "GET"); assert.equal(url.pathname, `/${tenantId}/v2.0/.well-known/openid-configuration`);
        response.end(JSON.stringify({ issuer: `https://${host}/${tenantId}/v2.0`, authorization_endpoint: `https://${host}/${tenantId}/oauth2/v2.0/authorize`, token_endpoint: `https://${host}/${tenantId}/oauth2/v2.0/token`, jwks_uri: `https://${host}/${tenantId}/discovery/v2.0/keys` })); return;
      }
      if (operation === "Token") {
        assert.equal(request.method, "POST"); assert.equal(url.pathname, `/${tenantId}/oauth2/v2.0/token`);
        const form = new URLSearchParams(body); assert.equal(form.get("client_id"), clientId); assert.equal(form.get("client_secret"), clientSecret); assert.equal(form.get("grant_type"), "client_credentials"); assert.equal(form.get("scope"), "https://management.azure.com/.default");
        response.end(JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 3600 })); return;
      }
      assert.equal(request.method, "GET"); assert.equal(request.headers.authorization, `Bearer ${token}`);
      const expectedPath = `/subscriptions/${subscriptionId}${operation === "ResourceGroupsFirstPage" ? "/resourcegroups" : ""}`;
      assert.equal(url.pathname, expectedPath);
      if (mode === "held") await new Promise(resolve => { releaseHeld = resolve; });
      if (mode === "denied") { response.writeHead(403).end(JSON.stringify({ error: { code: "AuthorizationFailed", message: "synthetic-denied" } })); return; }
      if (mode === "redirect") { response.writeHead(302, { location: "https://attacker.invalid/forbidden" }).end("{}"); return; }
      if (mode === "oversize") { response.writeHead(200).end("x".repeat(131073)); return; }
      if (mode === "compressed") { response.writeHead(200, { "content-encoding": "gzip" }).end("{}"); return; }
      if (operation === "Subscription") {
        assert.equal(url.searchParams.get("api-version"), "2022-12-01");
        response.end(JSON.stringify({ id: `/subscriptions/${subscriptionId}`, subscriptionId: mode === "wrong_identity" ? clientId : subscriptionId, tenantId })); return;
      }
      assert.equal(url.searchParams.get("api-version"), "2025-04-01"); assert.equal(url.searchParams.get("$top"), "100");
      response.end(JSON.stringify({ value: [{ id: `/subscriptions/${subscriptionId}/resourceGroups/owned-azure-group`, name: "owned-azure-group", location: "eastus" }], nextLink: "https://attacker.invalid/forbidden-page" }));
    } catch { violation = true; if (!response.headersSent) response.writeHead(400); response.end("owned_azure_protocol_rejected"); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return {
    origin: `http://127.0.0.1:${server.address().port}`, proof, tenantId, subscriptionId, clientId, clientSecret, encryptionSecret: randomBytes(32).toString("hex"),
    setMode(next) { assert.ok(["success", "held", "denied", "redirect", "oversize", "compressed", "wrong_identity"].includes(next)); mode = next; },
    release() { mode = "success"; releaseHeld?.(); releaseHeld = undefined; },
    async waitForOperation(operation, count) { const end = Date.now() + 5000; while (requests.filter(value => value === operation).length < count && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 10)); assert.ok(requests.filter(value => value === operation).length >= count, "owned_azure_operation_wait_timeout"); },
    assertReady() { assert.ok(ready.size > 0, "owned_azure_guard_not_ready"); assert.equal(violation, false); },
    async waitUntilReady() { const end = Date.now() + 5000; while (ready.size === 0 && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 10)); this.assertReady(); },
    report() { assert.equal(violation, false); assert.equal([...sequences.values()].reduce((sum, value) => sum + value, 0), requests.length); return { requests: [...requests], guardedRequests: requests.length, guardedProcesses: sequences.size, realAzure: false, fixtureOnly: true }; },
    async close() { this.release(); await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("owned_azure_close_timeout")), 2000); server.close(error => { clearTimeout(timer); if (error && error.code !== "ERR_SERVER_NOT_RUNNING") reject(error); else resolve(); }); server.closeAllConnections(); }); },
  };
}
