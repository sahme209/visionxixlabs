/**
 * Deployment checks as code (parity: config as code). Pure.
 *
 * Export the workspace's checks as a canonical file to review and version in Git, preview a changed file
 * against what is stored, and plan the changes. Applying is a separate, admin-only, compare-and-set write
 * that disables (never deletes) checks the file leaves out, so history stays intact.
 */
import { createHash } from "node:crypto";
import { validateCheck, type ValidatedCheck } from "./deploymentChecks";

export const CHECKS_DOCUMENT_KIND = "v19.checks";
export const CHECKS_DOCUMENT_VERSION = 1;
export interface StoredCheckRow { key: string; name: string; kind: string; stage: string; mode: string; spec: unknown; enabled: boolean; version: number }
export interface ChecksFileEntry extends ValidatedCheck { enabled: boolean }
export interface ChecksDocument { kind: typeof CHECKS_DOCUMENT_KIND; version: typeof CHECKS_DOCUMENT_VERSION; checks: ChecksFileEntry[] }
export type ChecksPlanOp =
  | { op: "create"; check: ChecksFileEntry }
  | { op: "update"; check: ChecksFileEntry; expectedVersion: number; fields: string[] }
  | { op: "disable"; key: string; expectedVersion: number };
export interface ChecksPlan { ops: ChecksPlanOp[]; unchanged: number; loosening: string[] }

const canon = (v: unknown): string => (v === null || typeof v !== "object" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canon).join(",")}]` : `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}`);

export function exportChecksDocument(rows: readonly StoredCheckRow[]): string {
  const checks = [...rows].sort((a, b) => (a.key < b.key ? -1 : 1)).map((r) => ({ key: r.key, name: r.name, kind: r.kind, stage: r.stage, mode: r.mode, enabled: r.enabled, spec: JSON.parse(canon(r.spec ?? {})) }));
  return `${JSON.stringify({ kind: CHECKS_DOCUMENT_KIND, version: CHECKS_DOCUMENT_VERSION, checks }, null, 2)}\n`;
}

export function parseChecksDocument(text: string): { ok: true; document: ChecksDocument } | { ok: false; errors: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ["The file is not valid JSON."] }; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["The file must be a JSON object."] };
  const r = raw as Record<string, unknown>;
  if (r.kind !== CHECKS_DOCUMENT_KIND || r.version !== CHECKS_DOCUMENT_VERSION) return { ok: false, errors: [`Set "kind" to "${CHECKS_DOCUMENT_KIND}" and "version" to ${CHECKS_DOCUMENT_VERSION}.`] };
  if (!Array.isArray(r.checks) || r.checks.length > 200) return { ok: false, errors: ['"checks" must list up to 200 checks.'] };
  const errors: string[] = []; const checks: ChecksFileEntry[] = []; const seen = new Set<string>();
  r.checks.forEach((c, i) => {
    if (!c || typeof c !== "object" || Array.isArray(c)) { errors.push(`checks.${i}: must be an object`); return; }
    const { enabled, ...rest } = c as Record<string, unknown>;
    if (enabled !== undefined && typeof enabled !== "boolean") { errors.push(`checks.${i}.enabled: must be true or false`); return; }
    const v = validateCheck(rest);
    if (!v.ok) { errors.push(...v.errors.map((e) => `checks.${i}.${e}`)); return; }
    if (seen.has(v.check.key)) { errors.push(`checks.${i}.key: "${v.check.key}" appears twice`); return; }
    seen.add(v.check.key); checks.push({ ...v.check, enabled: enabled ?? true });
  });
  return errors.length ? { ok: false, errors } : { ok: true, document: { kind: CHECKS_DOCUMENT_KIND, version: CHECKS_DOCUMENT_VERSION, checks } };
}

export function planChecks(stored: readonly StoredCheckRow[], doc: ChecksDocument): ChecksPlan {
  const byKey = new Map(stored.map((s) => [s.key, s]));
  const ops: ChecksPlanOp[] = []; const loosening: string[] = []; let unchanged = 0;
  for (const c of doc.checks) {
    const s = byKey.get(c.key);
    if (!s) { ops.push({ op: "create", check: c }); continue; }
    const fields = (["name", "kind", "stage", "mode", "enabled"] as const).filter((f) => s[f] !== c[f]);
    if (canon(s.spec ?? {}) !== canon(c.spec)) fields.push("spec" as never);
    if (!fields.length) { unchanged += 1; continue; }
    ops.push({ op: "update", check: c, expectedVersion: s.version, fields });
    if (s.mode === "blocking" && c.mode === "advisory") loosening.push(`${c.key}: no longer blocks deployments`);
    if (s.enabled && !c.enabled) loosening.push(`${c.key}: disabled`);
  }
  const inFile = new Set(doc.checks.map((c) => c.key));
  for (const s of stored) if (!inFile.has(s.key) && s.enabled) {
    ops.push({ op: "disable", key: s.key, expectedVersion: s.version });
    if (s.mode === "blocking") loosening.push(`${s.key}: left out of the file, so it will be disabled`);
  }
  return { ops, unchanged, loosening };
}

export function checksDigest(rows: readonly StoredCheckRow[]): string {
  return createHash("sha256").update(exportChecksDocument(rows)).digest("hex");
}
