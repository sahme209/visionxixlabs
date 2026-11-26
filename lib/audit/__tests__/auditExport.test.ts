import { describe, expect, it } from "vitest";
import { serializeAuditExport, type AuditExportRow } from "../auditExport";

const row = (over: Partial<AuditExportRow> = {}): AuditExportRow => ({ id: "a1", occurredAt: new Date("2026-11-27T10:00:00Z"), action: "governance.update", outcome: "success", actorKind: "user", actorUserId: "u1", entityRef: "webhook_endpoint:w1", correlationId: "c1", source: "live", errorCode: null, ...over });

describe("audit export", () => {
  it("writes CSV with a header and empty cells for missing values", () => {
    expect(serializeAuditExport([row()], "csv")).toBe("occurredAt,action,outcome,actorKind,actorUserId,entityRef,correlationId,source,errorCode,id\r\n2026-11-27T10:00:00.000Z,governance.update,success,user,u1,webhook_endpoint:w1,c1,live,,a1\r\n");
  });
  it("quotes commas and quotes, and neutralises spreadsheet formulas", () => {
    const out = serializeAuditExport([row({ entityRef: '=HYPERLINK("x")', errorCode: "a,b" })], "csv").split("\r\n")[1];
    expect(out).toContain(`"'=HYPERLINK(""x"")"`);
    expect(out).toContain('"a,b"');
    expect(serializeAuditExport([row({ entityRef: "-1+2" })], "csv")).toContain(",'-1+2,");
  });
  it("writes one JSON object per line", () => {
    const out = serializeAuditExport([row(), row({ id: "a2" })], "ndjson").trim().split("\n").map((l) => JSON.parse(l));
    expect(out.map((o) => o.id)).toEqual(["a1", "a2"]);
    expect(out[0]).not.toHaveProperty("detail");
    expect(serializeAuditExport([], "ndjson")).toBe("");
  });
});
