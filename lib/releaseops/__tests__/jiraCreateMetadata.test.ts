import { describe, expect, it } from "vitest";
import { collectJiraCreateMetadata } from "../jiraCreateMetadata";

const field = (fieldId = "summary") => ({ fieldId, key: fieldId, name: "Summary", required: true, hasDefaultValue: false, operations: ["set"], schema: { type: "string" } });
const page = (fields: Array<Record<string, unknown>> = [field()], startAt = 0, total = fields.length) => ({ fields, startAt, total, maxResults: 50 });

describe("Jira create metadata discovery", () => {
  it("retains required custom fields without inventing a generic ticket form", () => {
    const result = collectJiraCreateMetadata([page([field(), { ...field("customfield_10001"), name: "Change category", schema: { type: "option", custom: "company:category" }, operations: [] }])]);
    expect(result).toEqual({ authority: "discovery_only", fields: [
      { id: "summary", name: "Summary", required: true, hasDefaultValue: false, canSet: true, schemaType: "string" },
      { id: "customfield_10001", name: "Change category", required: true, hasDefaultValue: false, canSet: false, schemaType: "option", schemaCustom:"company:category" },
    ] });
  });
  it("requires every contiguous page and stable total", () => {
    expect(() => collectJiraCreateMetadata([page([field()], 0, 2)])).toThrow();
    expect(() => collectJiraCreateMetadata([page([field()], 0, 2), page([field("description")], 2, 2)])).toThrow();
    expect(() => collectJiraCreateMetadata([page([field()], 0, 2), page([field("description")], 1, 3)])).toThrow();
    expect(collectJiraCreateMetadata([page([field()], 0, 2), page([field("description")], 1, 2)]).fields).toHaveLength(2);
  });
  it("does not mistake missing metadata for optional fields", () => {
    for (const key of ["required", "hasDefaultValue", "operations", "fieldId", "name"]) {
      const value: Record<string, unknown> = field(); delete value[key];
      expect(() => collectJiraCreateMetadata([page([value as ReturnType<typeof field>])])).toThrow();
    }
  });
  it("rejects duplicate and dangerous field identifiers", () => {
    expect(() => collectJiraCreateMetadata([page([field(), field()])])).toThrow();
    for (const id of ["__proto__", "constructor", "prototype", "../summary", " summary"])
      expect(() => collectJiraCreateMetadata([page([field(id)])])).toThrow();
  });
  it("bounds pages, fields and provider text", () => {
    expect(() => collectJiraCreateMetadata([])).toThrow();
    expect(() => collectJiraCreateMetadata(Array.from({ length: 11 }, () => page()))).toThrow();
    expect(() => collectJiraCreateMetadata([page(Array.from({ length: 201 }, (_, i) => field(`customfield_${i}`)))])).toThrow();
    expect(() => collectJiraCreateMetadata([page([{ ...field(), name: "x".repeat(513) }])])).toThrow();
  });
  it("allows documented absent schema without inferring a type or default", () => {
    const value: Record<string, unknown> = field(); delete value.schema;
    expect(collectJiraCreateMetadata([page([value as ReturnType<typeof field>])]).fields[0]).toEqual({ id: "summary", name: "Summary", required: true, hasDefaultValue: false, canSet: true, schemaType: null });
  });
  it("rejects contradictory key and malformed pagination", () => {
    expect(() => collectJiraCreateMetadata([page([{ ...field(), key: "other" }])])).toThrow();
    for (const value of [-1, 0.1, "0", Infinity]) expect(() => collectJiraCreateMetadata([{ ...page(), startAt: value }])).toThrow();
    expect(() => collectJiraCreateMetadata([{ ...page(), maxResults: 0 }])).toThrow();
  });
  it("returns a detached projection without URLs, defaults or provider payloads", () => {
    const input = page();
    Object.assign(input.fields[0], { self: "https://private.invalid", defaultValue: "private" });
    const result = collectJiraCreateMetadata([input]);
    input.fields[0].name = "mutated";
    expect(result.fields[0].name).toBe("Summary");
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
