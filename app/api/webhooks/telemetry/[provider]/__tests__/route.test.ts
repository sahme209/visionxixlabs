import {createHash, createHmac, randomBytes} from "node:crypto";
import {NextRequest} from "next/server";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {__resetEnvCacheForTest} from "@/lib/config/env";
import {id} from "@/lib/domain/ids";
import {buildTelemetryIngest} from "@/lib/telemetry/telemetryIngestBuilder";
import {readInboundObservations} from "@/lib/observations/inboundObservationStore";
import {POST} from "../route";

const storage = vi.hoisted(() => ({createMany: vi.fn(), findMany: vi.fn()}));
vi.mock("@/lib/db", () => ({prisma: {inboundObservation: storage}}));

vi.mock("@/lib/axiomOS/axiomOSStateBuilder", () => ({
  buildAxiomOSState: async () => ({generatedAt: "2026-01-01T00:00:00Z", providers: []}),
}));

const workspace = "workspace-receiving-telemetry";
const otherWorkspace = "workspace-without-telemetry";
const signingSecret = randomBytes(32).toString("hex");
const alerts = {alerts: [{status: "firing", labels: {alertname: "Example health event", severity: "warning"}}]};

function setBinding(provider: string, tenantId = workspace) {
  vi.stubEnv("TELEMETRY_WEBHOOK_SECRET", signingSecret);
  vi.stubEnv("TELEMETRY_WEBHOOK_TENANT_ID", tenantId);
  vi.stubEnv("TELEMETRY_WEBHOOK_PROVIDER", provider);
  __resetEnvCacheForTest();
}

async function deliver(provider: string, payload: unknown, claimedWorkspace?: string, signed = true) {
  const url = "https://local-test.invalid/api/webhooks/telemetry/" + provider;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {"Content-Type": "application/json"};
  if (signed) headers["x-signature"] = createHmac("sha256", signingSecret).update(body).digest("hex");
  if (claimedWorkspace !== undefined) headers["x-axiom-tenant"] = claimedWorkspace;
  return POST(new NextRequest(url, {method: "POST", body, headers}), {params: Promise.resolve({provider})});
}

describe("inbound telemetry workspace binding", () => {
  beforeEach(() => {
    const rows = new Map<string, {organizationId: string; lane: string; evidence: unknown}>();
    storage.createMany.mockReset().mockImplementation(async ({data}) => {
      let count = 0;
      for (const row of data) {
        const key = JSON.stringify([row.organizationId, row.lane, row.provider, row.deliveryDigest, row.ordinal]);
        if (rows.has(key)) continue;
        rows.set(key, row);
        count++;
      }
      return {count};
    });
    storage.findMany.mockReset().mockImplementation(async ({where}) =>
      [...rows.values()].filter(row => row.organizationId === where.organizationId && row.lane === where.lane),
    );
    for (const flag of ["DATADOG_PULL_ENABLED", "SENTRY_PULL_ENABLED", "DYNATRACE_PULL_ENABLED", "NEW_RELIC_PULL_ENABLED", "AZURE_INVENTORY_EXTRACT_ENABLED", "GCP_INVENTORY_EXTRACT_ENABLED"]) {
      vi.stubEnv(flag, "false");
    }
    vi.stubEnv("TELEMETRY_PROMETHEUS_BEARER_SHA256", "");
    setBinding("grafana");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    __resetEnvCacheForTest();
  });

  it.each([
    ["grafana", "grafana_cloud", alerts],
    ["prometheus", "prometheus", alerts],
    ["sentry", "sentry", {event: {event_id: "example", message: "Example event", level: "warning"}}],
    ["datadog", "datadog", {alert: {title: "Example monitor"}}],
    ["opentelemetry", "opentelemetry_collector", {resourceLogs: [{}]}],
  ])("accepts the configured %s source and scopes the resulting report", async (provider, sourceProvider, payload) => {
    setBinding(provider);
    const response = await deliver(provider, payload, provider === "grafana" ? workspace : undefined);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ok: true, data: {enqueued: 1}});
    const owner = await buildTelemetryIngest({tenantId: id.organization(workspace)});
    const neighbor = await buildTelemetryIngest({tenantId: id.organization(otherWorkspace)});
    expect(owner.signals).toHaveLength(1);
    expect(owner.signals[0]).toMatchObject({sourceProvider});
    expect(owner.signals[0]).not.toHaveProperty("tenantId");
    expect(neighbor.signals).toEqual([]);
    expect(neighbor.providers.every(entry => entry.mode === "preview")).toBe(true);
  });

  it.each(["TELEMETRY_WEBHOOK_SECRET", "TELEMETRY_WEBHOOK_TENANT_ID", "TELEMETRY_WEBHOOK_PROVIDER"])(
    "requires %s before accepting a source",
    async setting => {
      vi.stubEnv(setting, "");
      __resetEnvCacheForTest();
      const response = await deliver("grafana", alerts, workspace);
      expect(response.status).toBe(401);
      expect((await readInboundObservations(workspace, "telemetry")).observations).toEqual([]);
    },
  );

  it("declines requests that fail workspace, provider or signature checks", async () => {
    expect((await deliver("grafana", alerts, otherWorkspace)).status).toBe(401);
    expect((await deliver("prometheus", alerts)).status).toBe(401);
    expect((await deliver("grafana", alerts, workspace, false)).status).toBe(401);
    expect((await readInboundObservations(workspace, "telemetry")).observations).toEqual([]);
    expect((await readInboundObservations(otherWorkspace, "telemetry")).observations).toEqual([]);
  });

  it("acknowledges an exact retry without writing duplicate observations", async () => {
    expect(await (await deliver("grafana", alerts)).json()).toMatchObject({ok: true, data: {enqueued: 1}});
    expect(await (await deliver("grafana", alerts)).json()).toMatchObject({ok: true, data: {enqueued: 0}});
    expect(storage.createMany).toHaveBeenCalledWith(expect.objectContaining({skipDuplicates: true}));
  });

  it("returns a retryable failure when durable storage is unavailable", async () => {
    storage.createMany.mockRejectedValueOnce(new Error("fixture unavailable"));
    expect((await deliver("grafana", alerts)).status).toBe(503);
    storage.findMany.mockRejectedValueOnce(new Error("fixture unavailable"));
    expect(await readInboundObservations("fixture", "telemetry")).toEqual({available: false, observations: []});
  });

  it.each([false, true])("accepts native Grafana signing with timestamp configured: %s", async timestamped => {
    const body = JSON.stringify({alerts: [{labels: {alertname: "Alarme café"}, status: "firing"}]});
    const timestamp = String(Math.floor(Date.now() / 1000));
    const bytes = timestamped ? timestamp + ":" + body : body;
    const headers = new Headers({"x-grafana-alerting-signature": createHmac("sha256", signingSecret).update(bytes).digest("hex")});
    if (timestamped) headers.set("x-grafana-alerting-timestamp", timestamp);
    const req = new NextRequest("https://local-test.invalid/api/webhooks/telemetry/grafana", {method: "POST", headers, body});
    const response = await POST(req, {params: Promise.resolve({provider: "grafana"})});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ok: true, data: {enqueued: 1, signals: [{headline: "Alarme café"}]}});
  });

  it("refuses expired native Grafana delivery metadata", async () => {
    const body = JSON.stringify(alerts);
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);
    const headers = {
      "x-grafana-alerting-signature": createHmac("sha256", signingSecret).update(timestamp + ":" + body).digest("hex"),
      "x-grafana-alerting-timestamp": timestamp,
    };
    const req = new NextRequest("https://local-test.invalid/api/webhooks/telemetry/grafana", {method: "POST", headers, body});
    expect((await POST(req, {params: Promise.resolve({provider: "grafana"})})).status).toBe(401);
    expect(storage.createMany).not.toHaveBeenCalled();
  });

  const installationId = "24b397fc-a86e-43ef-9297-949e21b82480";
  function deliverSentry(action: string, status: string, resource = "issue") {
    const body = JSON.stringify({
      action, installation: {uuid: installationId},
      data: {issue: {
        id: "1234", status, project: {slug: "example-service"},
        firstSeen: "2026-11-11T12:34:56.789000+00:00", level: "error",
        title: "private event text", web_url: "https://sentry.example.invalid/issues/1234/",
      }},
      actor: {name: "private actor metadata"},
    });
    const headers = {
      "sentry-hook-resource": resource,
      "sentry-hook-signature": createHmac("sha256", signingSecret).update(body).digest("hex"),
    };
    const req = new NextRequest("https://local-test.invalid/api/webhooks/telemetry/sentry", {method: "POST", headers, body});
    return POST(req, {params: Promise.resolve({provider: "sentry"})});
  }

  it.each([
    ["created", "unresolved", "alert_firing"],
    ["unresolved", "unresolved", "alert_firing"],
    ["resolved", "resolved", "alert_resolved"],
  ])("records native Sentry %s using the bound installation", async (action, status, kind) => {
    vi.stubEnv("TELEMETRY_SENTRY_INSTALLATION_ID", installationId.toUpperCase());
    setBinding("sentry");
    const response = await deliverSentry(action, status);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({data: {enqueued: 1, signals: [{
      id: "sentry:issue:1234:" + action, kind, scope: "example-service",
      firedAt: "2026-11-11T12:34:56.789Z", evidenceRef: "sentry:issue:1234",
    }]}});
    const stored = JSON.stringify(storage.createMany.mock.calls);
    expect(stored).not.toContain("private event text");
    expect(stored).not.toContain("private actor metadata");
    expect(stored).not.toContain("https://sentry.example.invalid");
  });

  it("requires an exact native Sentry installation before writing issue evidence", async () => {
    vi.stubEnv("TELEMETRY_SENTRY_INSTALLATION_ID", "");
    setBinding("sentry");
    expect((await deliverSentry("created", "unresolved")).status).toBe(401);
    vi.stubEnv("TELEMETRY_SENTRY_INSTALLATION_ID", "23b397fc-a86e-43ef-9297-949e21b82480");
    __resetEnvCacheForTest();
    expect((await deliverSentry("created", "unresolved")).status).toBe(401);
    expect(storage.createMany).not.toHaveBeenCalled();
  });

  it("acknowledges unsupported resources and non-lifecycle issue events without observations", async () => {
    vi.stubEnv("TELEMETRY_SENTRY_INSTALLATION_ID", installationId);
    setBinding("sentry");
    expect((await deliverSentry("assigned", "unresolved")).status).toBe(202);
    expect((await deliverSentry("triggered", "unresolved", "metric_alert")).status).toBe(202);
    expect(storage.createMany).not.toHaveBeenCalled();
  });

  function deliverAlertmanager(token: string, claimedWorkspace?: string) {
    const body = JSON.stringify({version:"4", status:"firing", alerts:[{
      status:"firing", labels:{alertname:"Fixture firing alert", severity:"warning"},
    }]});
    const headers = new Headers({"Content-Type":"application/json", authorization:"Bearer " + token});
    if (claimedWorkspace !== undefined) headers.set("x-axiom-tenant", claimedWorkspace);
    const req = new NextRequest("https://local-test.invalid/api/webhooks/telemetry/prometheus", {method:"POST", body, headers});
    return POST(req, {params: Promise.resolve({provider:"prometheus"})});
  }

  it("accepts a dedicated native Alertmanager bearer without an HMAC signing secret", async () => {
    const token = randomBytes(32).toString("base64url");
    setBinding("prometheus");
    vi.stubEnv("TELEMETRY_WEBHOOK_SECRET", "");
    vi.stubEnv("TELEMETRY_PROMETHEUS_BEARER_SHA256", createHash("sha256").update(token).digest("hex"));
    __resetEnvCacheForTest();
    expect(await (await deliverAlertmanager(token)).json()).toMatchObject({ok:true, data:{enqueued:1, signals:[{sourceProvider:"prometheus"}]}});
    expect(await (await deliverAlertmanager(token)).json()).toMatchObject({ok:true, data:{enqueued:0}});
    expect(JSON.stringify(storage.createMany.mock.calls)).not.toContain(token);
    expect((await readInboundObservations(otherWorkspace,"telemetry")).observations).toEqual([]);
  });

  it("keeps native bearer authentication scoped to the configured workspace and provider", async () => {
    const token = randomBytes(32).toString("base64url");
    vi.stubEnv("TELEMETRY_PROMETHEUS_BEARER_SHA256", createHash("sha256").update(token).digest("hex"));
    setBinding("prometheus");
    expect((await deliverAlertmanager(token, otherWorkspace)).status).toBe(401);
    expect((await deliverAlertmanager(randomBytes(32).toString("base64url"))).status).toBe(401);
    setBinding("grafana");
    expect((await deliverAlertmanager(token)).status).toBe(401);
    expect(storage.createMany).not.toHaveBeenCalled();
  });

  it("requires bearer when configured and refuses invalid digest configuration", async () => {
    setBinding("prometheus");
    vi.stubEnv("TELEMETRY_PROMETHEUS_BEARER_SHA256", "invalid-fixture-digest");
    __resetEnvCacheForTest();
    expect((await deliver("prometheus", alerts)).status).toBe(401);
    expect((await deliverAlertmanager(randomBytes(32).toString("base64url"))).status).toBe(401);
    expect(storage.createMany).not.toHaveBeenCalled();
  });

});
