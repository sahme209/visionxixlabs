/**
 * Pure body parser for the migration stage endpoint — Phase 374.
 *
 * Validates the JSON body shape into a typed MigrationDescriptor +
 * optional connector. Lives in lib/workforce so it can be unit-tested
 * independent of the route's Prisma + auth pipeline.
 */

import type { MigrationDescriptor, MigrationKind } from "@/lib/agents/migrationCoordinator";

const MIGRATION_KINDS: readonly MigrationKind[] = [
  "add_column",
  "drop_column",
  "rename_column",
  "add_table",
  "drop_table",
  "alter_index",
  "alter_api_contract",
];

const CONNECTORS = ["postgres", "mysql"] as const;
export type MigrationConnector = (typeof CONNECTORS)[number];

export type ParseMigrationStageResult =
  | { ok: true; descriptor: MigrationDescriptor; connector: MigrationConnector }
  | { ok: false; reason: "invalid_body"; detail: string };

export function parseMigrationStageBody(raw: unknown): ParseMigrationStageResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "invalid_body", detail: "Body must be a JSON object." };
  }
  const b = raw as Record<string, unknown>;

  // kind
  const kind = b.kind;
  if (typeof kind !== "string" || !MIGRATION_KINDS.includes(kind as MigrationKind)) {
    return { ok: false, reason: "invalid_body", detail: `kind must be one of ${MIGRATION_KINDS.join(", ")}` };
  }

  // target
  const target = b.target;
  if (typeof target !== "string" || target.trim().length === 0 || target.length > 128) {
    return { ok: false, reason: "invalid_body", detail: "target must be a non-empty string ≤ 128 chars." };
  }

  // rationale
  const rationale = b.rationale;
  if (typeof rationale !== "string" || rationale.trim().length === 0 || rationale.length > 2000) {
    return { ok: false, reason: "invalid_body", detail: "rationale must be a non-empty string ≤ 2000 chars." };
  }

  // hasReverseScript + hasActiveWriters (booleans)
  const hasReverseScript = b.hasReverseScript;
  if (typeof hasReverseScript !== "boolean") {
    return { ok: false, reason: "invalid_body", detail: "hasReverseScript must be a boolean." };
  }
  const hasActiveWriters = b.hasActiveWriters;
  if (typeof hasActiveWriters !== "boolean") {
    return { ok: false, reason: "invalid_body", detail: "hasActiveWriters must be a boolean." };
  }

  // estimatedRowCount — non-negative integer up to 1e12 (sanity bound).
  const estimatedRowCount = b.estimatedRowCount;
  if (typeof estimatedRowCount !== "number" || !Number.isFinite(estimatedRowCount) || estimatedRowCount < 0 || estimatedRowCount > 1e12) {
    return { ok: false, reason: "invalid_body", detail: "estimatedRowCount must be a non-negative number ≤ 1e12." };
  }

  // windowHours — 0–168 (one week max).
  const windowHours = b.windowHours;
  if (typeof windowHours !== "number" || !Number.isFinite(windowHours) || windowHours < 0 || windowHours > 168) {
    return { ok: false, reason: "invalid_body", detail: "windowHours must be a number between 0 and 168." };
  }

  // connector (optional, defaults to postgres)
  const connectorRaw = b.connector;
  let connector: MigrationConnector = "postgres";
  if (connectorRaw !== undefined) {
    if (typeof connectorRaw !== "string" || !CONNECTORS.includes(connectorRaw as MigrationConnector)) {
      return { ok: false, reason: "invalid_body", detail: `connector must be one of ${CONNECTORS.join(", ")}` };
    }
    connector = connectorRaw as MigrationConnector;
  }

  // id — derived deterministically from operator-supplied fields when
  // omitted, so two identical submissions don't generate noise.
  const id = typeof b.id === "string" && b.id.length > 0 ? b.id : `mig_${kind}_${target}_${Date.now().toString(36)}`;

  const descriptor: MigrationDescriptor = {
    id,
    kind: kind as MigrationKind,
    target: target.trim(),
    rationale: rationale.trim(),
    hasReverseScript,
    hasActiveWriters,
    estimatedRowCount: Math.floor(estimatedRowCount),
    windowHours: Math.floor(windowHours),
  };

  return { ok: true, descriptor, connector };
}
