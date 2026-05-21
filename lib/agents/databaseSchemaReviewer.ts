/**
 * Pure database schema reviewer.
 *
 * Input: a typed snapshot of a database schema — tables, columns,
 * indexes, foreign keys. Output: a typed list of findings, each with
 * a closed-union category + severity + recommendation.
 *
 * Pure / deterministic. No I/O. Caller fetches the snapshot from the
 * connector (when wired) and hands it to this kernel. Findings feed
 * the approval engine; nothing mutates the schema.
 */

export type SchemaFindingCategory =
  | "missing_index"
  | "missing_foreign_key"
  | "orphan_column"
  | "primary_key_missing"
  | "wide_table"
  | "naming_drift"
  | "stale_table"
  | "duplicate_index";

export type FindingSeverity = "info" | "warn" | "high";

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  /** True when the column has an index (single or composite). */
  indexed: boolean;
  /** True when the column is part of a foreign key constraint. */
  foreignKey: boolean;
  /** True when the column is part of the primary key. */
  primaryKey: boolean;
}

export interface SchemaIndex {
  name: string;
  columns: readonly string[];
  unique: boolean;
}

export interface SchemaTable {
  name: string;
  rowCountEstimate: number;
  /** Days since the last write — used to flag stale tables. */
  daysSinceLastWrite: number;
  columns: readonly SchemaColumn[];
  indexes: readonly SchemaIndex[];
  /** Foreign key relationships originating from this table. */
  foreignKeys: ReadonlyArray<{ fromColumn: string; toTable: string; toColumn: string }>;
}

export interface SchemaSnapshot {
  /** Database vendor — drives some naming rules. */
  vendor: "postgresql" | "mysql" | "mongodb";
  tables: readonly SchemaTable[];
}

export interface SchemaFinding {
  id: string;
  table: string;
  column: string | null;
  category: SchemaFindingCategory;
  severity: FindingSeverity;
  /** Operator-readable explanation. */
  rationale: string;
  /** Closed-union recommendation kind, when there's an actionable fix. */
  recommendation:
    | { kind: "add_index"; columns: readonly string[] }
    | { kind: "add_foreign_key"; toTable: string; toColumn: string }
    | { kind: "add_primary_key"; suggestedColumn: string }
    | { kind: "rename_to"; suggested: string }
    | { kind: "investigate" };
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `schf-${counter}`;
}
export function __resetSchemaFindingCounter(): void { counter = 0; }

const NAMING_PATTERNS: Record<SchemaSnapshot["vendor"], RegExp> = {
  // snake_case for relational dbs; mongodb collections we allow either.
  postgresql: /^[a-z][a-z0-9_]*$/,
  mysql:      /^[a-z][a-z0-9_]*$/,
  mongodb:    /^[a-zA-Z][a-zA-Z0-9_]*$/,
};

const WIDE_TABLE_THRESHOLD = 40;
const STALE_TABLE_DAYS = 180;

// Columns that "look foreign-key-ish" — name ends in _id but isn't
// declared as a foreign key.
const FK_SUSPECT_PATTERN = /^([a-z]+(?:_[a-z]+)*)_id$/;

export function reviewSchema(snapshot: SchemaSnapshot): readonly SchemaFinding[] {
  const findings: SchemaFinding[] = [];
  const tableNames = new Set(snapshot.tables.map((t) => t.name));

  for (const table of snapshot.tables) {
    // 1. Primary key check
    const pkColumns = table.columns.filter((c) => c.primaryKey);
    if (pkColumns.length === 0 && snapshot.vendor !== "mongodb") {
      findings.push({
        id: nextId(),
        table: table.name,
        column: null,
        category: "primary_key_missing",
        severity: "high",
        rationale: `Table ${table.name} has no primary key — orphan rows + unsafe replication.`,
        recommendation: { kind: "add_primary_key", suggestedColumn: "id" },
      });
    }

    // 2. Wide table check
    if (table.columns.length >= WIDE_TABLE_THRESHOLD) {
      findings.push({
        id: nextId(),
        table: table.name,
        column: null,
        category: "wide_table",
        severity: "warn",
        rationale: `Table ${table.name} has ${table.columns.length} columns — split candidate.`,
        recommendation: { kind: "investigate" },
      });
    }

    // 3. Stale table check
    if (table.daysSinceLastWrite >= STALE_TABLE_DAYS) {
      findings.push({
        id: nextId(),
        table: table.name,
        column: null,
        category: "stale_table",
        severity: "info",
        rationale: `Table ${table.name} hasn't been written to in ${table.daysSinceLastWrite}d. Archive candidate.`,
        recommendation: { kind: "investigate" },
      });
    }

    // 4. Naming drift check
    const pattern = NAMING_PATTERNS[snapshot.vendor];
    if (!pattern.test(table.name)) {
      findings.push({
        id: nextId(),
        table: table.name,
        column: null,
        category: "naming_drift",
        severity: "info",
        rationale: `Table ${table.name} doesn't follow ${snapshot.vendor} naming convention.`,
        recommendation: { kind: "rename_to", suggested: toSnake(table.name) },
      });
    }

    // 5. Duplicate index check
    const seenIndexShapes = new Map<string, string>();
    for (const idx of table.indexes) {
      const key = idx.columns.join("|");
      const prior = seenIndexShapes.get(key);
      if (prior) {
        findings.push({
          id: nextId(),
          table: table.name,
          column: null,
          category: "duplicate_index",
          severity: "warn",
          rationale: `Indexes ${prior} and ${idx.name} cover the same columns (${idx.columns.join(", ")}) — drop one.`,
          recommendation: { kind: "investigate" },
        });
      } else {
        seenIndexShapes.set(key, idx.name);
      }
    }

    // 6. Per-column checks
    for (const col of table.columns) {
      // 6a. Naming drift
      if (!pattern.test(col.name)) {
        findings.push({
          id: nextId(),
          table: table.name,
          column: col.name,
          category: "naming_drift",
          severity: "info",
          rationale: `Column ${table.name}.${col.name} doesn't follow ${snapshot.vendor} naming.`,
          recommendation: { kind: "rename_to", suggested: toSnake(col.name) },
        });
      }

      // 6b. Looks foreign-key-ish but isn't declared as one
      const m = FK_SUSPECT_PATTERN.exec(col.name);
      if (m && !col.foreignKey) {
        const guessTable = `${m[1]}s`;
        if (tableNames.has(guessTable)) {
          findings.push({
            id: nextId(),
            table: table.name,
            column: col.name,
            category: "missing_foreign_key",
            severity: "high",
            rationale: `Column ${table.name}.${col.name} looks like a foreign key but isn't declared — orphan-row risk.`,
            recommendation: { kind: "add_foreign_key", toTable: guessTable, toColumn: "id" },
          });
        }
      }

      // 6c. Foreign-key column without an index → join performance hit
      if (col.foreignKey && !col.indexed && table.rowCountEstimate > 1000) {
        findings.push({
          id: nextId(),
          table: table.name,
          column: col.name,
          category: "missing_index",
          severity: "warn",
          rationale: `FK column ${table.name}.${col.name} is not indexed; joins will scan ${table.rowCountEstimate.toLocaleString()} rows.`,
          recommendation: { kind: "add_index", columns: [col.name] },
        });
      }

      // 6d. Orphan column: looks unused (no PK, no FK, no index, not in any composite index, nullable)
      const inAnyIndex = table.indexes.some((i) => i.columns.includes(col.name));
      if (!col.primaryKey && !col.foreignKey && !col.indexed && !inAnyIndex && col.nullable) {
        // Only flag at info level — not all unused columns need action.
        // Cap the noise: only flag for tables with > 10 columns.
        if (table.columns.length > 10) {
          findings.push({
            id: nextId(),
            table: table.name,
            column: col.name,
            category: "orphan_column",
            severity: "info",
            rationale: `Column ${table.name}.${col.name} is nullable, unindexed, not in any composite index, not a FK — orphan candidate.`,
            recommendation: { kind: "investigate" },
          });
        }
      }
    }
  }

  return findings;
}

function toSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

export interface SchemaReviewSummary {
  total: number;
  byCategory: Readonly<Record<SchemaFindingCategory, number>>;
  bySeverity: Readonly<Record<FindingSeverity, number>>;
}

export function summarizeFindings(findings: readonly SchemaFinding[]): SchemaReviewSummary {
  const byCategory: Record<SchemaFindingCategory, number> = {
    missing_index: 0, missing_foreign_key: 0, orphan_column: 0,
    primary_key_missing: 0, wide_table: 0, naming_drift: 0,
    stale_table: 0, duplicate_index: 0,
  };
  const bySeverity: Record<FindingSeverity, number> = { info: 0, warn: 0, high: 0 };
  for (const f of findings) {
    byCategory[f.category] += 1;
    bySeverity[f.severity] += 1;
  }
  return { total: findings.length, byCategory, bySeverity };
}
