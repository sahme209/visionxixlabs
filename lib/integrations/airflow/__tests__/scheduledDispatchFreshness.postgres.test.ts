import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
const f = vi.hoisted(() => ({ client: undefined as unknown as PrismaClient, org: "", connectionId: "", ruleId: "", connectionVersion: new Date(0), afterRead: null as null | (() => Promise<void>), trigger: vi.fn() }));
vi.mock("@/lib/db", () => ({ get prisma() {
  return new Proxy(f.client, { get(target, key) {
    if (key === "airflowAutomation") return new Proxy(target.airflowAutomation, { get(delegate, method) {
      if (method === "findMany") return async (args: Parameters<typeof delegate.findMany>[0]) => {
        const rows = await delegate.findMany(args); const hook = f.afterRead; f.afterRead = null; await hook?.(); return rows;
      };
      const value = Reflect.get(delegate, method); return typeof value === "function" ? value.bind(delegate) : value;
    } });
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  } });
} }));
vi.mock("../connection", () => ({ loadAirflowClient: async () => ({ connectionId: f.connectionId, connectionUpdatedAt: f.connectionVersion, client: { triggerDag: f.trigger, listDagRuns: async () => [] } }) }));
vi.mock("../automationExecutor", () => ({ executeAirflowAutomation: vi.fn(async () => { throw Error("unexpected_fixture_execution"); }) }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn() }));
import { runAirflowAutomationTick } from "../automationTick";
const socket = process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
const now = new Date("2026-10-15T10:01:00Z");
const occurrence = new Date("2026-10-15T10:00:00Z");
describe.skipIf(!socket)("actual PostgreSQL scheduled dispatch freshness and schedule preservation", () => {
  beforeAll(async () => {
    if (!socket || !/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0 || (process.getuid && statSync(socket).uid !== process.getuid())) throw Error("owned_private_socket_required");
    f.client = new PrismaClient({ datasources: { db: { url: `postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}` } } });
    const [binding] = await f.client.$queryRawUnsafe<Array<{ private: boolean }>>("SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private");
    if (!binding?.private) throw Error("owned_fixture_binding_required");
    vi.stubGlobal("fetch", vi.fn(async () => { throw Error("unexpected_external_request"); }));
  });
  beforeEach(async () => {
    f.org = "scheduled_fixture_" + randomUUID(); f.afterRead = null; f.trigger.mockReset();
    const connection = await f.client.tenantIntegrationConnection.create({ data: { organizationId: f.org, provider: "airflow", status: "active", encryptedCredential: "synthetic-unused-fixture", updatedAt: new Date("2026-10-15T08:00:00Z") } });
    f.connectionId = connection.id; f.connectionVersion = connection.updatedAt;
    const rule = await f.client.airflowAutomation.create({ data: { organizationId: f.org, connectionId: connection.id, name: "Owned fixture", dagId: "noop", triggerMode: "schedule", scheduleCron: "0 * * * *", nextScheduledAt: occurrence, actionType: "none", approvalRequired: false, createdByUserId: "synthetic-owner", updatedAt: new Date("2026-10-15T09:00:00Z") } }); f.ruleId = rule.id;
    f.trigger.mockResolvedValue({ dagId: "noop", dagRunId: "synthetic-accepted", state: "queued", logicalDate: null, startedAt: null, endedAt: null });
  });
  afterEach(async () => {
    await f.client.airflowDagRunSnapshot.deleteMany({ where: { organizationId: f.org } });
    await f.client.airflowAutomation.deleteMany({ where: { organizationId: f.org } });
    await f.client.tenantIntegrationConnection.deleteMany({ where: { organizationId: f.org } });
  });
  afterAll(async () => { await f.client?.$disconnect(); vi.unstubAllGlobals(); });
  it("dispatches one current occurrence and advances its unchanged schedule", async () => {
    expect(await runAirflowAutomationTick(now)).toMatchObject({ errors: 0 }); expect(f.trigger).toHaveBeenCalledOnce();
    expect((await f.client.airflowAutomation.findUniqueOrThrow({ where: { id: f.ruleId } })).nextScheduledAt).toEqual(new Date("2026-10-15T11:00:00Z"));
  });
  it("does not dispatch a rule paused after the scheduler loaded it", async () => {
    f.afterRead = async () => { await f.client.airflowAutomation.update({ where: { id: f.ruleId }, data: { enabled: false } }); };
    expect(await runAirflowAutomationTick(now)).toMatchObject({ errors: 1 }); expect(f.trigger).not.toHaveBeenCalled();
    expect((await f.client.airflowAutomation.findUniqueOrThrow({ where: { id: f.ruleId } })).nextScheduledAt).toEqual(occurrence);
  });
  it("does not dispatch with a connection revoked after the scheduler loaded it", async () => {
    f.afterRead = async () => { await f.client.tenantIntegrationConnection.update({ where: { id: f.connectionId }, data: { status: "revoked", revokedAt: now } }); };
    expect(await runAirflowAutomationTick(now)).toMatchObject({ errors: 1 }); expect(f.trigger).not.toHaveBeenCalled();
  });
  it("does not dispatch with a newly replaced connection version", async () => {
    f.afterRead = async () => { await f.client.tenantIntegrationConnection.update({ where: { id: f.connectionId }, data: { encryptedCredential: "synthetic-replacement", updatedAt: now } }); };
    expect(await runAirflowAutomationTick(now)).toMatchObject({ errors: 1 }); expect(f.trigger).not.toHaveBeenCalled();
  });
  it("preserves an owner's schedule edit during dispatch while retaining the accepted occurrence receipt", async () => {
    const revisedNext = new Date("2026-10-15T12:30:00Z");
    f.trigger.mockImplementation(async () => {
      await f.client.airflowAutomation.update({ where: { id: f.ruleId }, data: { scheduleCron: "30 * * * *", nextScheduledAt: revisedNext, updatedAt: now } });
      return { dagId: "noop", dagRunId: "synthetic-accepted", state: "queued", logicalDate: null, startedAt: null, endedAt: null };
    });
    expect(await runAirflowAutomationTick(now)).toMatchObject({ errors: 1 }); expect(f.trigger).toHaveBeenCalledOnce();
    expect(await f.client.airflowAutomation.findUniqueOrThrow({ where: { id: f.ruleId } })).toMatchObject({ scheduleCron: "30 * * * *", nextScheduledAt: revisedNext });
    expect(await f.client.airflowDagRunSnapshot.count({ where: { organizationId: f.org, dagRunId: "synthetic-accepted" } })).toBe(1);
  });
});
