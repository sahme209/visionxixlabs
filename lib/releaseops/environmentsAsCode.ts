/**
 * Environments as code (parity: config as code, lifecycles in Git). Pure.
 *
 * Export the workspace's environments (name, tier, order, tags and change window) as a canonical file to
 * review and version in Git, preview a changed file against what is stored, and plan the changes. The
 * plan never deletes an environment and never changes an existing environment's tier: environments left
 * out of the file are reported and kept, and a tier change is refused so production protection cannot be
 * lowered from a file. Applying is a separate, admin-only, compare-and-set write.
 */
import { createHash } from "node:crypto";
import { ALL_ENVIRONMENT_TIERS } from "./environmentCreateResponder";
import { canonicalJson, parseChangeWindowRule, type ChangeWindowRule } from "./environmentChangeWindow";
import { normalizeTags } from "./environmentTags";

export const ENVIRONMENTS_DOCUMENT_KIND = "v19.environments";
export const ENVIRONMENTS_DOCUMENT_VERSION = 1;
export const MAX_ENVIRONMENTS_IN_FILE = 100;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export interface StoredEnvironmentRow { id: string; slug: string; name: string; tier: string; displayOrder: number; tags: string[]; changeWindowRuleJson: unknown; updatedAt: Date }
export interface EnvironmentFileEntry { slug: string; name: string; tier: string; displayOrder: number; tags: string[]; changeWindow: ChangeWindowRule | null }
export interface EnvironmentsDocument { kind: typeof ENVIRONMENTS_DOCUMENT_KIND; version: typeof ENVIRONMENTS_DOCUMENT_VERSION; environments: EnvironmentFileEntry[] }
export type EnvironmentsPlanOp =
  | { op: "create"; environment: EnvironmentFileEntry }
  | { op: "update"; environment: EnvironmentFileEntry; id: string; expectedUpdatedAt: string; fields: string[] };
export interface EnvironmentsPlan { ops: EnvironmentsPlanOp[]; unchanged: number; keptOutOfFile: string[]; loosening: string[]; refused: string[] }

const entryOf = (r: StoredEnvironmentRow): EnvironmentFileEntry => {
  const rule = parseChangeWindowRule(r.changeWindowRuleJson);
  return { slug: r.slug, name: r.name, tier: r.tier, displayOrder: r.displayOrder, tags: [...r.tags].sort(), changeWindow: rule.kind === "rule" ? rule.rule : null };
};

export function exportEnvironmentsDocument(rows: readonly StoredEnvironmentRow[]): string {
  const environments = [...rows].sort((a, b) => a.displayOrder - b.displayOrder || (a.slug < b.slug ? -1 : 1)).map((r) => {
    const e = entryOf(r);
    return { slug: e.slug, name: e.name, tier: e.tier, displayOrder: e.displayOrder, tags: e.tags, changeWindow: e.changeWindow === null ? null : JSON.parse(canonicalJson(e.changeWindow)) };
  });
  return `${JSON.stringify({ kind: ENVIRONMENTS_DOCUMENT_KIND, version: ENVIRONMENTS_DOCUMENT_VERSION, environments }, null, 2)}\n`;
}

export function parseEnvironmentsDocument(text: string): { ok: true; document: EnvironmentsDocument } | { ok: false; errors: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ["The file is not valid JSON."] }; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["The file must be a JSON object."] };
  const r = raw as Record<string, unknown>;
  if (r.kind !== ENVIRONMENTS_DOCUMENT_KIND || r.version !== ENVIRONMENTS_DOCUMENT_VERSION) return { ok: false, errors: [`Set "kind" to "${ENVIRONMENTS_DOCUMENT_KIND}" and "version" to ${ENVIRONMENTS_DOCUMENT_VERSION}.`] };
  if (!Array.isArray(r.environments) || r.environments.length > MAX_ENVIRONMENTS_IN_FILE) return { ok: false, errors: [`"environments" must list up to ${MAX_ENVIRONMENTS_IN_FILE} environments.`] };
  const errors: string[] = []; const environments: EnvironmentFileEntry[] = []; const seen = new Set<string>();
  r.environments.forEach((e, i) => {
    const at = `environments.${i}`;
    if (!e || typeof e !== "object" || Array.isArray(e)) { errors.push(`${at}: must be an object`); return; }
    const x = e as Record<string, unknown>;
    const unknownKeys = Object.keys(x).filter((k) => !["slug", "name", "tier", "displayOrder", "tags", "changeWindow"].includes(k));
    if (unknownKeys.length) { errors.push(`${at}: unknown field ${unknownKeys.map((k) => `"${k}"`).join(", ")}`); return; }
    if (typeof x.slug !== "string" || !SLUG_RE.test(x.slug)) { errors.push(`${at}.slug: lowercase letters, digits and hyphens, up to 32 characters`); return; }
    if (seen.has(x.slug)) { errors.push(`${at}.slug: "${x.slug}" appears twice`); return; }
    if (typeof x.name !== "string" || !x.name.trim() || x.name.length > 80) { errors.push(`${at}.name: required, up to 80 characters`); return; }
    if (typeof x.tier !== "string" || !(ALL_ENVIRONMENT_TIERS as readonly string[]).includes(x.tier)) { errors.push(`${at}.tier: one of ${ALL_ENVIRONMENT_TIERS.join(", ")}`); return; }
    const displayOrder = x.displayOrder ?? 0;
    if (typeof displayOrder !== "number" || !Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 10_000) { errors.push(`${at}.displayOrder: a whole number from 0 to 10000`); return; }
    const rawTags = x.tags ?? [];
    if (!Array.isArray(rawTags) || rawTags.some((t) => typeof t !== "string")) { errors.push(`${at}.tags: a list of key:value labels`); return; }
    const tags = normalizeTags(rawTags as string[]);
    if (!tags.ok) { errors.push(`${at}.tags: not allowed: ${tags.invalid.join(", ")}`); return; }
    const rule = parseChangeWindowRule(x.changeWindow ?? null);
    if (rule.kind === "unreadable") { errors.push(`${at}.changeWindow: ${rule.error}`); return; }
    seen.add(x.slug);
    environments.push({ slug: x.slug, name: x.name.trim(), tier: x.tier, displayOrder, tags: tags.tags, changeWindow: rule.kind === "rule" ? rule.rule : null });
  });
  return errors.length ? { ok: false, errors } : { ok: true, document: { kind: ENVIRONMENTS_DOCUMENT_KIND, version: ENVIRONMENTS_DOCUMENT_VERSION, environments } };
}

export function planEnvironments(stored: readonly StoredEnvironmentRow[], doc: EnvironmentsDocument): EnvironmentsPlan {
  const bySlug = new Map(stored.map((s) => [s.slug, s]));
  const ops: EnvironmentsPlanOp[] = []; const loosening: string[] = []; const refused: string[] = []; let unchanged = 0;
  for (const e of doc.environments) {
    const s = bySlug.get(e.slug);
    if (!s) { ops.push({ op: "create", environment: e }); continue; }
    if (s.tier !== e.tier) { refused.push(`${e.slug}: tier is ${s.tier} and cannot be changed from a file`); continue; }
    const cur = entryOf(s);
    const fields: string[] = [];
    if (cur.name !== e.name) fields.push("name");
    if (cur.displayOrder !== e.displayOrder) fields.push("displayOrder");
    if (canonicalJson(cur.tags) !== canonicalJson(e.tags)) fields.push("tags");
    if (canonicalJson(cur.changeWindow) !== canonicalJson(e.changeWindow)) fields.push("changeWindow");
    if (!fields.length) { unchanged += 1; continue; }
    ops.push({ op: "update", environment: e, id: s.id, expectedUpdatedAt: s.updatedAt.toISOString(), fields });
    if (fields.includes("changeWindow")) {
      if (cur.changeWindow && !e.changeWindow) loosening.push(`${e.slug}: change window removed, deployments allowed at any time`);
      else if (cur.changeWindow && e.changeWindow && e.changeWindow.freezes.length < cur.changeWindow.freezes.length) loosening.push(`${e.slug}: fewer freezes`);
    }
    if (fields.includes("tags")) {
      const ring = (t: string[]) => t.find((x) => x.startsWith("ring:")) ?? null;
      if (ring(cur.tags) && !ring(e.tags)) loosening.push(`${e.slug}: ring tag removed, so the previous-ring gate no longer applies`);
    }
  }
  const inFile = new Set(doc.environments.map((e) => e.slug));
  const keptOutOfFile = stored.filter((s) => !inFile.has(s.slug)).map((s) => s.slug).sort();
  return { ops, unchanged, keptOutOfFile, loosening, refused };
}

export function environmentsDigest(rows: readonly StoredEnvironmentRow[]): string {
  const material = [...rows].sort((a, b) => (a.slug < b.slug ? -1 : 1)).map((r) => `${r.id}|${r.updatedAt.toISOString()}`).join("\n");
  return createHash("sha256").update(exportEnvironmentsDocument(rows)).update("\n").update(material).digest("hex");
}
