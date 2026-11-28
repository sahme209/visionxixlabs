import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.fn();
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: (i: unknown) => auth(i) }));
const store = { rows: [] as Array<Record<string, unknown>> };
vi.mock("@/lib/db", () => {
  const scimProvisionedIdentity = {
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => store.rows.find((r) => r.id === where.id && r.organizationId === where.organizationId) ?? null),
    findMany: vi.fn(async () => store.rows), count: vi.fn(async () => store.rows.length),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const r = { id: "scim_1", ...data }; store.rows.push(r); return r; }),
    update: vi.fn(),
  };
  const tx = { scimProvisionedIdentity, user: { findFirst: vi.fn(async () => null) }, desktopSessionRecord: { updateMany: vi.fn() }, orgMembership: { updateMany: vi.fn() }, secureAuditRecord: { create: vi.fn() } };
  return { prisma: { ...tx, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
});

import * as Users from "../Users/route";
import * as User from "../Users/[id]/route";
import * as Config from "../ServiceProviderConfig/route";

const req = (url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) => new NextRequest(`https://visionxixlabs.com/api/scim/v2${url}`, { ...init, headers: { authorization: "Bearer vx_live_test", "content-type": "application/scim+json", ...(init.headers ?? {}) } });

beforeEach(() => { store.rows = []; auth.mockReset(); auth.mockResolvedValue({ ok: true, organizationId: "org_a", apiKeyId: "key_1" }); });

describe("SCIM routes", () => {
  it("require an API key with scim:provision and answer refusals as SCIM errors", async () => {
    auth.mockResolvedValue({ ok: false, reason: "scope_missing", httpStatus: 403, requiredScope: "scim:provision" });
    const r = await Users.GET(req("/Users"));
    expect(r.status).toBe(403);
    expect(r.headers.get("content-type")).toContain("application/scim+json");
    expect(await r.json()).toMatchObject({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: "403" });
    expect(auth).toHaveBeenCalledWith(expect.objectContaining({ requiredScope: "scim:provision" }));
  });

  it("provisions, then reads the user back only within the key's workspace", async () => {
    const created = await Users.POST(req("/Users", { method: "POST", body: JSON.stringify({ userName: "alex@example.com", externalId: "e-1" }) }));
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: "scim_1", userName: "alex@example.com", meta: { location: "https://visionxixlabs.com/api/scim/v2/Users/scim_1" } });
    expect((await User.GET(req("/Users/scim_1"), { params: Promise.resolve({ id: "scim_1" }) })).status).toBe(200);
    auth.mockResolvedValue({ ok: true, organizationId: "org_b", apiKeyId: "key_2" });
    expect((await User.GET(req("/Users/scim_1"), { params: Promise.resolve({ id: "scim_1" }) })).status).toBe(404);
  });

  it("rejects unreadable bodies and advertises its capabilities", async () => {
    expect((await Users.POST(req("/Users", { method: "POST", body: "{nope" }))).status).toBe(400);
    const c = await (await Config.GET(req("/ServiceProviderConfig"))).json();
    expect(c).toMatchObject({ patch: { supported: true }, bulk: { supported: false }, filter: { supported: true } });
  });
});
