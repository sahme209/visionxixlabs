import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { realpathSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createDatabaseClient } from '../createDatabaseClient';
const socket = process.env.AXIOM_PRISMA7_PG_SOCKET;
/** Opt-in owned local cluster only; never accepts DATABASE_URL or TCP. */
describe.skipIf(!socket)('actual Prisma 7 adapter transactions on owned PostgreSQL', () => {
  let db: ReturnType<typeof createDatabaseClient>;
  beforeAll(async () => {
    if (!socket || !/^\/private\/tmp\/axiom-prisma7-pg-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket) throw new Error('owned_prisma7_fixture_required');
    const stat = statSync(socket);
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw new Error('owned_prisma7_fixture_required');
    db = createDatabaseClient(`postgresql://axiom_fixture@localhost/axiom_prisma7_fixture?host=${encodeURIComponent(socket)}&connection_limit=3&connect_timeout=3&pool_timeout=3`);
    const [row] = await db.$queryRawUnsafe<Array<{ owned: boolean }>>("SELECT current_database()='axiom_prisma7_fixture' AND current_user='axiom_fixture' AND current_setting('listen_addresses')='' AS owned");
    if (!row?.owned) throw new Error('owned_prisma7_fixture_required');
    const marker = await db.$queryRawUnsafe<Array<{ marker: string }>>('SELECT marker FROM axiom_prisma7_fixture_marker');
    if (marker.length !== 1 || marker[0].marker !== process.env.AXIOM_PRISMA7_PG_MARKER) throw new Error('owned_prisma7_fixture_required');
  });
  afterAll(async () => { await db?.$disconnect(); });
  const data = (id: string) => ({ id, organizationId: 'synthetic_org', workflowKind: 'prisma7_adapter_fixture', objective: 'Synthetic adapter transaction proof', autonomyLevel: 'review', inputJson: { fixture: true, values: [1, 'two'] }, stateJson: {}, requestedByUserId: 'synthetic_owner' });
  it('round-trips generated JSON/date fields and maps duplicate writes to P2002', async () => {
    const id = randomUUID(); const row = await db.durableAgentWorkflow.create({ data: data(id) });
    expect(row.inputJson).toEqual({ fixture: true, values: [1, 'two'] });
    expect(row.updatedAt).toBeInstanceOf(Date);
    await expect(db.durableAgentWorkflow.create({ data: data(id) })).rejects.toMatchObject({ code: 'P2002' });
    expect(await db.durableAgentWorkflow.count({ where: { id } })).toBe(1);
  });
  it('rolls back both workflow and child evidence atomically', async () => {
    const id = randomUUID();
    await expect(db.$transaction(async tx => {
      await tx.durableAgentWorkflow.create({ data: data(id) });
      await tx.durableAgentWorkflowEvent.create({ data: { workflowRunId: id, organizationId: 'synthetic_org', sequence: 1, eventType: 'fixture', actorKind: 'test', detailJson: {} } });
      throw new Error('deliberate_fixture_rollback');
    })).rejects.toThrow('deliberate_fixture_rollback');
    expect(await db.durableAgentWorkflow.count({ where: { id } })).toBe(0);
    expect(await db.durableAgentWorkflowEvent.count({ where: { workflowRunId: id } })).toBe(0);
  });
  it('retains serializable conflict detection as P2034 instead of silently losing a write', async () => {
    const id = randomUUID(); await db.durableAgentWorkflow.create({ data: data(id) });
    let arrived = 0; let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const increment = () => db.$transaction(async tx => {
      const row = await tx.durableAgentWorkflow.findUniqueOrThrow({ where: { id } });
      if (++arrived === 2) release();
      await barrier;
      return tx.durableAgentWorkflow.update({ where: { id }, data: { version: row.version + 1 } });
    }, { isolationLevel: 'Serializable', timeout: 10_000, maxWait: 3_000 });
    const results = await Promise.allSettled([increment(), increment()]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find(result => result.status === 'rejected');
    expect(refused?.status === 'rejected' ? refused.reason : undefined).toMatchObject({ code: 'P2034' });
    expect((await db.durableAgentWorkflow.findUniqueOrThrow({ where: { id } })).version).toBe(1);
  }, 15_000);
});
