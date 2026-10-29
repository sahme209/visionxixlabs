import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ context: vi.fn(), start: vi.fn(), entitlement: vi.fn(), register: vi.fn(), task: vi.fn(), usage: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: f.context }));
vi.mock("@/lib/workforce/pipelines/pipelineRunner", () => ({ startPipelineRun: f.start }));
vi.mock("@/lib/workforce/pipelines/codingDryRunExecutors", () => ({ registerCodingDryRunExecutors: f.register }));
vi.mock("@/lib/billing/enforceEntitlement", () => ({ enforceEntitlement: f.entitlement }));
vi.mock("@/lib/db", () => ({ prisma: { codingTask: { create: f.task }, usageEvent: { create: f.usage } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));
import { POST as startPipeline } from "@/app/api/workforce/pipelines/[id]/start/route";
import { POST as startCoding } from "@/app/api/workforce/coding-tasks/start/route";
const context = { isAuthenticated: true, organizationId: "owned_org", userId: "verified_member", sessionUserId: "verified_member", email: "synthetic@example.invalid", roles: ["owner"] };
const cases = ["pipeline", "coding"] as const;
function request(origin: string | null = "https://axiom.invalid") { return new NextRequest("https://axiom.invalid/api/workforce/start", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify({ instruction: "Prepare a patch", repoRef: "owned/repo", metadata: { triggeredBy: "forged_actor", organizationId: "foreign_org" } }) }); }
async function run(kind: typeof cases[number], origin?: string | null) { const req = request(origin); return kind === "pipeline" ? startPipeline(req, { params: Promise.resolve({ id: "ai_coding" }) }) : startCoding(req); }
beforeEach(() => { vi.resetAllMocks(); f.context.mockResolvedValue({ ...context }); f.start.mockResolvedValue({ ok: true, runId: "run", correlationId: "corr" }); f.entitlement.mockResolvedValue({ kind: "allow" }); f.task.mockResolvedValue({ id: "task" }); });
it.each(cases)("%s start refuses a session without a stable user identity", async kind => {
 f.context.mockResolvedValue({ ...context, userId: undefined }); expect((await run(kind)).status).toBe(401); expect(f.start).not.toHaveBeenCalled(); expect(f.entitlement).not.toHaveBeenCalled();
});
it.each(cases.flatMap(kind => [null, "https://external.invalid", "null"].map(origin => [kind, origin] as const)))("%s start refuses an absent/cross-site origin (%s) before any work", async (kind, origin) => {
 expect((await run(kind, origin)).status).toBe(403); expect(f.start).not.toHaveBeenCalled(); expect(f.entitlement).not.toHaveBeenCalled(); expect(f.register).not.toHaveBeenCalled();
});
it.each(cases.flatMap(kind => [[], ["read_only"], ["security_reviewer"], ["finance_viewer"], ["unknown"]].map(roles => [kind, roles] as const)))("%s start refuses roles %j before execution or billing work", async (kind, roles) => {
 f.context.mockResolvedValue({ ...context, roles }); expect((await run(kind)).status).toBe(403); expect(f.start).not.toHaveBeenCalled(); expect(f.entitlement).not.toHaveBeenCalled(); expect(f.task).not.toHaveBeenCalled();
});
it.each(cases.flatMap(kind => ["owner", "admin", "operator"].map(role => [kind, role] as const)))("%s preserves authorized %s start with the authenticated workspace and actor", async (kind, role) => {
 f.context.mockResolvedValue({ ...context, roles: [role] }); expect((await run(kind)).status).toBe(200);
 expect(f.start).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "owned_org", triggeredBy: "verified_member" }));
});
