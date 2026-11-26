import { describe, expect, it } from "vitest";
import { exportChecksDocument, parseChecksDocument, planChecks } from "../checksAsCode";

const smoke = { key: "smoke", name: "Smoke", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://shop.example.test/health", expectStatus: 200, maxLatencyMs: 800 }, enabled: true, version: 3 };
describe("checks as code", () => {
  it("exports a canonical file that parses back to the same checks", () => {
    const text = exportChecksDocument([smoke]);
    expect(JSON.parse(text)).toEqual({ kind: "v19.checks", version: 1, checks: [{ key: "smoke", name: "Smoke", kind: "smoke_test", stage: "verify", mode: "blocking", enabled: true, spec: { url: "https://shop.example.test/health", expectStatus: 200, maxLatencyMs: 800 } }] });
    const parsed = parseChecksDocument(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(planChecks([smoke], parsed.document)).toEqual({ ops: [], unchanged: 1, loosening: [] });
  });
  it("plans creates, updates and disables, and lists loosening changes", () => {
    const doc = { kind: "v19.checks", version: 1, checks: [{ ...smoke, mode: "advisory", version: undefined }, { key: "dry-run", name: "Dry run", kind: "migration_dry_run", stage: "validate", mode: "blocking", spec: { workflowPath: ".github/workflows/migrate.yml", job: "dry-run" } }] };
    const parsed = parseChecksDocument(JSON.stringify(doc).replace(',"version":3', ""));
    if (!parsed.ok) throw new Error(parsed.errors.join("; "));
    const plan = planChecks([smoke, { ...smoke, key: "old", version: 1 }], parsed.document);
    expect(plan.ops.map((o) => o.op)).toEqual(["update", "create", "disable"]);
    expect(plan.ops[0]).toMatchObject({ expectedVersion: 3, fields: ["mode"] });
    expect(plan.loosening).toEqual(["smoke: no longer blocks deployments", "old: left out of the file, so it will be disabled"]);
  });
  it("refuses invalid files with readable errors", () => {
    expect(parseChecksDocument("{")).toEqual({ ok: false, errors: ["The file is not valid JSON."] });
    expect(parseChecksDocument('{"kind":"x"}')).toMatchObject({ ok: false });
    const dup = parseChecksDocument(JSON.stringify({ kind: "v19.checks", version: 1, checks: [{ ...smoke, version: undefined }, { ...smoke, version: undefined }] }).replace(/,"version":3/g, ""));
    expect(dup).toMatchObject({ ok: false, errors: [expect.stringContaining("appears twice")] });
    const expr = parseChecksDocument(JSON.stringify({ kind: "v19.checks", version: 1, checks: [{ key: "x", name: "${{ secrets.A }}", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://x.example.test", expectStatus: 200, maxLatencyMs: 10 } }] }));
    expect(expr.ok).toBe(false);
  });
});
