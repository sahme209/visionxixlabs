import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findMany: vi.fn(),
  createMany: vi.fn(),
  appendAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({ prisma: {agentSkillInstallation: {findMany: mocks.findMany}, $transaction: mocks.transaction} }));

const transaction = {agentSkillInstallation: {createMany: mocks.createMany}, secureAuditRecord: {create: mocks.appendAudit}};

const session = { id: "session-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("desktop Agent skills route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findMany.mockResolvedValue([]);
    mocks.createMany.mockResolvedValue({count: 1});
    mocks.appendAudit.mockResolvedValue({});
    mocks.transaction.mockImplementation(callback => callback(transaction));
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
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("installs a known skill and audits that authority did not change", async () => {
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/agent/skills", { method: "POST", body: JSON.stringify({ skillId: "integration-audit", action: "install" }) }));
    expect(response.status).toBe(200);
    expect(mocks.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: { organizationId: "org-1", skillId: "integration-audit", installedByUserId: "user-1", status: "enabled" }, skipDuplicates: true }));
    expect(mocks.appendAudit).toHaveBeenCalledWith({data: expect.objectContaining({ organizationId: "org-1", actorUserId: "user-1", action: "skill.install", detail: expect.objectContaining({ authorityChanged: false }) })});
  });

  it("rejects unreviewed skill identifiers", async () => {
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/agent/skills", { method: "POST", body: JSON.stringify({ skillId: "run-any-shell", action: "install" }) }));
    expect(response.status).toBe(400);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});

it("rejects the desktop installation transaction when durable audit persistence fails", async () => {
  vi.resetAllMocks();
  mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  mocks.createMany.mockResolvedValue({count: 1});
  mocks.appendAudit.mockRejectedValue(new Error("private audit storage diagnostic"));
  const rollback = vi.fn();
  mocks.transaction.mockImplementation(async callback => {
    try { return await callback(transaction); }
    catch (error) { rollback(); throw error; }
  });
  const { POST } = await import("../route");
  const response = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/agent/skills", {method:"POST", body:JSON.stringify({skillId:"integration-audit",action:"install"})}));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ok:false,error:"skill_audit_unconfirmed"});
  expect(mocks.createMany).toHaveBeenCalledOnce();
  expect(rollback).toHaveBeenCalledOnce();
});
