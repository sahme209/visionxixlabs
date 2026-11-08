import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ findUnique: vi.fn(), session: { user: { id: "user_a" } } as unknown, plan: "enterprise", prefs: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: db.findUnique }, user: { findUnique: async () => ({ plan: db.plan }) } } }));
vi.mock("next-auth", () => ({ getServerSession: async () => db.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/entitlements", () => ({ getEntitlementsFromPlan: () => ({ axiomExecution: true }) }));
vi.mock("@/lib/axiom/agent/preferences", () => ({ loadPreferences: db.prefs, savePreferences: db.save }));

import { authorizedForOrganization } from "../workspaceAuthority";
import { GET, PUT } from "@/app/api/axiom/preferences/route";

const accepted = (role: string) => ({ role, acceptedAt: new Date() });

beforeEach(() => {
  vi.clearAllMocks();
  db.prefs.mockResolvedValue({ ignoredFindingTitles: new Set<string>() });
});

describe("authorizedForOrganization", () => {
  it("allows an accepted member to read", async () => {
    db.findUnique.mockResolvedValue(accepted("read_only"));
    expect(await authorizedForOrganization("user_a", "org_a")).toBe(true);
    expect(db.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_organizationId: { userId: "user_a", organizationId: "org_a" } } }));
  });

  it("denies non-members, pending invitations and store failures", async () => {
    db.findUnique.mockResolvedValueOnce(null);
    expect(await authorizedForOrganization("user_a", "org_b")).toBe(false);
    db.findUnique.mockResolvedValueOnce({ role: "owner", acceptedAt: null });
    expect(await authorizedForOrganization("user_a", "org_b")).toBe(false);
    db.findUnique.mockRejectedValueOnce(new Error("db down"));
    expect(await authorizedForOrganization("user_a", "org_b")).toBe(false);
  });

  it("rejects malformed organization ids without a lookup", async () => {
    for (const bad of [undefined, null, 42, "", "x".repeat(201)]) expect(await authorizedForOrganization("user_a", bad)).toBe(false);
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it("requires an admin role for mutations", async () => {
    db.findUnique.mockResolvedValue(accepted("read_only"));
    expect(await authorizedForOrganization("user_a", "org_a", true)).toBe(false);
  });
});

describe("/api/axiom/preferences workspace authority", () => {
  const getReq = (org: string) => ({ nextUrl: new URL(`https://x.test/api/axiom/preferences?organizationId=${org}`) }) as never;
  const putReq = (body: unknown) => ({ json: async () => body }) as never;

  it("refuses to read another workspace's preferences", async () => {
    db.findUnique.mockResolvedValue(null);
    const res = await GET(getReq("org_other"));
    expect(res.status).toBe(403);
    expect(db.prefs).not.toHaveBeenCalled();
  });

  it("reads preferences for a member", async () => {
    db.findUnique.mockResolvedValue(accepted("read_only"));
    const res = await GET(getReq("org_a"));
    expect(res.status).toBe(200);
    expect(db.prefs).toHaveBeenCalledWith("org_a");
  });

  it("refuses to change approval policy without admin authority in that workspace", async () => {
    db.findUnique.mockResolvedValue(accepted("read_only"));
    const res = await PUT(putReq({ organizationId: "org_a", approvalPolicy: "auto_safe" }));
    expect(res.status).toBe(403);
    expect(db.save).not.toHaveBeenCalled();
  });
});
