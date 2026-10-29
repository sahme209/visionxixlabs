import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { realpathSync, statSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { inspectMigrationDeploy } from "../../scripts/migration-deploy-preflight.mjs";

const socket = process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
const unsafe = "20261013172000_add_workspace_agent_identity";
const local = [{ name: "20260101000000_initial", checksum: "a" }, { name: unsafe, checksum: "b" }];
describe.skipIf(!socket)("actual owned PostgreSQL migration refusal gate", () => {
  let client: PrismaClient;
  beforeAll(async () => {
    if (!socket || !/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0 || (process.getuid && statSync(socket).uid !== process.getuid())) throw Error("owned_private_socket_required");
    client = new PrismaClient({ datasources: { db: { url: `postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}` } } });
    const [binding] = await client.$queryRawUnsafe<Array<{ private: boolean }>>("SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private");
    if (!binding?.private) throw Error("owned_fixture_binding_required");
    // Only a new private runner database is accepted. Never replace any ledger.
    const [existing] = await client.$queryRawUnsafe<Array<{ present: boolean }>>("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present");
    if (existing?.present) throw Error("unexpected_existing_fixture_ledger");
    await client.$executeRawUnsafe('CREATE TABLE public."_prisma_migrations" (migration_name text NOT NULL, checksum text NOT NULL, finished_at timestamp, rolled_back_at timestamp)');
  });
  beforeEach(async () => { await client.$executeRawUnsafe('DELETE FROM public."_prisma_migrations"'); });
  afterAll(async () => { await client?.$disconnect(); });
  async function record(name: string, checksum: string, finished = true, rolledBack = false) {
    await client.$executeRaw`INSERT INTO public."_prisma_migrations" (migration_name, checksum, finished_at, rolled_back_at) VALUES (${name}, ${checksum}, ${finished ? new Date() : null}, ${rolledBack ? new Date() : null})`;
  }
  it("blocks replay against an empty ledger", async () => {
    expect(await inspectMigrationDeploy(client, local)).toMatchObject({ readOnly: true, deployAllowed: false, problems: [`manual_recovery_required:${unsafe}`] });
  });
  it("blocks a failed migration while preserving its exact evidence", async () => {
    await record(unsafe, "original-checksum", false);
    const before = await client.$queryRawUnsafe('SELECT * FROM public."_prisma_migrations"');
    expect((await inspectMigrationDeploy(client, local)).problems).toContain(`unfinished:${unsafe}`);
    expect(await client.$queryRawUnsafe('SELECT * FROM public."_prisma_migrations"')).toEqual(before);
  });
  it("does not treat rolled-back Agent history as approval to replay the backfill", async () => {
    await record(unsafe, "b", false, true);
    expect((await inspectMigrationDeploy(client, local)).problems).toContain(`manual_recovery_required:${unsafe}`);
  });
  it("accepts coherent completed history and ordinary pending forward migrations", async () => {
    for (const row of local) await record(row.name, row.checksum);
    expect(await inspectMigrationDeploy(client, [...local, { name: "20261024000000_forward", checksum: "c" }])).toEqual({ readOnly: true, deployAllowed: true, problems: [] });
  });
  it("refuses changed checksums from actual database rows", async () => {
    for (const row of local) await record(row.name, row.name === unsafe ? "altered" : row.checksum);
    expect((await inspectMigrationDeploy(client, local)).problems).toContain(`checksum_mismatch:${unsafe}`);
  });
  it("refuses an applied migration absent from the exact local source", async () => {
    for (const row of local) await record(row.name, row.checksum);
    await record("20260102000000_external", "external");
    expect((await inspectMigrationDeploy(client, local)).problems).toContain("unknown_applied:20260102000000_external");
  });
  it("executes the actual CLI successfully only for a coherent source-bound ledger", async () => {
    const sources = readdirSync("prisma/migrations").filter(name => /^\d{14}_[a-z0-9_]+$/.test(name));
    expect(sources.length).toBeGreaterThan(10);
    for (const name of sources) await record(name, createHash("sha256").update(readFileSync(`prisma/migrations/${name}/migration.sql`)).digest("hex"));
    const before = await client.$queryRawUnsafe('SELECT * FROM public."_prisma_migrations" ORDER BY migration_name');
    const result = spawnSync(process.execPath, ["scripts/migration-deploy-preflight.mjs"], {
      encoding: "utf8", timeout: 15000,
      env: { NODE_ENV: "test", DATABASE_URL: `postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket!)}` },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ readOnly: true, problems: [], deployAllowed: true });
    expect(await client.$queryRawUnsafe('SELECT * FROM public."_prisma_migrations" ORDER BY migration_name')).toEqual(before);
  });
  it("executes the actual CLI failure without resolving a failed ledger entry", async () => {
    await record(unsafe, "original-checksum", false);
    const before = await client.$queryRawUnsafe('SELECT * FROM public."_prisma_migrations"');
    const result = spawnSync(process.execPath, ["scripts/migration-deploy-preflight.mjs"], {
      encoding: "utf8", timeout: 15000,
      env: { NODE_ENV: "test", DATABASE_URL: `postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket!)}` },
    });
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).problems).toContain(`unfinished:${unsafe}`);
    expect(await client.$queryRawUnsafe('SELECT * FROM public."_prisma_migrations"')).toEqual(before);
  });
});
