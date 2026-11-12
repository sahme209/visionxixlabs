import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/lib/prismaClient";
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { AirflowClient, validateAirflowBaseUrl, type AirflowMutationAuthority } from "../airflowClient";
import { scheduledDagRunId } from "../scheduledRunId";
const f = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient, client: undefined as unknown as AirflowClient, connectionId: "", connectionVersion: new Date(0), makeClient: undefined as unknown as (authority?: AirflowMutationAuthority) => AirflowClient }));
vi.mock("@/lib/db", () => ({ get prisma() { return f.db; } }));
// Only the verified private fixture's connection loader is substituted. The
// scheduler, provider client, execution claim, completion and audit are real.
vi.mock("../connection", () => ({ loadAirflowClient: async (_organizationId: string, authority?: AirflowMutationAuthority) => ({ client: authority ? f.makeClient(authority) : f.client, connectionId: f.connectionId, connectionUpdatedAt: f.connectionVersion }) }));
import { runAirflowAutomationTick } from "../automationTick";
const socket = process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
const file = process.env.AXIOM_OWNED_AIRFLOW_FIXTURE;
type Fixture = { baseUrl: string; username: string; password: string; dagId: string; runId: string; version: string };
describe.skipIf(!socket || !file)("actual scheduler → local Airflow → durable completion", () => {
  let fixture: Fixture;
  beforeAll(async () => {
    if (!socket || !/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0 || (process.getuid && statSync(socket).uid !== process.getuid())) throw Error("owned_private_socket_required");
    if (!file || !/^\/(?:private\/)?tmp\/axiom-airflow-engine-[^/]+\/fixture.json$/.test(file) || realpathSync(file) !== file || (statSync(file).mode & 0o077) !== 0 || (process.getuid && statSync(file).uid !== process.getuid())) throw Error("owned_airflow_fixture_required");
    fixture = JSON.parse(readFileSync(file, "utf8")); const origin = new URL(fixture.baseUrl);
    if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password || fixture.version !== "3.3.2" || fixture.username !== "axiom_fixture" || !/^axiom_owned_noop_[a-f0-9]{16}$/.test(fixture.dagId)) throw Error("owned_airflow_binding_required");
    f.db = createDatabaseClient(`postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`);
    const [binding] = await f.db.$queryRawUnsafe<Array<{ private: boolean }>>("SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private");
    if (!binding?.private) throw Error("owned_fixture_binding_required");
    // Private fixture loader substitutes tenant credential/metadata resolution only;
    // preserve the actual scheduler current-rule callback for every mutation.
    f.makeClient = authority => new AirflowClient(fixture.baseUrl, { authMode: "username_password", username: fixture.username, password: fixture.password }, authority);
    f.client = f.makeClient();
    expect(await f.client.validate()).toMatchObject({ version: "3.3.2" });
    expect((await f.client.listDags()).find(dag => dag.dagId === fixture.dagId)?.tags).toContain("axiom_owned_fixture");
    await expect(validateAirflowBaseUrl(fixture.baseUrl)).rejects.toThrow("airflow_https_url_required");
  });
  afterAll(async () => { await f.db?.$disconnect(); });
  it("triggers one current occurrence, observes real tasks, records completion and refuses historical/replayed actions", async () => {
    const organizationId = "engine_scheduler_" + randomUUID();
    const connection = await f.db.tenantIntegrationConnection.create({ data: { organizationId, provider: "airflow", status: "active", encryptedCredential: "unused-owned-fixture-binding" } });
    f.connectionId = connection.id; f.connectionVersion = connection.updatedAt;
    const createdAt = new Date(), due = new Date(createdAt.getTime() - 1), tickAt = new Date(createdAt.getTime() + 1);
    const rule = await f.db.airflowAutomation.create({ data: { organizationId, connectionId: connection.id, name: "Real local scheduler acceptance", dagId: fixture.dagId, triggerMode: "schedule", scheduleCron: "0 * * * *", nextScheduledAt: due, actionType: "none", approvalRequired: false, notifyOnSuccess: false, notifyOnFailure: false, createdByUserId: "synthetic-owner", createdAt } });
    const runId = scheduledDagRunId({ organizationId, automationId: rule.id, dagId: fixture.dagId, scheduledAt: due });
    const first = await runAirflowAutomationTick(tickAt);
    expect(first).toMatchObject({ errors: 0 });
    expect(await f.db.airflowDagRunSnapshot.findUnique({ where: { connectionId_dagId_dagRunId: { connectionId: connection.id, dagId: fixture.dagId, dagRunId: runId } } })).toBeTruthy();
    const initialExecutions = await f.db.airflowAutomationExecution.findMany({ where: { automationId: rule.id } });
    expect(initialExecutions.every(item => item.sourceDagRunId === runId)).toBe(true);
    expect(initialExecutions.length).toBeLessThanOrEqual(1);
    const deadline = Date.now() + 120000;
    let run = await f.client.getDagRun(fixture.dagId, runId);
    while (!["success", "failed"].includes(run.state) && Date.now() < deadline) { await new Promise(resolve => setTimeout(resolve, 1000)); run = await f.client.getDagRun(fixture.dagId, runId); }
    expect(run.state).toBe("success"); const tasks = await f.client.listTaskInstances(fixture.dagId, runId);
    expect(tasks.tasks).toHaveLength(2); expect(tasks.tasks.every(task => task.state === "success")).toBe(true);
    expect(await runAirflowAutomationTick(tickAt)).toMatchObject({ errors: 0, proposals: initialExecutions.length ? 0 : 1, actions: initialExecutions.length ? 0 : 1 });
    const execution = await f.db.airflowAutomationExecution.findUniqueOrThrow({ where: { automationId_sourceDagRunId: { automationId: rule.id, sourceDagRunId: runId } } });
    expect(execution).toMatchObject({ status: "succeeded", attempt: 1, sourceDagState: "success", resultJson: { action: "none" } });
    expect(await runAirflowAutomationTick(tickAt)).toMatchObject({ errors: 0, proposals: 0, actions: 0 });
    expect(await f.db.airflowAutomationExecution.count({ where: { automationId: rule.id } })).toBe(1);
    expect(await f.db.auditEvent.count({ where: { organizationId, kind: "airflow.automation.succeeded", subjectId: execution.id } })).toBe(1);
    expect((await f.client.listDagRuns(fixture.dagId)).filter(item => item.dagRunId === runId)).toHaveLength(1);
  }, 150000);
});
