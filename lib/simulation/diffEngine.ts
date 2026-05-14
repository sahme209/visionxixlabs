/**
 * Before / After Diff Engine.
 *
 * Produces typed field-level diffs from a ChangeAction. Redacts forbidden
 * keys (secret / token / password / client_secret) so the diff is safe
 * to render in the UI + ship to desktop. Never includes raw provider
 * blobs.
 */

import type { ChangeAction } from "@/lib/simulation/changeSetModel";
import type { DigitalTwinRiskLevel } from "@/lib/digitalTwin/digitalTwinModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffOp = "added" | "removed" | "changed" | "unchanged" | "redacted";

export interface FieldDiff {
  field: string;
  op: DiffOp;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
  riskBefore: DigitalTwinRiskLevel;
  riskAfter:  DigitalTwinRiskLevel;
  explanation: string;
  reversible: boolean;
  verificationMethod: string;
}

export interface DiffBundle {
  actionId: string;
  fields: FieldDiff[];
  /** Highest risk delta across all field diffs in this action. */
  riskDelta: "decreased" | "unchanged" | "increased" | "mixed";
  /** Number of fields redacted from the surface for safety. */
  redactedCount: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const FORBIDDEN_KEY_FRAGMENTS = [
  "password", "secret", "token", "client_secret", "client-secret",
  "private_key", "privatekey", "api_key", "apikey", "credential",
  "authorization", "passphrase", "external_id", "external-id",
];

function isForbiddenKey(field: string): boolean {
  const lower = field.toLowerCase();
  return FORBIDDEN_KEY_FRAGMENTS.some((f) => lower.includes(f));
}

// ---------------------------------------------------------------------------
// Risk inference per field
// ---------------------------------------------------------------------------

const HIGH_RISK_FIELDS = ["public", "publicread", "openaccess", "anyone", "blockpublicacls", "cidr"];
const SECURITY_FIELDS  = ["encryption", "kms", "signed", "mfa", "rotation", "policy"];

function fieldRisk(field: string, value: string | number | boolean | null): DigitalTwinRiskLevel {
  const lower = field.toLowerCase();
  // Public-access fields with truthy values are high risk.
  if (HIGH_RISK_FIELDS.some((f) => lower.includes(f))) {
    if (value === true || value === "true" || value === "0.0.0.0/0") return "high";
    if (value === false || value === "false") return "low";
    return "medium";
  }
  if (SECURITY_FIELDS.some((f) => lower.includes(f))) {
    if (value === true || value === "AES256" || value === "KMS") return "low";
    if (value === false || value === "disabled") return "high";
    return "medium";
  }
  return "low";
}

// ---------------------------------------------------------------------------
// Verification method per field
// ---------------------------------------------------------------------------

function verificationMethodFor(field: string): string {
  const lower = field.toLowerCase();
  if (lower.includes("public") || lower.includes("blockpublic")) return "Re-run public-access scan and confirm flag is false.";
  if (lower.includes("encryption")) return "Inspect resource and confirm encryption-at-rest is reported enabled.";
  if (lower.includes("cidr"))       return "Re-run security-group scan and confirm wide ingress is absent.";
  if (lower.includes("protection")) return "Re-validate branch protection via GitHub API.";
  if (lower.includes("backup"))     return "Confirm a recent backup exists in the provider console.";
  return "Re-run the underlying check and confirm the field reflects the new value.";
}

// ---------------------------------------------------------------------------
// Public diff
// ---------------------------------------------------------------------------

export function diffChangeAction(action: ChangeAction): DiffBundle {
  const seen = new Set<string>([...Object.keys(action.before), ...Object.keys(action.after)]);
  const fields: FieldDiff[] = [];
  let redactedCount = 0;

  const rank: Record<DigitalTwinRiskLevel, number> = {
    critical: 4, high: 3, medium: 2, low: 1, unknown: 0,
  };
  let decreased = 0, increased = 0, unchanged = 0;

  for (const field of seen) {
    if (isForbiddenKey(field)) {
      redactedCount += 1;
      fields.push({
        field,
        op: "redacted",
        before: "[redacted]",
        after:  "[redacted]",
        riskBefore: "low",
        riskAfter:  "low",
        explanation: "Field redacted — never surfaced or transmitted.",
        reversible: action.reversible,
        verificationMethod: "Sensitive value — verify out-of-band.",
      });
      continue;
    }

    const before = action.before[field] ?? null;
    const after  = action.after[field]  ?? null;
    const op: DiffOp = before === null && after !== null ? "added"
      : after === null && before !== null ? "removed"
      : before === after ? "unchanged" : "changed";

    const riskBefore = fieldRisk(field, before);
    const riskAfter  = fieldRisk(field, after);
    if (rank[riskAfter] < rank[riskBefore])      decreased += 1;
    else if (rank[riskAfter] > rank[riskBefore]) increased += 1;
    else                                          unchanged += 1;

    fields.push({
      field,
      op,
      before,
      after,
      riskBefore,
      riskAfter,
      explanation: explanationFor(field, op, before, after),
      reversible: action.reversible,
      verificationMethod: verificationMethodFor(field),
    });
  }

  const riskDelta: DiffBundle["riskDelta"] =
    decreased > 0 && increased === 0 ? "decreased"
    : increased > 0 && decreased === 0 ? "increased"
    : decreased === 0 && increased === 0 ? "unchanged"
    : "mixed";

  return {
    actionId: action.id,
    fields,
    riskDelta,
    redactedCount,
    generatedAt: new Date().toISOString(),
  };
}

function explanationFor(field: string, op: DiffOp, before: unknown, after: unknown): string {
  if (op === "unchanged") return `${field} is unchanged.`;
  if (op === "added")     return `${field} is added with value ${JSON.stringify(after)}.`;
  if (op === "removed")   return `${field} is removed (was ${JSON.stringify(before)}).`;
  if (op === "redacted")  return `${field} value redacted before rendering.`;
  return `${field}: ${JSON.stringify(before)} → ${JSON.stringify(after)}.`;
}

export function diffChangeActions(actions: ChangeAction[]): DiffBundle[] {
  return actions.map(diffChangeAction);
}
