import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({ prisma: { agentSkillInstallation: { findMany: mocks.findMany, upsert: mocks.upsert, updateMany: mocks.updateMany, deleteMany: mocks.deleteMany }, secureAuditRecord: {create: mocks.appendAudit} } }));

const session = { id: "session-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("desktop Agent skills route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findMany.mockResolvedValue([]);
    mocks.upsert.mockResolvedValue({ id: "install-1", skillId: "integration-audit", status: "enabled", installedAt: new Date(), updatedAt: new Date() });
    mocks.appendAudit.mockResolvedValue({});
  });

  it("lists the curated catalog without fabricating installations", async () => {
    const { GET } = await import("../route");
    const response = await GET(new NextRequest("https://visionxixlabs.com/api/desktop/agent/skills"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.storageAvailable).toBe(true);
    expect(body.data.skills.length).toBeGreaterThan(4);
    expect(body.data.skills.every((skill: { status: string }) => skill.status === "not_installed")).toBe(true);
  });

  it("still returns the curated catalog when installation storage is unavailable", async () => {
    mocks.findMany.mockRejectedValue(new Error("relation does not exist"));
    const { GET } = await import("../route");
    const response = await GET(new NextRequest("https://visionxixlabs.com/api/desktop/agent/skills"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.storageAvailable).toBe(false);
    expect(body.data.skills.length).toBeGreaterThan(4);
    expect(body.data.skills.every((skill: { status: string }) => skill.status === "not_installed")).toBe(true);
  });

  it("requires an admin session before installation", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/agent/skills", { method: "POST", body: JSON.stringify({ skillId: "integration-audit", action: "install" }) }));
    expect(response.status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("installs a known skill and audits that authority did not change", async () => {
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/agent/skills", { method: "POST", body: JSON.stringify({ skillId: "integration-audit", action: "install" }) }));
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_skillId: { organizationId: "org-1", skillId: "integration-audit" } } }));
    expect(mocks.appendAudit).toHaveBeenCalledWith({data: expect.objectContaining({ organizationId: "org-1", actorUserId: "user-1", action: "skill.install", detail: expect.objectContaining({ authorityChanged: false }) })});
  });

  it("rejects unreviewed skill identifiers", async () => {
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/agent/skills", { method: "POST", body: JSON.stringify({ skillId: "run-any-shell", action: "install" }) }));
    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

// The desktop and browser share the durable writer, including uncertainty after a write.
it("withholds a desktop success receipt when durable audit persistence fails", async () => {
  vi.resetAllMocks();
  mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  mocks.upsert.mockResolvedValue({});
  mocks.appendAudit.mockRejectedValue(new Error("private audit storage diagnostic"));
  const { POST } = await import("../route");
  const response = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/agent/skills", {method:"POST", body:JSON.stringify({skillId:"integration-audit",action:"install"})}));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ok:false,error:"skill_audit_unconfirmed"});
  expect(mocks.upsert).toHaveBeenCalledOnce();
});
