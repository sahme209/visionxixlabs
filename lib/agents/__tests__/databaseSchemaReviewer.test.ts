import { describe, it, expect, beforeEach } from "vitest";
import {
  reviewSchema,
  summarizeFindings,
  __resetSchemaFindingCounter,
  type SchemaSnapshot,
  type SchemaTable,
} from "../databaseSchemaReviewer";

function column(name: string, overrides: Partial<{ indexed: boolean; foreignKey: boolean; primaryKey: boolean; nullable: boolean; type: string }> = {}) {
  return {
    name,
    type: overrides.type ?? "text",
    nullable: overrides.nullable ?? true,
    indexed: overrides.indexed ?? false,
    foreignKey: overrides.foreignKey ?? false,
    primaryKey: overrides.primaryKey ?? false,
  };
}

function table(name: string, columns: ReturnType<typeof column>[], overrides: Partial<SchemaTable> = {}): SchemaTable {
  return {
    name,
    rowCountEstimate: 0,
    daysSinceLastWrite: 0,
    columns,
    indexes: [],
    foreignKeys: [],
    ...overrides,
  };
}

beforeEach(() => __resetSchemaFindingCounter());

describe("reviewSchema", () => {
  it("flags table without a primary key (postgres)", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [table("orders", [column("name", { nullable: false })])],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "primary_key_missing")).toBe(true);
  });

  it("does NOT flag missing pk for mongodb", () => {
    const snap: SchemaSnapshot = {
      vendor: "mongodb",
      tables: [table("orders", [column("name")])],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "primary_key_missing")).toBe(false);
  });

  it("flags wide table at 40+ columns", () => {
    const cols = Array.from({ length: 41 }, (_, i) => column(`c${i}`));
    cols[0] = { ...cols[0], primaryKey: true, nullable: false };
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [table("big_table", cols)],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "wide_table")).toBe(true);
  });

  it("flags stale table after 180 days", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [
        table(
          "audit_archive",
          [column("id", { primaryKey: true, nullable: false })],
          { daysSinceLastWrite: 365 },
        ),
      ],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "stale_table")).toBe(true);
  });

  it("flags FK-shaped column that isn't a declared FK + target exists", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [
        table("users", [column("id", { primaryKey: true, nullable: false })]),
        table("orders", [
          column("id", { primaryKey: true, nullable: false }),
          column("user_id", { foreignKey: false }),
        ]),
      ],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "missing_foreign_key" && f.column === "user_id")).toBe(true);
  });

  it("does NOT flag FK-shaped column when target table doesn't exist", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [
        table("orders", [
          column("id", { primaryKey: true, nullable: false }),
          column("ghost_id", { foreignKey: false }),
        ]),
      ],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "missing_foreign_key")).toBe(false);
  });

  it("flags missing index on a foreign-key column for a large table", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [
        table(
          "orders",
          [
            column("id", { primaryKey: true, nullable: false }),
            column("customer_id", { foreignKey: true, indexed: false }),
          ],
          { rowCountEstimate: 50_000 },
        ),
      ],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "missing_index" && f.column === "customer_id")).toBe(true);
  });

  it("skips missing-index finding for small tables", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [
        table(
          "tiny",
          [
            column("id", { primaryKey: true, nullable: false }),
            column("ref_id", { foreignKey: true, indexed: false }),
          ],
          { rowCountEstimate: 100 },
        ),
      ],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "missing_index")).toBe(false);
  });

  it("flags duplicate indexes covering the same columns", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [
        table(
          "orders",
          [column("id", { primaryKey: true, nullable: false }), column("status")],
          {
            indexes: [
              { name: "idx_status_a", columns: ["status"], unique: false },
              { name: "idx_status_b", columns: ["status"], unique: false },
            ],
          },
        ),
      ],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "duplicate_index")).toBe(true);
  });

  it("flags naming drift for camelCase table names in postgres", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [
        table("UserAccounts", [column("id", { primaryKey: true, nullable: false })]),
      ],
    };
    const r = reviewSchema(snap);
    const drift = r.find((f) => f.category === "naming_drift" && f.column === null);
    expect(drift).toBeDefined();
    if (drift && drift.recommendation.kind === "rename_to") {
      expect(drift.recommendation.suggested).toBe("user_accounts");
    }
  });

  it("orphan column only flagged on tables with > 10 columns", () => {
    const cols = Array.from({ length: 12 }, (_, i) => column(`col_${i}`));
    cols[0] = { ...cols[0], primaryKey: true, nullable: false };
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [table("wide", cols)],
    };
    const r = reviewSchema(snap);
    expect(r.some((f) => f.category === "orphan_column")).toBe(true);
  });

  it("summarizeFindings aggregates", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [
        table("orders", [column("name")]), // no pk
      ],
    };
    const r = reviewSchema(snap);
    const s = summarizeFindings(r);
    expect(s.total).toBeGreaterThan(0);
    expect(s.bySeverity.high).toBeGreaterThanOrEqual(1);
  });

  it("issues sequential ids", () => {
    const snap: SchemaSnapshot = {
      vendor: "postgresql",
      tables: [table("orders", [column("name")])],
    };
    const a = reviewSchema(snap);
    const b = reviewSchema(snap);
    // Counter is process-wide; second call IDs come after first.
    expect(a[0].id).toMatch(/^schf-/);
    expect(b[0].id).not.toBe(a[0].id);
  });
});
