import { describe, expect, it } from "vitest";
import { environmentsDigest, exportEnvironmentsDocument, parseEnvironmentsDocument, planEnvironments, type StoredEnvironmentRow } from "../environmentsAsCode";

const t = new Date("2026-11-27T00:00:00Z");
const rule = { weekdays: ["Tue", "Wed"], utcWindows: [{ start: "09:00", end: "17:00" }], freezes: [{ startUtc: "2026-12-20T00:00:00Z", endUtc: "2027-01-03T00:00:00Z", reason: "Holiday freeze" }] };
const rows: StoredEnvironmentRow[] = [
  { id: "e2", slug: "prod", name: "Production", tier: "prod", displayOrder: 2, tags: ["ring:2"], changeWindowRuleJson: rule, updatedAt: t },
  { id: "e1", slug: "dev", name: "Dev", tier: "dev", displayOrder: 0, tags: [], changeWindowRuleJson: null, updatedAt: t },
];
const parse = (text: string) => { const r = parseEnvironmentsDocument(text); if (!r.ok) throw new Error(r.errors.join("; ")); return r.document; };

describe("environments as code", () => {
  it("exports in display order and round-trips to an empty plan", () => {
    const text = exportEnvironmentsDocument(rows);
    const doc = parse(text);
    expect(doc.environments.map((e) => e.slug)).toEqual(["dev", "prod"]);
    const plan = planEnvironments(rows, doc);
    expect(plan).toMatchObject({ ops: [], unchanged: 2, keptOutOfFile: [], loosening: [], refused: [] });
  });
  it("plans creates and field updates, and keeps environments left out of the file", () => {
    const doc = parse(JSON.stringify({ kind: "v19.environments", version: 1, environments: [
      { slug: "dev", name: "Development", tier: "dev", displayOrder: 0, tags: ["Region:EU"] },
      { slug: "qa", name: "QA", tier: "qa", displayOrder: 1 },
    ] }));
    const plan = planEnvironments(rows, doc);
    expect(plan.ops).toEqual([
      expect.objectContaining({ op: "update", id: "e1", fields: ["name", "tags"], expectedUpdatedAt: t.toISOString() }),
      expect.objectContaining({ op: "create", environment: expect.objectContaining({ slug: "qa", tags: [], changeWindow: null }) }),
    ]);
    expect(plan.ops[0].environment.tags).toEqual(["region:eu"]);
    expect(plan.keptOutOfFile).toEqual(["prod"]);
  });
  it("refuses tier changes and flags loosened windows, freezes and rings", () => {
    const doc = parse(JSON.stringify({ kind: "v19.environments", version: 1, environments: [
      { slug: "dev", name: "Dev", tier: "prod", displayOrder: 0 },
      { slug: "prod", name: "Production", tier: "prod", displayOrder: 2, tags: [], changeWindow: null },
    ] }));
    const plan = planEnvironments(rows, doc);
    expect(plan.refused).toEqual(["dev: tier is dev and cannot be changed from a file"]);
    expect(plan.loosening).toEqual(["prod: change window removed, deployments allowed at any time", "prod: ring tag removed, so the previous-ring gate no longer applies"]);
    const fewer = parse(JSON.stringify({ kind: "v19.environments", version: 1, environments: [{ slug: "prod", name: "Production", tier: "prod", displayOrder: 2, tags: ["ring:2"], changeWindow: { ...rule, freezes: [] } }] }));
    expect(planEnvironments(rows, fewer).loosening).toEqual(["prod: fewer freezes"]);
  });
  it("reports precise errors for bad files", () => {
    expect(parseEnvironmentsDocument("nope")).toEqual({ ok: false, errors: ["The file is not valid JSON."] });
    expect(parseEnvironmentsDocument(JSON.stringify({ kind: "v19.checks", version: 1 })).ok).toBe(false);
    const r = parseEnvironmentsDocument(JSON.stringify({ kind: "v19.environments", version: 1, environments: [
      { slug: "Bad Slug", name: "x", tier: "dev" }, { slug: "a", name: "A", tier: "live" }, { slug: "b", name: "B", tier: "dev", extra: 1 },
      { slug: "c", name: "C", tier: "dev", tags: ["nolabel"] }, { slug: "d", name: "D", tier: "dev", changeWindow: { weekdays: ["Funday"] } },
      { slug: "e", name: "E", tier: "dev" }, { slug: "e", name: "E", tier: "dev" },
    ] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toHaveLength(6);
      expect(r.errors[0]).toMatch(/^environments\.0\.slug/);
      expect(r.errors[1]).toMatch(/^environments\.1\.tier/);
      expect(r.errors[2]).toMatch(/unknown field "extra"/);
      expect(r.errors[3]).toMatch(/^environments\.3\.tags: not allowed: nolabel/);
      expect(r.errors[4]).toMatch(/^environments\.4\.changeWindow/);
      expect(r.errors[5]).toMatch(/"e" appears twice/);
    }
  });
  it("digest changes when a row changes even if the export would not", () => {
    const a = environmentsDigest(rows);
    expect(environmentsDigest([...rows].reverse())).toBe(a);
    expect(environmentsDigest([{ ...rows[0], updatedAt: new Date("2026-11-28T00:00:00Z") }, rows[1]])).not.toBe(a);
  });
});
