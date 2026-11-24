import {createHmac, randomBytes} from "node:crypto";
import {NextRequest} from "next/server";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {__resetEnvCacheForTest} from "@/lib/config/env";
import {id} from "@/lib/domain/ids";
import {buildIncidentResponse} from "@/lib/incidents/incidentResponseBuilder";
import {readInboundObservations} from "@/lib/observations/inboundObservationStore";
import {POST} from "../route";

const storage = vi.hoisted(() => ({createMany: vi.fn(), findMany: vi.fn()}));
vi.mock("@/lib/db", () => ({prisma: {inboundObservation: storage}}));

vi.mock("@/lib/axiomOS/axiomOSStateBuilder", () => ({
  buildAxiomOSState: async () => ({generatedAt: "2026-01-01T00:00:00Z", providers: []}),
}));

const receivingWorkspace = id.organization("incident-workspace");
const unrelatedWorkspace = id.organization("unrelated-workspace");
const signingSecret = randomBytes(32).toString("hex");
const pagerDutyEvent = {incident: {id: "fixture-incident", title: "Example incident", status: "triggered"}};

function configure(provider: string) {
  vi.stubEnv("INCIDENT_WEBHOOK_PROVIDER", provider);
  __resetEnvCacheForTest();
}

function deliver(provider: string, payload: unknown, workspace?: string, sign = true) {
  const url = "https://local-test.invalid/api/webhooks/incidents/" + provider;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {"Content-Type": "application/json"};
  if (sign) headers["x-signature"] = createHmac("sha256", signingSecret).update(body).digest("hex");
  if (workspace !== undefined) headers["x-axiom-tenant"] = workspace;
  return POST(new NextRequest(url, {method: "POST", body, headers}), {params: Promise.resolve({provider})});
}

describe("inbound incident workspace binding", () => {
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
    vi.stubEnv("PAGERDUTY_PULL_ENABLED", "false");
    vi.stubEnv("INCIDENT_WEBHOOK_SECRET", signingSecret);
    vi.stubEnv("INCIDENT_WEBHOOK_TENANT_ID", receivingWorkspace);
    configure("pagerduty");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    __resetEnvCacheForTest();
  });

  it.each([
    ["pagerduty", "pagerduty", pagerDutyEvent],
    ["opsgenie", "opsgenie", {action: "create", alert: {alertId: "example", message: "Example alert"}}],
    ["slack", "slack_alerts", {event: {text: "Example health event"}}],
    ["teams", "microsoft_teams", {title: "Example health event"}],
  ])("accepts the configured %s sender and reports only its workspace records", async (provider, canonical, payload) => {
    configure(provider);
    const response = await deliver(provider, payload, provider === "pagerduty" ? receivingWorkspace : undefined);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ok: true, data: {enqueued: 1}});
    const receivingReport = await buildIncidentResponse({tenantId: receivingWorkspace});
    const unrelatedReport = await buildIncidentResponse({tenantId: unrelatedWorkspace});
    expect(receivingReport.incidents).toHaveLength(1);
    expect(receivingReport.incidents[0]).toMatchObject({provider: canonical});
    expect(receivingReport.incidents[0]).not.toHaveProperty("tenantId");
    expect(unrelatedReport.incidents).toEqual([]);
    expect(unrelatedReport.providers.every(entry => entry.mode === "preview")).toBe(true);
  });

  it.each(["INCIDENT_WEBHOOK_SECRET", "INCIDENT_WEBHOOK_TENANT_ID", "INCIDENT_WEBHOOK_PROVIDER"])(
    "requires %s before accepting an incident",
    async key => {
      vi.stubEnv(key, "");
      __resetEnvCacheForTest();
      expect((await deliver("pagerduty", pagerDutyEvent)).status).toBe(401);
      expect((await readInboundObservations(receivingWorkspace, "incident")).observations).toEqual([]);
    },
  );

  it("declines requests that fail workspace, provider or signature checks", async () => {
    expect((await deliver("pagerduty", pagerDutyEvent, unrelatedWorkspace)).status).toBe(401);
    expect((await deliver("opsgenie", {alert: {message: "Example alert"}})).status).toBe(401);
    expect((await deliver("pagerduty", pagerDutyEvent, receivingWorkspace, false)).status).toBe(401);
    expect((await readInboundObservations(receivingWorkspace, "incident")).observations).toEqual([]);
    expect((await readInboundObservations(unrelatedWorkspace, "incident")).observations).toEqual([]);
  });

  it("acknowledges an exact retry without writing duplicate observations", async () => {
    expect(await (await deliver("pagerduty", pagerDutyEvent)).json()).toMatchObject({ok: true, data: {enqueued: 1}});
    expect(await (await deliver("pagerduty", pagerDutyEvent)).json()).toMatchObject({ok: true, data: {enqueued: 0}});
    expect(storage.createMany).toHaveBeenCalledWith(expect.objectContaining({skipDuplicates: true}));
  });

  it("returns a retryable failure when durable storage is unavailable", async () => {
    storage.createMany.mockRejectedValueOnce(new Error("fixture unavailable"));
    expect((await deliver("pagerduty", pagerDutyEvent)).status).toBe(503);
    storage.findMany.mockRejectedValueOnce(new Error("fixture unavailable"));
    expect(await readInboundObservations("fixture", "incident")).toEqual({available: false, observations: []});
  });

});
