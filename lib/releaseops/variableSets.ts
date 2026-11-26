/**
 * Variable sets (parity item: library variable sets). Pure.
 *
 * A set is a named group of variables shared by many environments. V19 attaches a set by an
 * environment tag selector (for example "region:eu" or "tenant:*") instead of by hand, so new
 * environments with the right tags pick it up. Set variables are stored as ConfigVariable rows with
 * scopeKey "set:<slug>". Precedence: workspace default < matching sets < environment override.
 * When two matching sets give the same key different values, the result is reported as a conflict
 * and the set whose slug sorts last wins, so resolution stays deterministic.
 */
import { parseSelector } from "./environmentTags";
import { scopeKeyFor, WORKSPACE_SCOPE, type ResolvedVariable, type StoredVariable } from "./scopedVariables";

export const MAX_VARIABLE_SETS = 50;
export interface VariableSetDef { slug: string; name: string; selector: string }
export interface SetConflict { key: string; sets: string[] }
export type SetDefinitionError = "slug_invalid" | "name_invalid" | "selector_invalid";
export const SET_ERROR_TEXT: Record<SetDefinitionError, string> = {
  slug_invalid: "Use 1 to 48 lowercase letters, digits or hyphens for the set's short name.",
  name_invalid: "Give the set a name of up to 80 characters.",
  selector_invalid: "Use one to five key:value tag terms, for example region:eu or tenant:*.",
};
const SLUG = /^[a-z0-9][a-z0-9-]{0,47}$/;

export const setScopeKey = (slug: string) => `set:${slug}`;

export function validateSetDefinition(input: VariableSetDef): SetDefinitionError[] {
  const errors: SetDefinitionError[] = [];
  if (!SLUG.test(input.slug)) errors.push("slug_invalid");
  const name = input.name.trim();
  if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name)) errors.push("name_invalid");
  if (!parseSelector(input.selector).ok) errors.push("selector_invalid");
  return errors;
}

export function selectorMatches(tags: readonly string[], selector: string): boolean {
  const parsed = parseSelector(selector);
  if (!parsed.ok) return false;
  return parsed.terms.every((t) => tags.some((tag) => { const i = tag.indexOf(":"); return tag.slice(0, i) === t.key && (t.value === "*" || tag.slice(i + 1) === t.value); }));
}

/** Sets that apply to an environment with these tags, in slug order. */
export function matchingSets(tags: readonly string[], sets: readonly VariableSetDef[]): VariableSetDef[] {
  return sets.filter((s) => selectorMatches(tags, s.selector)).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

export function resolveWithSets(variables: readonly StoredVariable[], environment: { id: string; tags: readonly string[] }, sets: readonly VariableSetDef[]): { resolved: ResolvedVariable[]; conflicts: SetConflict[]; appliedSets: string[] } {
  const out = new Map<string, ResolvedVariable>();
  for (const v of variables) if (v.scopeKey === WORKSPACE_SCOPE) out.set(v.key, { key: v.key, value: v.value, source: "workspace" });
  const applied = matchingSets(environment.tags, sets);
  const fromSets = new Map<string, Array<{ set: string; value: string }>>();
  for (const set of applied) {
    const scope = setScopeKey(set.slug);
    for (const v of variables) if (v.scopeKey === scope) {
      (fromSets.get(v.key) ?? fromSets.set(v.key, []).get(v.key)!).push({ set: set.slug, value: v.value });
      out.set(v.key, { key: v.key, value: v.value, source: "set", set: set.slug });
    }
  }
  const envScope = scopeKeyFor(environment.id);
  const overridden = new Set<string>();
  for (const v of variables) if (v.scopeKey === envScope) { out.set(v.key, { key: v.key, value: v.value, source: "environment" }); overridden.add(v.key); }
  const conflicts: SetConflict[] = [...fromSets.entries()]
    .filter(([key, entries]) => !overridden.has(key) && new Set(entries.map((e) => e.value)).size > 1)
    .map(([key, entries]) => ({ key, sets: entries.map((e) => e.set) }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
  return { resolved: [...out.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)), conflicts, appliedSets: applied.map((s) => s.slug) };
}

/** Keys some environments resolve (through an override or a set) but others do not, with no workspace default. */
export function gapsFromResolved(perEnvironment: ReadonlyArray<{ environmentId: string; variables: readonly ResolvedVariable[] }>): Array<{ key: string; missingIn: string[] }> {
  const keys = new Set<string>();
  for (const e of perEnvironment) for (const v of e.variables) if (v.source !== "workspace") keys.add(v.key);
  return [...keys].sort().flatMap((key) => {
    if (perEnvironment.some((e) => e.variables.some((v) => v.key === key && v.source === "workspace"))) return [];
    const missingIn = perEnvironment.filter((e) => !e.variables.some((v) => v.key === key)).map((e) => e.environmentId);
    return missingIn.length ? [{ key, missingIn }] : [];
  });
}
