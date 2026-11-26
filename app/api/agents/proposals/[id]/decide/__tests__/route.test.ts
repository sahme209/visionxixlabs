// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const io = vi.hoisted(() => {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    audit: vi.fn(async () => undefined),
    publish: vi.fn(async () => undefined),
    failNext: false,
    prisma: {
      methodProposal: {
        updateMany: vi.fn(async ({ where, data }: { where: { id: string; organizationId: string; status: string }; data: Record<string, unknown> }) => {
          if (io.failNext) { io.failNext = false; throw new Error("db down"); }
          const row = rows.get(where.id);
          if (!row || row.organizationId !== where.organizationId || row.status !== where.status) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (rows.has(where.id) ? { ...rows.get(where.id) } : null)),
      },
    },
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: io.prisma }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org_a", userId: "user_reviewer", email: "r@example.test", roles: ["owner"] }) }));
vi.mock("@/lib/auth/platformAdmin", () => ({ canDecideApprovals: () => true }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: io.audit }));
vi.mock("@/lib/agents/agentBus", async (orig) => ({ ...(await orig() as object), publishAgentMessage: io.publish }));
import { POST } from "../route";

const seed = (id: string, org = "org_a") => io.rows.set(id, { id, organizationId: org, status: "pending", authorAgent: "sre", label: "Raise memory", kind: "x", proposalJson: {}, decidedBy: null, decisionReason: null, decidedAt: null, createdAt: new Date(), updatedAt: new Date(), appliedAt: null, appliedBy: null });
const decide = (id: string, decision: string) => POST(new NextRequest(`https://x.test/api/agents/proposals/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) }), { params: Promise.resolve({ id }) });

beforeEach(() => { io.rows.clear(); vi.clearAllMocks(); io.failNext = false; });

describe("proposal decision", () => {
  it("records the first decision once and audits it", async () => {
    seed("p1");
    const res = await decide("p1", "approved");
    expect(res.status).toBe(200);
    expect(io.rows.get("p1")?.status).toBe("approved");
    expect(io.audit).toHaveBeenCalledTimes(1);
    expect(io.audit.mock.calls[0][0]).toMatchObject({ action: "approval.grant", entityRef: "method_proposal:p1", outcome: "success" });
  });

  it("never lets a second, conflicting decision overwrite the first", async () => {
    seed("p2");
    const [a, b] = await Promise.all([decide("p2", "approved"), decide("p2", "rejected")]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);
    expect(io.rows.get("p2")?.status).toBe("approved");
    expect(io.audit).toHaveBeenCalledTimes(1);
  });

  it("does not decide another workspace's proposal", async () => {
    seed("p3", "org_other");
    const res = await decide("p3", "approved");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(io.rows.get("p3")?.status).toBe("pending");
    expect(io.audit).not.toHaveBeenCalled();
  });

  it("reports a storage failure as a failure, not as \"not found\"", async () => {
    seed("p4");
    io.failNext = true;
    const res = await decide("p4", "approved");
    const body = await res.json();
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(body)).not.toContain("proposal.not_found");
  });
});
