import assert from "node:assert/strict";
import { createHash, createHmac, timingSafeEqual, verify } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const fixtureRoot = new URL("../../lib/releaseops/ecsReleaseV2/__tests__/fixtures/", import.meta.url);
const bundle = readFileSync(new URL("direct-workflow-oci/bundle.sigstore.json", fixtureRoot));
const workflow = readFileSync(new URL("direct-workflow-oci/workflow.yml", fixtureRoot));
export const ECS_WIRE = Object.freeze({ account: "123456789012", region: "us-east-1", role: "arn:aws:iam::123456789012:role/OwnedReadOnly", externalId: "axiom-0123456789abcdef0123456789abcdef", brokerKey: "AKIDOWNEDFIXTURE0001", secret: "owned-fixture-never-valid-aws-secret", appId: 42, installation: 19,
  sourceSha: "cc78c9cd50c7bace6c3be36bbd22f2f1b5f8182b", repositoryId: "804468129", repositoryFullName: "github/artifact-attestations-workflows", workflowPath: ".github/workflows/ghcr-publish.yml", runId: "10782915115", digest: "06e6818324cb20e1ea6f22da7fb925323fb57251c98768c88b93872b50590f92", bundleOrigin: "https://owned-ecs-bundle.invalid", bundlePath: "/attestations/804468129/bundle.json" });
const base = `arn:aws:ecs:${ECS_WIRE.region}:${ECS_WIRE.account}:`;
export const ECS_TARGET = Object.freeze({ cluster: base + "cluster/app", service: base + "service/app/web", baseline: base + "task-definition/app:1", proposed: base + "task-definition/app:2" });
const hash = value => createHash("sha256").update(value).digest("hex");
const hmac = (key, value) => createHmac("sha256", key).update(value).digest();
/** Pure request-signature check against owned credentials, never an AWS authorization grant. */
export function verifyOwnedSigV4({ method, path, headers, body }, expectedKey, sessionToken) {
  const auth = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/us-east-1\/(sts|ecs|ecr)\/aws4_request, SignedHeaders=([^,]+), Signature=([a-f0-9]{64})$/.exec(headers.authorization ?? "");
  assert.ok(auth && auth[1] === expectedKey && method === "POST" && path === "/", "owned_sigv4_binding_required");
  const [, , date, service, names, signature] = auth;
  assert.deepEqual(names.split(";"), [...new Set(names.split(";"))].sort());
  assert.ok(names.split(";").includes("host") && names.split(";").includes("x-amz-date"));
  assert.equal(headers.host, `${service === "ecr" ? "api.ecr" : service}.us-east-1.amazonaws.com`);
  assert.equal(headers["x-amz-security-token"], sessionToken);
  assert.match(headers["x-amz-date"], new RegExp(`^${date}T[0-9]{6}Z$`));
  const canonicalHeaders = names.split(";").map(name => { assert.equal(typeof headers[name], "string"); return name + ":" + headers[name].trim().replace(/\s+/g, " ") + "\n"; }).join("");
  const canonical = [method, path, "", canonicalHeaders, names, hash(body)].join("\n");
  const scope = `${date}/us-east-1/${service}/aws4_request`;
  const key = hmac(hmac(hmac(hmac("AWS4" + ECS_WIRE.secret, date), "us-east-1"), service), "aws4_request");
  const expected = hmac(key, `AWS4-HMAC-SHA256\n${headers["x-amz-date"]}\n${scope}\n${hash(canonical)}`);
  assert.ok(timingSafeEqual(expected, Buffer.from(signature, "hex")), "owned_sigv4_signature_required");
}
/** Owned server starts ONLY from the explicit runner, never at module import. */
export async function startOwnedEcsCheckedInputWire({ proof, publicKey }) {
  assert.match(proof, /^[a-f0-9]{32}$/);
  const requests = [], ready = new Set(), sequences = new Map(), sessions = new Map(), connections = new Set();
  let violation = false, held, holdOperation, responseMode, closing = false, processId;
  const waiters = new Set();
  const summary = () => ({ requests: [...requests], guardProcesses: ready.size, violation, pendingResponses: held ? 1 : 0 });
  function notify() { for (const done of waiters) done(); }
  async function responseFor(request, body) {
    const host = request.headers["x-axiom-original-host"], path = request.url;
    let operation, value, contentType = "application/json";
    if (host === "api.github.com") {
      if (request.method === "POST" && path === "/app/installations/19/access_tokens") {
        const token = request.headers.authorization?.replace(/^Bearer /, ""), parts = token?.split(".");
        assert.equal(parts?.length, 3); const header = JSON.parse(Buffer.from(parts[0], "base64url")), claims = JSON.parse(Buffer.from(parts[1], "base64url"));
        assert.deepEqual(header, { alg: "RS256", typ: "JWT" }); assert.equal(claims.iss, ECS_WIRE.appId);
        const now = Math.floor(Date.now() / 1000); assert.ok(claims.iat <= now && claims.iat >= now - 120 && claims.exp > now && claims.exp <= now + 600);
        assert.ok(verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]), publicKey, Buffer.from(parts[2], "base64url")));
        assert.deepEqual(JSON.parse(body), { repositories: ["artifact-attestations-workflows"], permissions: { contents: "read", actions: "read", attestations: "read" } });
        operation = "GithubToken"; value = { token: "owned-ecs-installation-token", expires_at: new Date(Date.now() + 3600_000).toISOString() };
      } else {
        assert.equal(request.method, "GET"); assert.equal(request.headers.authorization, "Bearer owned-ecs-installation-token");
        const prefix = "/repos/" + ECS_WIRE.repositoryFullName;
        const repository = { id: Number(ECS_WIRE.repositoryId), full_name: ECS_WIRE.repositoryFullName };
        if (path === prefix) { operation = "Repository"; value = { ...repository, private: false }; }
        else if ([`${prefix}/actions/runs/${ECS_WIRE.runId}`, `${prefix}/actions/runs/${ECS_WIRE.runId}/attempts/1`].includes(path)) { operation = path.endsWith("/attempts/1") ? "RunAttempt" : "Run"; value = { id: Number(ECS_WIRE.runId), run_attempt: 1, head_sha: ECS_WIRE.sourceSha, head_branch: "main", path: ECS_WIRE.workflowPath, event: "workflow_dispatch", status: "completed", conclusion: "success", repository, head_repository: repository }; }
        else if (path === `${prefix}/contents/${ECS_WIRE.workflowPath}?ref=${ECS_WIRE.sourceSha}`) { operation = "Workflow"; value = { type: "file", path: ECS_WIRE.workflowPath, encoding: "base64", content: workflow.toString("base64"), size: workflow.length, sha: createHash("sha1").update(`blob ${workflow.length}\0`).update(workflow).digest("hex") }; }
        else { assert.equal(path, `${prefix}/attestations/sha256%3A${ECS_WIRE.digest}?per_page=5`); operation = "Attestations"; value = { attestations: [{ repository_id: Number(ECS_WIRE.repositoryId), bundle_url: ECS_WIRE.bundleOrigin + ECS_WIRE.bundlePath }] }; }
      }
    } else if (host === "owned-ecs-bundle.invalid") { assert.equal(request.method, "GET"); assert.equal(path, ECS_WIRE.bundlePath); assert.equal(request.headers.authorization, undefined); operation = "Bundle"; value = bundle; }
    else {
      assert.equal(request.method, "POST"); assert.equal(path, "/");
      const params = new URLSearchParams(body), action = params.get("Action") ?? request.headers["x-amz-target"]?.split(".").at(-1);
      assert.ok(["AssumeRole", "GetCallerIdentity", "DescribeServices", "DescribeTaskDefinition", "DescribeImages"].includes(action), "owned_provider_writes_forbidden");
      const credentialKey = request.headers.authorization?.match(/Credential=([^/]+)\//)?.[1];
      const session = sessions.get(credentialKey);
      verifyOwnedSigV4({ method: request.method, path, headers: request.headers, body }, action === "AssumeRole" ? ECS_WIRE.brokerKey : credentialKey, action === "AssumeRole" ? undefined : session?.token);
      if (action === "AssumeRole") {
        assert.equal(host, "sts.us-east-1.amazonaws.com"); assert.equal(params.get("RoleArn"), ECS_WIRE.role); assert.equal(params.get("ExternalId"), ECS_WIRE.externalId); assert.equal(params.get("DurationSeconds"), "900");
        const name = params.get("RoleSessionName"); assert.match(name, /^axiom-ecs-read-[a-f0-9]{20}$/);
        const key = `ASIAOWNED${String(sessions.size + 1).padStart(10, "0")}`, token = `owned-session-${sessions.size + 1}`, arn = `arn:aws:sts::${ECS_WIRE.account}:assumed-role/OwnedReadOnly/${name}`; sessions.set(key, { token, arn, services: 0 });
        value = `<AssumeRoleResponse><AssumeRoleResult><Credentials><AccessKeyId>${key}</AccessKeyId><SecretAccessKey>${ECS_WIRE.secret}</SecretAccessKey><SessionToken>${token}</SessionToken><Expiration>2099-01-01T00:00:00Z</Expiration></Credentials><AssumedRoleUser><Arn>${arn}</Arn></AssumedRoleUser></AssumeRoleResult></AssumeRoleResponse>`; contentType = "text/xml";
      } else if (action === "GetCallerIdentity") { assert.equal(host, "sts.us-east-1.amazonaws.com"); assert.ok(session); value = `<GetCallerIdentityResponse><GetCallerIdentityResult><Account>${ECS_WIRE.account}</Account><Arn>${session.arn}</Arn></GetCallerIdentityResult></GetCallerIdentityResponse>`; contentType = "text/xml"; }
      else {
        assert.ok(session); const data = JSON.parse(body);
        if (action === "DescribeServices") { assert.equal(host, "ecs.us-east-1.amazonaws.com"); assert.deepEqual(data, { cluster: ECS_TARGET.cluster, services: [ECS_TARGET.service] }); value = { services: [{ serviceArn: ECS_TARGET.service, clusterArn: ECS_TARGET.cluster, status: "ACTIVE", taskDefinition: ECS_TARGET.baseline, deployments: [{ id: "owned-deployment", status: "PRIMARY", taskDefinition: ECS_TARGET.baseline, rolloutState: "COMPLETED" }], loadBalancers: [] }] }; }
        else if (action === "DescribeTaskDefinition") { assert.equal(host, "ecs.us-east-1.amazonaws.com"); assert.ok([ECS_TARGET.baseline, ECS_TARGET.proposed].includes(data.taskDefinition)); assert.deepEqual(Object.keys(data), ["taskDefinition"]); value = { taskDefinition: { taskDefinitionArn: data.taskDefinition, status: "ACTIVE", family: "app", revision: data.taskDefinition === ECS_TARGET.baseline ? 1 : 2, containerDefinitions: [{ name: "app", image: `${ECS_WIRE.account}.dkr.ecr.us-east-1.amazonaws.com/app@sha256:${data.taskDefinition === ECS_TARGET.baseline ? "a".repeat(64) : ECS_WIRE.digest}` }] } }; }
        else { assert.equal(host, "api.ecr.us-east-1.amazonaws.com"); assert.equal(data.registryId, ECS_WIRE.account); assert.equal(data.repositoryName, "app"); assert.deepEqual(new Set(data.imageIds.map(value => value.imageDigest)), new Set([`sha256:${"a".repeat(64)}`, `sha256:${ECS_WIRE.digest}`])); value = { imageDetails: data.imageIds.map(pin => ({ ...pin, registryId: ECS_WIRE.account, repositoryName: "app", imageStatus: "ACTIVE", imageManifestMediaType: "application/vnd.oci.image.manifest.v1+json" })) }; }
      }
      operation = action;
      if (action === "DescribeServices") { session.services++; if (session.services > 1) operation = "DescribeServicesFinal"; }
    }
    return { operation, contentType, bytes: Buffer.isBuffer(value) ? value : Buffer.from(typeof value === "string" ? value : JSON.stringify(value)) };
  }
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.headers["x-axiom-fixture-guard"], proof); const pid = request.headers["x-axiom-fixture-process"]; assert.match(pid ?? "", /^[1-9][0-9]*$/); assert.equal(pid, processId, "owned_child_process_required");
      let body = ""; for await (const chunk of request) { body += chunk; assert.ok(Buffer.byteLength(body) <= 16 * 1024); }
      if (request.url === "/__fixture_guard_ready") { assert.equal(request.method, "POST"); ready.add(pid); response.writeHead(200).end("ok"); return; }
      assert.ok(ready.has(pid)); const sequence = Number(request.headers["x-axiom-fixture-sequence"]); assert.equal(sequence, (sequences.get(pid) ?? 0) + 1); sequences.set(pid, sequence);
      const result = await responseFor(request, body); requests.push(result.operation);
      if (result.operation === holdOperation) { assert.ok(!held); holdOperation = undefined; await new Promise(resolve => { held = { response, resolve }; notify(); }); }
      if (response.destroyed) return;
      const mode = responseMode?.operation === result.operation ? responseMode.mode : undefined;
      if (mode) responseMode = undefined;
      if (mode === "denied") { response.writeHead(403).end("owned_denial"); return; }
      if (mode === "redirect") { response.writeHead(302, { location: "https://denied.invalid/" }).end(); return; }
      if (mode === "oversized") { response.writeHead(200, { "content-length": String(2 * 1024 * 1024) }).end("x"); return; }
      if (mode === "compressed") { response.writeHead(200, { "content-encoding": "gzip" }).end("not-gzip"); return; }
      response.writeHead(200, { "content-type": result.contentType }).end(result.bytes);
    } catch { violation = true; response.writeHead(400).end("owned_wire_protocol_rejected"); }
  });
  server.on("connection", socket => { connections.add(socket); socket.once("close", () => connections.delete(socket)); });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const operations = new Set(["Bundle", "DescribeServices", "DescribeServicesFinal", "DescribeImages", "AssumeRole"]);
  return { origin: `http://127.0.0.1:${server.address().port}`, summary,
    bindProcess(pid) { assert.ok(!processId && Number.isSafeInteger(pid) && pid > 1); processId = String(pid); },
    async control(message) {
      assert.ok(message && ["summary", "hold", "wait_held", "release", "response"].includes(message.command));
      if (message.command === "summary") return summary();
      if (message.command === "hold") { assert.ok(operations.has(message.operation) && !held && !holdOperation); holdOperation = message.operation; return true; }
      if (message.command === "response") { assert.ok(operations.has(message.operation) && ["denied", "redirect", "oversized", "compressed"].includes(message.mode)); responseMode = { operation: message.operation, mode: message.mode }; return true; }
      if (message.command === "wait_held") {
        if (!held) await new Promise((resolve, reject) => { const timer = setTimeout(() => { waiters.delete(done); reject(new Error("owned_wire_hold_timeout")); }, 5000); const done = () => { if (closing) { clearTimeout(timer); waiters.delete(done); reject(new Error("owned_wire_closed")); } else if (held) { clearTimeout(timer); waiters.delete(done); resolve(); } }; waiters.add(done); });
        assert.ok(held); return true;
      }
      if (held) { const pending = held; held = undefined; pending.resolve(); } holdOperation = undefined; return true;
    },
    async close() { closing = true; if (held) { held.response.destroy(); const done = held.resolve; held = undefined; done(); } for (const done of waiters) done(); server.closeAllConnections(); for (const socket of connections) socket.destroy(); await new Promise(resolve => server.close(resolve)); assert.equal(connections.size, 0); },
  };
}
