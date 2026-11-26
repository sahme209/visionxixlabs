/**
 * Runbook library as a file (parity item: step/runbook library kept in the repository).
 *
 * Teams keep their own runbooks in a reviewed JSON file (for example `.v19/runbooks.json`) and load it
 * into Saved Tasks. Pure and shared by the desktop app and the website: parsing never runs anything,
 * every loaded runbook only fills an unsaved draft, and the same review/approval footer is appended to
 * every instruction so a library file cannot remove it. Secret-looking text is refused, never stored.
 */
import { RUNBOOK_TEMPLATES, type RunbookTemplate } from "./runbookTemplates";

export const RUNBOOK_LIBRARY_KIND = "v19.runbooks/v1";
export const RUNBOOK_LIBRARY_MAX_BYTES = 64 * 1024;
export const RUNBOOK_LIBRARY_MAX_RUNBOOKS = 50;
const FOOTER = "Prepare the plan and evidence only. Do not change anything until the action has been reviewed and approved in V19.";
const ID = /^[a-z0-9][a-z0-9-]{1,62}$/;
const SECRET_PATTERNS: readonly RegExp[] = [
  /AKIA[0-9A-Z]{16}/, /gh[pousr]_[A-Za-z0-9]{20,}/, /xox[abposr]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S{6,}/i, /vxlk_[A-Za-z0-9]{8,}/,
];

export type LibraryRunbook = RunbookTemplate & { source: "library" };
export type RunbookLibraryResult =
  | { ok: true; runbooks: LibraryRunbook[] }
  | { ok: false; error: string };

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t) ? t : null;
};

export function parseRunbookLibrary(raw: string): RunbookLibraryResult {
  if (new TextEncoder().encode(raw).length > RUNBOOK_LIBRARY_MAX_BYTES) return { ok: false, error: "The file is larger than 64 KB." };
  if (SECRET_PATTERNS.some((p) => p.test(raw))) return { ok: false, error: "The file contains text that looks like a credential. Remove it; runbooks name credentials, never include their values." };
  let doc: unknown;
  try { doc = JSON.parse(raw); } catch { return { ok: false, error: "The file is not valid JSON." }; }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, error: "The file must be a JSON object." };
  const { kind, runbooks } = doc as Record<string, unknown>;
  if (kind !== RUNBOOK_LIBRARY_KIND) return { ok: false, error: `Set "kind" to "${RUNBOOK_LIBRARY_KIND}".` };
  if (!Array.isArray(runbooks) || runbooks.length === 0 || runbooks.length > RUNBOOK_LIBRARY_MAX_RUNBOOKS) return { ok: false, error: `"runbooks" must list 1 to ${RUNBOOK_LIBRARY_MAX_RUNBOOKS} runbooks.` };
  const builtIn = new Set(RUNBOOK_TEMPLATES.map((t) => t.id));
  const seen = new Set<string>();
  const out: LibraryRunbook[] = [];
  for (const [index, entry] of runbooks.entries()) {
    const where = `Runbook ${index + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { ok: false, error: `${where} must be an object.` };
    const r = entry as Record<string, unknown>;
    const id = typeof r.id === "string" && ID.test(r.id) ? r.id : null;
    if (!id) return { ok: false, error: `${where}: "id" must be 2 to 63 lowercase letters, digits or hyphens.` };
    if (builtIn.has(id) || seen.has(id)) return { ok: false, error: `${where}: the id "${id}" is already used.` };
    const title = text(r.title, 120), summary = text(r.summary, 200);
    if (!title || !summary) return { ok: false, error: `${where}: "title" (up to 120 characters) and "summary" (up to 200) are required.` };
    if (!Array.isArray(r.steps) || r.steps.length === 0 || r.steps.length > 12) return { ok: false, error: `${where}: "steps" must list 1 to 12 steps.` };
    const steps = r.steps.map((s) => text(s, 400));
    if (steps.some((s) => !s)) return { ok: false, error: `${where}: each step must be text of up to 400 characters.` };
    const fields = r.context === undefined ? [] : Array.isArray(r.context) ? r.context.map((c) => text(c, 80)) : [null];
    if (fields.length > 10 || fields.some((f) => !f)) return { ok: false, error: `${where}: "context" must list up to 10 field labels of up to 80 characters.` };
    seen.add(id);
    out.push({
      id, title, summary, source: "library",
      instruction: `${title}.\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n${FOOTER}`,
      context: fields.map((f) => `${String(f).replace(/:$/, "")}:`).join("\n"),
    });
  }
  return { ok: true, runbooks: out };
}

/** The built-in runbooks in the library file format, as a starting point for a team's own file. */
export function exampleRunbookLibrary(): string {
  const example = {
    kind: RUNBOOK_LIBRARY_KIND,
    runbooks: [{
      id: "drain-node", title: "Drain a node before maintenance", summary: "Move workloads off one node and confirm nothing is left behind.",
      steps: ["List the workloads on the node from recorded inventory.", "Propose cordon and drain through the governed change for this environment.", "State how to confirm the workloads are healthy elsewhere.", "State how to return the node to service."],
      context: ["Cluster", "Node", "Maintenance window"],
    }],
  };
  return `${JSON.stringify(example, null, 2)}\n`;
}
