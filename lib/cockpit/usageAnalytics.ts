import { Prisma } from '@/lib/prismaClient';
import { usageSelection } from './usageRecords';
export interface UsageTotals { calls: number; inputTokens: number; outputTokens: number; settledCents: number; pendingCalls: number }
export interface UsageAnalytics { month: string; group: 'model' | 'provider'; totals: UsageTotals; days: Array<UsageTotals & { day: string }>; groups: Array<UsageTotals & { label: string | null }>; groupsLimited: boolean }
export interface UsageAnalyticsRepo { $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T> }
const empty = (): UsageTotals => ({ calls: 0, inputTokens: 0, outputTokens: 0, settledCents: 0, pendingCalls: 0 });
const keys = ['calls', 'inputTokens', 'outputTokens', 'settledCents', 'pendingCalls'] as const;
function totals(row: Record<string, unknown>): UsageTotals {
  const result = empty();
  for (const key of keys) {
    if (typeof row[key] !== 'bigint' && typeof row[key] !== 'number') throw Error('usage_analytics_unverified');
    const value = Number(row[key]);
    if (!Number.isSafeInteger(value) || value < 0) throw Error('usage_analytics_unverified');
    result[key] = value;
  }
  if (!Number.isSafeInteger(result.inputTokens + result.outputTokens) || result.pendingCalls > result.calls) throw Error('usage_analytics_unverified');
  return result;
}
/** PostgreSQL stores Prisma DateTime values as UTC timestamps. SQL identifiers
 * are static; tenant, date, grouping and filter values are bound parameters.
 * Two aggregate reads avoid transferring raw ledger rows, prompts or actors. */
export async function readUsageAnalytics(db: UsageAnalyticsRepo, organizationId: string, query: URLSearchParams, now = new Date()): Promise<UsageAnalytics> {
  const { month, status, start, end } = usageSelection(query, now);
  const group = query.get('group') ?? 'model';
  if (group !== 'model' && group !== 'provider') throw Error('usage_filter_invalid');
  const scope = Prisma.sql`"organizationId" = ${organizationId} AND "eventKind" = 'ai_invocation' AND "createdAt" >= (${start.toISOString()}::timestamptz AT TIME ZONE 'UTC') AND "createdAt" < (${end.toISOString()}::timestamptz AT TIME ZONE 'UTC') AND (${status} = '' OR "billingStatus" = ${status})`;
  const measures = Prisma.sql`count(*) AS calls, COALESCE(sum("inputTokens"::bigint),0)::bigint AS "inputTokens", COALESCE(sum("outputTokens"::bigint),0)::bigint AS "outputTokens", COALESCE(sum(CASE WHEN "billingStatus" = 'settled' THEN "billedCents"::bigint ELSE 0 END),0)::bigint AS "settledCents", count(*) FILTER (WHERE "billingStatus" = 'pending') AS "pendingCalls"`;
  const label = Prisma.sql`CASE WHEN ${group} = 'provider' THEN "provider" ELSE "model" END`;
  const [daily, grouped] = await Promise.all([
    db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, ${measures} FROM "UsageEvent" WHERE ${scope} GROUP BY day ORDER BY day LIMIT 32`),
    db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`SELECT ${label} AS label, ${measures} FROM "UsageEvent" WHERE ${scope} GROUP BY label ORDER BY sum("inputTokens"::bigint + "outputTokens"::bigint) DESC, label ASC NULLS LAST LIMIT 13`),
  ]);
  if (!Array.isArray(daily) || daily.length > 31 || !Array.isArray(grouped) || grouped.length > 13) throw Error('usage_analytics_unverified');
  const days: UsageAnalytics['days'] = [];
  for (let date = new Date(start); date < end; date.setUTCDate(date.getUTCDate() + 1)) days.push({ day: date.toISOString().slice(0, 10), ...empty() });
  const seen = new Set<string>();
  for (const row of daily) {
    const day = days.find(item => item.day === row.day);
    if (!day || seen.has(day.day)) throw Error('usage_analytics_unverified');
    seen.add(day.day); Object.assign(day, totals(row));
  }
  const sum = empty();
  for (const day of days) for (const key of keys) { sum[key] += day[key]; if (!Number.isSafeInteger(sum[key])) throw Error('usage_analytics_unverified'); }
  if (!Number.isSafeInteger(sum.inputTokens + sum.outputTokens)) throw Error('usage_analytics_unverified');
  const groups = grouped.slice(0, 12).map(row => {
    if (row.label !== null && typeof row.label !== 'string') throw Error('usage_analytics_unverified');
    return { label: row.label as string | null, ...totals(row) };
  });
  return { month, group, totals: sum, days, groups, groupsLimited: grouped.length > 12 };
}
