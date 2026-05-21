import { describe, it, expect, beforeEach } from "vitest";
import {
  proposeForSlowQueries,
  __resetSlowQueryCounter,
  type SlowQueryRow,
  type ProposeContext,
} from "../slowQueryProposer";
import type { SchemaTable } from "../databaseSchemaReviewer";

function row(overrides: Partial<SlowQueryRow> & { id: string; sql: string }): SlowQueryRow {
  return {
    id: overrides.id,
    sql: overrides.sql,
    p95Ms: 800,
    callsInWindow: 1_000,
    totalTimeMs: 600_000,
    meanRows: 50,
    planSummary: "Seq Scan on orders rows=100000",
    ...overrides,
  };
}

function table(name: string, rows: number, indexes: { name: string; columns: string[] }[] = []): SchemaTable {
  return {
    name,
    rowCountEstimate: rows,
    daysSinceLastWrite: 0,
    columns: [],
    indexes: indexes.map((i) => ({ name: i.name, columns: i.columns, unique: false })),
    foreignKeys: [],
  };
}

const CTX: ProposeContext = { tables: [table("orders", 100_000)] };

beforeEach(() => __resetSlowQueryCounter());

describe("proposeForSlowQueries", () => {
  it("very-fast query → no_action", () => {
    const r = proposeForSlowQueries(
      [row({ id: "q1", sql: "SELECT * FROM orders WHERE id = 1", p95Ms: 5, totalTimeMs: 100 })],
      CTX,
    );
    expect(r[0].kind).toBe("no_action");
  });

  it("OFFSET pagination → rewrite_query", () => {
    const r = proposeForSlowQueries(
      [row({ id: "q1", sql: "SELECT * FROM orders WHERE state='open' ORDER BY id LIMIT 50 OFFSET 50000" })],
      CTX,
    );
    expect(r[0].kind).toBe("rewrite_query");
    expect(r[0].rationale).toMatch(/keyset/i);
  });

  it("seq scan + filter cols + large table → add_index with DDL", () => {
    const r = proposeForSlowQueries(
      [row({
        id: "q1",
        sql: "SELECT * FROM orders WHERE customer_id = $1 AND status = $2",
        planSummary: "Seq Scan on orders",
      })],
      CTX,
    );
    expect(r[0].kind).toBe("add_index");
    expect(r[0].indexColumns).toContain("customer_id");
    expect(r[0].indexColumns).toContain("status");
    expect(r[0].ddl).toMatch(/CREATE INDEX/i);
  });

  it("seq scan on small table → no_action", () => {
    const r = proposeForSlowQueries(
      [row({ id: "q1", sql: "SELECT * FROM orders WHERE customer_id = $1" })],
      { tables: [table("orders", 100)] },
    );
    expect(r[0].kind).toBe("no_action");
    expect(r[0].rationale).toMatch(/small table/i);
  });

  it("index already exists → rewrite_query suggestion", () => {
    const r = proposeForSlowQueries(
      [row({
        id: "q1",
        sql: "SELECT * FROM orders WHERE customer_id = $1 AND status = $2",
        planSummary: "Seq Scan on orders",
      })],
      { tables: [table("orders", 100_000, [{ name: "idx_orders_x", columns: ["customer_id", "status"] }])] },
    );
    expect(r[0].kind).toBe("rewrite_query");
  });

  it("massive table + high traffic → partition_table", () => {
    const r = proposeForSlowQueries(
      [row({
        id: "q1",
        sql: "SELECT count(*) FROM events WHERE recorded_at > now() - interval '1 day'",
        planSummary: "Index Scan", // no seq scan → falls through to partition branch
        callsInWindow: 50_000,
      })],
      { tables: [table("events", 80_000_000)] },
    );
    expect(r[0].kind).toBe("partition_table");
    expect(r[0].riskTier).toBe("high");
  });

  it("ORDER BY column included in proposed index columns", () => {
    const r = proposeForSlowQueries(
      [row({
        id: "q1",
        sql: "SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at",
        planSummary: "Seq Scan on orders",
      })],
      CTX,
    );
    if (r[0].kind === "add_index") {
      expect(r[0].indexColumns).toContain("created_at");
    } else {
      throw new Error("expected add_index");
    }
  });

  it("rows are sorted by totalTimeMs desc", () => {
    const rows = [
      row({ id: "small", sql: "SELECT * FROM orders WHERE x=1", planSummary: "Seq Scan", totalTimeMs: 100_000 }),
      row({ id: "big",   sql: "SELECT * FROM orders WHERE y=1", planSummary: "Seq Scan", totalTimeMs: 1_000_000 }),
    ];
    const r = proposeForSlowQueries(rows, CTX);
    expect(r[0].queryId).toBe("big");
    expect(r[1].queryId).toBe("small");
  });

  it("DDL is well-formed when add_index is chosen", () => {
    const r = proposeForSlowQueries(
      [row({
        id: "q1",
        sql: "SELECT * FROM orders WHERE status=$1",
        planSummary: "Seq Scan on orders",
      })],
      CTX,
    );
    if (r[0].kind === "add_index") {
      expect(r[0].ddl).toMatch(/CREATE INDEX CONCURRENTLY/i);
      expect(r[0].ddl).toContain("orders");
    }
  });

  it("no table extracted → falls back to no_action", () => {
    const r = proposeForSlowQueries(
      [row({ id: "q1", sql: "SELECT 1", planSummary: "Result", p95Ms: 100, totalTimeMs: 200_000 })],
      CTX,
    );
    expect(r[0].kind).toBe("no_action");
  });
});
