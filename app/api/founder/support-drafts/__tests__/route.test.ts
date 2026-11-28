// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ founder: vi.fn(), ctx: vi.fn(), sameOrigin: true, rows: vi.fn(), governed: vi.fn(), extract: vi.fn(), rate: true }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/founder/founderAccess", () => ({ founderContext: m.founder }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: () => m.rate }));
vi.mock("@/lib/db", () => ({ prisma: { helpQueryRecord: { findMany: m.rows } } }));
vi.mock("@/lib/axiom/agentRuntime/governedAiCall", () => ({ resolveGovernedAiCall: m.governed }));
vi.mock("@/lib/support/knowledgeBase", () => ({ knowledgeEntries: () => [{ id: "p1", title: "Connect GitLab", href: "/docs/gitlab", body: "Use the GitLab card under Integrations to connect GitLab.", kind: "docs" }] }));
import { POST } from "../route";
const post = () => POST(new NextRequest("http://localhost/api/founder/support-drafts", { method: "POST" }));
beforeEach(() => {
  vi.clearAllMocks(); m.sameOrigin = true; m.rate = true;
  m.founder.mockResolvedValue({ email: "f@x.test" }); m.ctx.mockResolvedValue({ organizationId: "org_f", sessionUserId: "u_f" });
  m.rows.mockResolvedValue([{ query: "How do I connect GitLab?" }, { query: "how do i connect gitlab" }]);
  m.governed.mockResolvedValue({ ok: true, extract: m.extract });
  m.extract.mockResolvedValue({ data: { status: "answered", answer: "Use the GitLab card under Integrations.", citations: ["p1"] } });
});

describe("/api/founder/support-drafts", () => {
  it("is invisible to anyone who is not the founder and refuses cross-origin", async () => {
    m.founder.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
    m.founder.mockResolvedValue({ email: "f@x.test" }); m.sameOrigin = false;
    expect((await post()).status).toBe(403);
    expect(m.governed).not.toHaveBeenCalled();
  });
  it("drafts for the most-asked unanswered topics through the founder workspace's governed AI", async () => {
    const body = await (await post()).json();
    expect(body.data.drafts).toEqual([{ question: "How do I connect GitLab?", count: 2, draft: { status: "answered", answer: "Use the GitLab card under Integrations.", citations: [{ id: "p1", title: "Connect GitLab", href: "/docs/gitlab" }] } }]);
    expect(m.governed).toHaveBeenCalledWith("org_f", undefined, "u_f");
  });
  it("returns the governed refusal instead of calling a model", async () => {
    m.governed.mockResolvedValue({ ok: false, error: "workspace_ai_credit_pool_exhausted" });
    expect((await (await post()).json()).error).toBe("workspace_ai_credit_pool_exhausted");
    expect(m.extract).not.toHaveBeenCalled();
  });
  it("needs no AI when there is nothing to draft, and is rate limited", async () => {
    m.rows.mockResolvedValue([]);
    expect((await (await post()).json()).data.drafts).toEqual([]);
    expect(m.governed).not.toHaveBeenCalled();
    m.rate = false;
    expect((await post()).status).toBe(429);
  });
});
