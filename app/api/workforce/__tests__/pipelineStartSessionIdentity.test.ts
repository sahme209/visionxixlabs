import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ session: vi.fn(), membership: vi.fn(), start: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next-auth", () => ({ getServerSession: f.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/auth/ensurePersonalWorkspaceMembership", () => ({ ensurePersonalWorkspaceMembership: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: f.membership }, codingTask: { create: async () => ({ id: "task" }) }, usageEvent: { create: vi.fn() } } }));
vi.mock("@/lib/workforce/pipelines/pipelineRunner", () => ({ startPipelineRun: f.start }));
vi.mock("@/lib/workforce/pipelines/codingDryRunExecutors", () => ({ registerCodingDryRunExecutors: vi.fn() }));
vi.mock("@/lib/billing/enforceEntitlement", () => ({ enforceEntitlement: async () => ({ kind: "allow" }) }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));
import { currentContext } from "@/lib/auth/currentContext";
import { POST as pipeline } from "@/app/api/workforce/pipelines/[id]/start/route";
import { POST as coding } from "@/app/api/workforce/coding-tasks/start/route";
const cases = ["pipeline", "coding"] as const;
async function run(kind: typeof cases[number]) { const req = new NextRequest("https://axiom.invalid/api/workforce/start", { method: "POST", headers: { origin: "https://axiom.invalid", "content-type": "application/json" }, body: JSON.stringify({ instruction: "Prepare a patch", repoRef: "owned/repo" }) }); return kind === "pipeline" ? pipeline(req, { params: Promise.resolve({ id: "ai_coding" }) }) : coding(req); }
beforeEach(() => { vi.resetAllMocks(); f.membership.mockResolvedValue({ role: "owner", acceptedAt: new Date() }); f.start.mockResolvedValue({ ok: true, runId: "run", correlationId: "corr" }); });
it.each(cases)("%s refuses the real context resolver's email-only fallback even with an accepted owner membership", async kind => {
 f.session.mockResolvedValue({ user: { email: "synthetic@example.invalid" } });
 expect(await currentContext()).toMatchObject({ isAuthenticated: true, userId: "synthetic@example.invalid", roles: ["owner"] });
 expect((await run(kind)).status).toBe(401); expect(f.start).not.toHaveBeenCalled();
});
it.each(cases)("%s preserves the actual session ID through the real context resolver", async kind => {
 f.session.mockResolvedValue({ user: { id: "actual_session_member", email: "synthetic@example.invalid" } });
 expect((await run(kind)).status).toBe(200); expect(f.start).toHaveBeenCalledWith(expect.objectContaining({ triggeredBy: "actual_session_member" }));
});
