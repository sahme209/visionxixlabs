/**
 * Pure slow-query proposer.
 *
 * Input: a list of slow-query rows (text + execution stats) + the
 * relevant schema slice. Output: a typed proposal per query —
 * add_index / rewrite_query / partition_table / no_action — with
 * confidence + reasoning.
 *
 * Pure / deterministic. The kernel only proposes; the approval
 * engine + migration coordinator carry out the staged change.
 */

import type { SchemaTable } from "./databaseSchemaReviewer";

export type SlowQueryProposalKind =
  | "add_index"
  | "rewrite_query"
  | "partition_table"
  | "denormalize"
  | "no_action";

export type RiskTier = "low" | "medium" | "high";

export interface SlowQueryRow {
  id: string;
  /** Full SQL text. */
  sql: string;
  /** Estimated p95 execution time in ms. */
  p95Ms: number;
  /** Total executions in the audit window. */
  callsInWindow: number;
  /** Total time (ms) the query has consumed in the window. */
  totalTimeMs: number;
  /** Mean rows returned per call. */
  meanRows: number;
  /** Plan summary (e.g. "Seq Scan on orders cost=0.00..N rows=M"). */
  planSummary: string;
}

export interface SlowQueryProposal {
  id: string;
  queryId: string;
  kind: SlowQueryProposalKind;
  /** Target table (best-effort parsed from the query). */
  table: string | null;
  /** When kind=add_index, the columns proposed. */
  indexColumns: readonly string[];
  riskTier: RiskTier;
  /** Confidence 0..1. */
  confidence: number;
  /** Operator-readable rationale. */
  rationale: string;
  /** Suggested CREATE INDEX statement when applicable. */
  ddl: string | null;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `slq-${counter}`;
}
export function __resetSlowQueryCounter(): void { counter = 0; }

// ─── Minimal SQL extractors ───────────────────────────────────────
// Pure regex-based — we never claim to be a real parser. The kernel
// only needs to identify the dominant table + obvious filter columns.

const FROM_PATTERN = /\bfrom\s+([a-zA-Z_][\w.]*)/i;
const WHERE_COLUMNS_PATTERN = /\bwhere\b([\s\S]+?)(?:\bgroup\b|\border\b|\blimit\b|\bunion\b|$)/i;
const SIMPLE_PRED_PATTERN = /([a-zA-Z_][\w.]*)\s*(?:=|<|>|<=|>=|!=|in\s*\(|like)/gi;
const ORDER_BY_PATTERN = /\border\s+by\s+([a-zA-Z_][\w.]*)/i;

function extractTable(sql: string): string | null {
  const m = FROM_PATTERN.exec(sql);
  if (!m) return null;
  // Strip schema prefix if present: schema.table → table
  return m[1].split(".").pop() ?? null;
}

function extractFilterColumns(sql: string): readonly string[] {
  const w = WHERE_COLUMNS_PATTERN.exec(sql);
  if (!w) return [];
  const block = w[1];
  const seen = new Set<string>();
  for (const m of block.matchAll(SIMPLE_PRED_PATTERN)) {
    const col = m[1].split(".").pop()!;
    // Skip noise like AND / OR / NOT misclassified
    if (/^(and|or|not|null|true|false)$/i.test(col)) continue;
    seen.add(col);
  }
  return [...seen];
}

function extractOrderByColumn(sql: string): string | null {
  const m = ORDER_BY_PATTERN.exec(sql);
  if (!m) return null;
  return m[1].split(".").pop() ?? null;
}

const SEQ_SCAN_PATTERN  = /seq\s*scan/i;
const FULL_SCAN_PATTERN = /full\s*(table\s*)?scan/i;

export interface ProposeContext {
  /** Schema slice the kernel can consult to check existing indexes. */
  tables: readonly SchemaTable[];
}

export function proposeForSlowQueries(
  rows: readonly SlowQueryRow[],
  ctx: ProposeContext,
): readonly SlowQueryProposal[] {
  const proposals: SlowQueryProposal[] = [];
  for (const row of rows) {
    proposals.push(proposeOne(row, ctx));
  }
  // Sort: highest-impact first (totalTimeMs desc).
  return [...proposals].sort((a, b) => {
    const rowA = rows.find((r) => r.id === a.queryId);
    const rowB = rows.find((r) => r.id === b.queryId);
    return (rowB?.totalTimeMs ?? 0) - (rowA?.totalTimeMs ?? 0);
  });
}

function proposeOne(row: SlowQueryRow, ctx: ProposeContext): SlowQueryProposal {
  const table = extractTable(row.sql);
  const filterCols = extractFilterColumns(row.sql);
  const orderCol = extractOrderByColumn(row.sql);

  // Heuristic 1: very-cheap queries we don't optimise.
  if (row.p95Ms < 50 && row.totalTimeMs < 60_000) {
    return {
      id: nextId(),
      queryId: row.id,
      kind: "no_action",
      table,
      indexColumns: [],
      riskTier: "low",
      confidence: 0.95,
      rationale: "Query is already fast enough — no action.",
      ddl: null,
    };
  }

  // Heuristic 2: SELECT … OFFSET … LIMIT with high offset → rewrite.
  if (/offset\s+\d{4,}/i.test(row.sql)) {
    return {
      id: nextId(),
      queryId: row.id,
      kind: "rewrite_query",
      table,
      indexColumns: [],
      riskTier: "medium",
      confidence: 0.7,
      rationale: "Large OFFSET — rewrite to keyset pagination (e.g. WHERE id > last_id ORDER BY id LIMIT N).",
      ddl: null,
    };
  }

  // Heuristic 3: plan summary mentions seq / full scan + we can identify table + filter columns → add_index.
  const hasScanSignal = SEQ_SCAN_PATTERN.test(row.planSummary) || FULL_SCAN_PATTERN.test(row.planSummary);
  if (hasScanSignal && table && filterCols.length > 0) {
    // Skip if the table is small (< 1 000 rows).
    const tbl = ctx.tables.find((t) => t.name === table);
    if (tbl && tbl.rowCountEstimate < 1_000) {
      return {
        id: nextId(),
        queryId: row.id,
        kind: "no_action",
        table,
        indexColumns: [],
        riskTier: "low",
        confidence: 0.85,
        rationale: "Seq scan on a small table is fine — index would not help.",
        ddl: null,
      };
    }
    // Skip if the index already exists.
    const proposed = orderCol ? [...filterCols, orderCol] : filterCols;
    const alreadyHas =
      tbl?.indexes.some((i) => arraysShallowEqual(i.columns, proposed)) ?? false;
    if (alreadyHas) {
      return {
        id: nextId(),
        queryId: row.id,
        kind: "rewrite_query",
        table,
        indexColumns: [],
        riskTier: "medium",
        confidence: 0.45,
        rationale: "Filter index exists but plan still scans — rewrite query (force index / split predicates).",
        ddl: null,
      };
    }
    const cols = uniq(proposed);
    const indexName = `idx_${table}_${cols.join("_")}`.slice(0, 60);
    return {
      id: nextId(),
      queryId: row.id,
      kind: "add_index",
      table,
      indexColumns: cols,
      riskTier: "low",
      confidence: 0.78,
      rationale: `Seq scan on ${table.toString()} for filter columns ${cols.join(", ")}. Index unblocks lookups + ORDER BY.`,
      ddl: `CREATE INDEX CONCURRENTLY ${indexName} ON ${table} (${cols.join(", ")});`,
    };
  }

  // Heuristic 4: very-large table with high traffic → partition.
  const tbl = ctx.tables.find((t) => t.name === table);
  if (tbl && tbl.rowCountEstimate > 50_000_000 && row.callsInWindow > 10_000) {
    return {
      id: nextId(),
      queryId: row.id,
      kind: "partition_table",
      table,
      indexColumns: [],
      riskTier: "high",
      confidence: 0.6,
      rationale: `Table ${table} has ${tbl.rowCountEstimate.toLocaleString()} rows + ${row.callsInWindow.toLocaleString()} calls/window. Time-partition candidate.`,
      ddl: null,
    };
  }

  // Fallback: investigate but no specific proposal.
  return {
    id: nextId(),
    queryId: row.id,
    kind: "no_action",
    table,
    indexColumns: [],
    riskTier: "low",
    confidence: 0.4,
    rationale: "No obvious optimisation surfaced. Investigate manually.",
    ddl: null,
  };
}

function uniq<T>(arr: readonly T[]): T[] {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function arraysShallowEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
