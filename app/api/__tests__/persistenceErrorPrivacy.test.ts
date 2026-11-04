import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), upsert: vi.fn(), row: vi.fn(), persist: vi.fn(), enrich: vi.fn(), fetcher: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.auth }));
vi.mock("@/lib/db", () => ({ prisma: { agentEngineerRecord: { upsert: m.upsert }, incidentTriage: { findUnique: m.row }, remediationProposal: { findUnique: m.row } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/releaseops/aiRationaleEnricherResponder", () => ({ persistEnrichment: m.persist }));
vi.mock("@/lib/releaseops/aiTriageRationaleEngine", () => ({ enrichTriageRationale: m.enrich }));
vi.mock("@/lib/releaseops/aiRemediationRationaleEngine", () => ({ enrichRemediationRationale: m.enrich }));
vi.mock("@/lib/releaseops/aiRationaleFetcher", () => ({ makeLiveRationaleFetcher: m.fetcher }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: m.audit }));
import { POST as policy } from "../workforce/[id]/policy/route";
import { POST as triage } from "../dashboard/triage-rationale-enrich/route";
import { POST as remediation } from "../dashboard/remediation-rationale-enrich/route";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
const marker = "SYNTHETIC_PRIVATE_DB_DIAGNOSTIC";
const safePolicy = "The policy update could not be confirmed. Refresh current policy before making another change.";
const safeEnrich = "The enrichment result could not be confirmed. Reload the current record before requesting another enrichment.";
const engineer = AGENT_WORKFORCE_REGISTRY.find(e => e.productLayer === "client")!;
function request(body: unknown) { return new NextRequest("http://localhost/synthetic", { method: "POST", body: JSON.stringify(body) }); }
function callPolicy(body: unknown = { rule: engineer.approvalRule, isEnabled: false }) { return policy(request(body), { params: Promise.resolve({ id: engineer.id }) }); }
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ isAuthenticated: true, organizationId: "synthetic-org", userId: "synthetic-user" });
  m.row.mockResolvedValue({ id: "synthetic-record", organizationId: "synthetic-org", generatedAt: new Date("2026-01-01T00:00:00Z"), inputsJson: {} });
  m.enrich.mockResolvedValue({ outcome: "enriched" });
  m.fetcher.mockReturnValue(vi.fn());
});
describe("policy persistence response privacy", () => {
  it("redacts an Error from the actual upsert catch", async () => {
    m.upsert.mockRejectedValue(new Error(marker));
    const response = await callPolicy(); const body = await response.json();
    expect(response.status).toBe(500); expect(JSON.stringify(body)).not.toContain(marker);
    expect(body).toEqual({ ok: false, reason: "persistence_failed", detail: safePolicy });
    expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_engineerId: { organizationId: "synthetic-org", engineerId: engineer.id } }, update: expect.objectContaining({ isEnabled: false }) }));
    expect(m.audit).not.toHaveBeenCalled();
  });
  it("preserves non-Error fallback", async () => { m.upsert.mockRejectedValue(null); expect(await (await callPolicy()).json()).toEqual({ ok: false, reason: "persistence_failed", detail: "unknown" }); });
  it("preserves authentication and validation", async () => {
    expect((await callPolicy({ rule: "invalid" })).status).toBe(400); expect(m.upsert).not.toHaveBeenCalled();
    m.auth.mockResolvedValue({ isAuthenticated: false }); expect((await callPolicy()).status).toBe(401); expect(m.upsert).not.toHaveBeenCalled();
  });
  it("preserves successful policy shape", async () => { expect(await (await callPolicy()).json()).toEqual({ ok: true, engineerId: engineer.id, canonical: engineer.approvalRule, currentRule: engineer.approvalRule, overrideActive: false, isEnabled: false }); });
});
for (const [name, handler, key, missing] of [["triage", triage, "triageId", "triage_not_found"], ["remediation", remediation, "proposalId", "proposal_not_found"]] as const) {
 describe(name + " persistence response privacy", () => {
  const call = (body: unknown = { [key]: "synthetic-record" }) => handler(request(body));
  it("redacts an Error from the actual persistence catch", async () => {
    m.persist.mockRejectedValue(new Error(marker)); const response = await call(); const body = await response.json();
    expect(response.status).toBe(500); expect(JSON.stringify(body)).not.toContain(marker);
    expect(body).toEqual({ ok: false, error: "persist_failed", hint: safeEnrich });
    expect(m.persist).toHaveBeenCalledWith(expect.anything(), "synthetic-org", "synthetic-record", { outcome: "enriched" }, name);
    expect(m.enrich).toHaveBeenCalledTimes(1); expect(m.audit).not.toHaveBeenCalled();
  });
  it("preserves non-Error fallback", async () => { m.persist.mockRejectedValue(null); expect(await (await call()).json()).toEqual({ ok: false, error: "persist_failed", hint: "unknown" }); });
  it("preserves migration-pending response", async () => { m.persist.mockRejectedValue({ code: "P2021", message: marker }); const response = await call(); expect(response.status).toBe(503); expect(await response.json()).toEqual({ ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528140000_add_ai_rationale_enrichment." }); });
  it("preserves validation, tenant boundary, and authentication", async () => {
    expect((await call({})).status).toBe(400); expect(m.row).not.toHaveBeenCalled();
    m.row.mockResolvedValue({ organizationId: "another-synthetic-org" }); const response = await call(); expect(response.status).toBe(404); expect(await response.json()).toEqual({ ok: false, error: missing }); expect(m.enrich).not.toHaveBeenCalled(); expect(m.persist).not.toHaveBeenCalled();
    m.auth.mockResolvedValue({ isAuthenticated: false }); expect((await call()).status).toBe(401);
  });
 });
}
