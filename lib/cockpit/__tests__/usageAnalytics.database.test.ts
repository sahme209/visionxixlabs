import { expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { readUsageAnalytics } from '../usageAnalytics';
import { readUsageRecords } from '../usageRecords';
const databaseUrl = process.env.AXIOM_COCKPIT_USAGE_TEST_DATABASE_URL;
/** Requires an explicitly supplied disposable Unix-socket cluster. Uses a
 * transaction-local temporary table, dropped on commit, never a live ledger. */
it.skipIf(!databaseUrl)('aggregates the real PostgreSQL ledger with tenant and UTC month boundaries', async () => {
  const target = new URL(databaseUrl!);
  if (target.protocol !== 'postgresql:' || target.hostname !== 'localhost' || target.password || [...target.searchParams.keys()].some(key => key !== 'host') || target.searchParams.getAll('host').length !== 1 || !/^(\/private)?\/tmp\/axiom-usage-pg\.[A-Za-z0-9]+\/socket$/.test(target.searchParams.get('host') ?? '')) throw Error('disposable_local_usage_database_required');
  target.searchParams.set('schema', 'pg_temp');
  const db = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  try {
    await db.$transaction(async tx => {
      await tx.$executeRaw`CREATE TEMPORARY TABLE "UsageEvent" (id text PRIMARY KEY, "organizationId" text NOT NULL, "eventKind" text NOT NULL, provider text, model text, "inputTokens" integer NOT NULL, "outputTokens" integer NOT NULL, "billedCents" integer NOT NULL, "billingStatus" text NOT NULL, "createdAt" timestamp(3) NOT NULL) ON COMMIT DROP`;
      // Deliberately use a non-UTC session to exercise explicit UTC boundaries.
      await tx.$executeRaw`SET LOCAL TIME ZONE 'America/New_York'`;
      await tx.$executeRaw`INSERT INTO "UsageEvent" VALUES
        ('a','org-one','ai_invocation','gateway','model-a',200,50,7,'settled','2026-10-02T23:59:59.999'),
        ('transaction-pending','org-one','ai_invocation','gateway','model-b',300,100,999,'pending','2026-10-03T00:00:00'),
        ('c','org-other','ai_invocation','other','private',10000,10000,9999,'settled','2026-10-02T12:00:00'),
        ('d','org-one','ai_invocation','gateway','prior',4000,0,100,'settled','2026-09-30T23:59:59.999'),
        ('e','org-one','automation_run','gateway','non-ai',5000,0,200,'settled','2026-10-03T00:00:00'),
        ('f','org-one','ai_invocation','other','model-a',10,0,0,'failed','2026-10-03T00:00:00')`;
      const now = new Date('2026-10-22T12:00:00Z');
      const all = await readUsageAnalytics(tx, 'org-one', new URLSearchParams(), now);
      expect(all.totals).toEqual({ calls: 3, inputTokens: 510, outputTokens: 150, settledCents: 7, pendingCalls: 1 });
      expect(all.days[1].inputTokens).toBe(200); expect(all.days[2].inputTokens).toBe(310);
      const pending = await readUsageAnalytics(tx, 'org-one', new URLSearchParams('status=pending&group=provider'), now);
      expect(pending.totals.settledCents).toBe(0); expect(pending.groups[0].label).toBe('gateway');
      const ledger = await readUsageRecords(tx, 'org-one', new URLSearchParams('status=pending'), now);
      expect(ledger.rows).toHaveLength(1); expect(ledger.rows[0].id).toBe('transaction-pending'); expect(ledger.rows[0].settledCents).toBeNull();
      expect((await readUsageAnalytics(tx, 'org-one', new URLSearchParams('month=2026-08'), now)).totals.calls).toBe(0);
      await tx.$executeRaw`INSERT INTO "UsageEvent" SELECT 'extra-'||i, 'org-one','ai_invocation','gateway','extra-model-'||i,1,0,0,'settled','2026-10-04'::timestamp FROM generate_series(1,13) i`;
      const many = await readUsageAnalytics(tx, 'org-one', new URLSearchParams(), now);
      expect(many.groupsLimited).toBe(true); expect(many.groups).toHaveLength(12); expect(many.totals.calls).toBe(16);
    }, { timeout: 20000 });
  } finally { await db.$disconnect(); }
});
