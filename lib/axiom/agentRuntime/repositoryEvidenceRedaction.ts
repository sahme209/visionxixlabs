import { isSensitiveRepositoryEvidencePath } from "./repositoryEvidencePolicy";

/** Redact structured legacy snapshots without modifying their stored audit record. */
export function redactSensitiveRepositoryEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveRepositoryEvidence);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (typeof record.path === "string" && isSensitiveRepositoryEvidencePath(record.path)) {
    return { path: record.path, evidenceRestricted: true };
  }
  return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, redactSensitiveRepositoryEvidence(entry)]));
}
