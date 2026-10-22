/** Read-only, bounded account ledger. Never selects prompts, actor identities,
 * provider costs, metadata or reconciliation identifiers. */
export interface UsageRecord {
  id: string; createdAt: string; provider: string | null; model: string | null;
  status: string; inputTokens: number; outputTokens: number; settledCents: number | null;
}
export interface UsageRecordsPage { month: string; offset: number; hasMore: boolean; rows: UsageRecord[] }
interface LedgerRow {
  id: string; createdAt: Date; provider: string | null; model: string | null;
  billingStatus: string; inputTokens: number; outputTokens: number; billedCents: number;
}
export interface UsageRecordsRepo { usageEvent: { findMany(query: {
  where: { organizationId: string; eventKind: 'ai_invocation'; createdAt: { gte: Date; lt: Date }; billingStatus?: string };
  orderBy: Array<{ createdAt?: 'desc'; id?: 'desc' }>; skip: number; take: number;
  select: { id: true; createdAt: true; provider: true; model: true; billingStatus: true; inputTokens: true; outputTokens: true; billedCents: true };
}): Promise<LedgerRow[]> } }
export async function readUsageRecords(repo: UsageRecordsRepo, organizationId: string, query: URLSearchParams, now = new Date()): Promise<UsageRecordsPage> {
  const currentIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const month = query.get('month') ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const status = query.get('status') ?? '';
  const rawOffset = query.get('offset') ?? '0';
  const offset = Number(rawOffset);
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5));
  const selectedIndex = year * 12 + monthNumber - 1;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || selectedIndex > currentIndex || selectedIndex < currentIndex - 11 || !['', 'settled', 'pending', 'failed'].includes(status) || !/^\d{1,5}$/.test(rawOffset) || offset > 10000 || offset % 50 !== 0) throw Error('usage_filter_invalid');
  const rows = await repo.usageEvent.findMany({
    where: { organizationId, eventKind: 'ai_invocation', createdAt: { gte: new Date(Date.UTC(year, monthNumber - 1, 1)), lt: new Date(Date.UTC(year, monthNumber, 1)) }, ...(status ? { billingStatus: status } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 51,
    select: { id: true, createdAt: true, provider: true, model: true, billingStatus: true, inputTokens: true, outputTokens: true, billedCents: true },
  });
  return { month, offset, hasMore: rows.length > 50 && offset < 10000, rows: rows.slice(0, 50).map(row => ({ id: row.id, createdAt: row.createdAt.toISOString(), provider: row.provider, model: row.model, status: row.billingStatus, inputTokens: row.inputTokens, outputTokens: row.outputTokens, settledCents: row.billingStatus === 'settled' ? row.billedCents : null })) };
}
/** Quote every cell and neutralize formulas before opening in a spreadsheet. */
export function usageCsv(page: UsageRecordsPage): string {
  const cell = (value: string | number | null) => {
    let text = value === null ? '' : String(value);
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [['Date (UTC)', 'Provider', 'Model', 'Status', 'Input tokens', 'Output tokens', 'Settled USD cents'], ...page.rows.map(row => [row.createdAt, row.provider, row.model, row.status, row.inputTokens, row.outputTokens, row.settledCents])].map(row => row.map(cell).join(',')).join('\r\n');
}
