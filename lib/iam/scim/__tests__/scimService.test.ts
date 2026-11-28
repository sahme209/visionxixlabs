import { describe, expect, it } from "vitest";
import { createUser, deleteUser, getUser, listUsers, parseFilter, patchUser, replaceUser, type ScimDb, type ScimRow } from "../scimService";

/** In-memory stand-in for the four tables SCIM touches; matches the Prisma where shapes the service uses. */
function memoryDb() {
  const rows: ScimRow[] = [];
  const sessions = [
    { id: "s1", userId: "u_alex", organizationId: "org_a", revokedAt: null as Date | null, expiresAt: new Date("2099-01-01") },
    { id: "s2", userId: "u_alex", organizationId: "org_b", revokedAt: null as Date | null, expiresAt: new Date("2099-01-01") },
  ];
  const audits: Array<Record<string, unknown>> = [];
  const memberships = [
    { userId: "u_alex", organizationId: "org_a", role: "operator", acceptedAt: new Date("2026-01-01") as Date | null },
    { userId: "u_alex", organizationId: "org_b", role: "operator", acceptedAt: new Date("2026-01-01") as Date | null },
  ];
  let n = 0;
  const match = (r: ScimRow, w: Record<string, unknown>): boolean => Object.entries(w).every(([k, v]) => {
    if (k === "OR") return (v as Record<string, unknown>[]).some((o) => match(r, o));
    if (k === "NOT") return !match(r, v as Record<string, unknown>);
    return (r as unknown as Record<string, unknown>)[k] === v;
  });
  const db: ScimDb = {
    scimProvisionedIdentity: {
      async findFirst({ where }) { return rows.find((r) => match(r, where)) ?? null; },
      async findMany({ where, skip, take }) { return rows.filter((r) => match(r, where)).slice(skip, skip + take); },
      async count({ where }) { return rows.filter((r) => match(r, where)).length; },
      async create({ data }) { const r = { id: `scim_${++n}`, ...data } as unknown as ScimRow; rows.push(r); return r; },
      async update({ where, data }) { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
    },
    user: { async findFirst({ where }) { return (where.email as { equals: string }).equals.toLowerCase() === "alex@example.com" ? { id: "u_alex" } : null; } },
    desktopSessionRecord: {
      async updateMany({ where, data }) {
        const hit = sessions.filter((s) => s.userId === where.userId && s.organizationId === where.organizationId && s.revokedAt === null);
        hit.forEach((s) => Object.assign(s, data));
        return { count: hit.length };
      },
    },
    orgMembership: {
      async updateMany({ where, data }) {
        const hit = memberships.filter((m) => m.userId === where.userId && m.organizationId === where.organizationId && m.acceptedAt !== null && m.role !== (where.role as { not: string }).not);
        hit.forEach((m) => Object.assign(m, data));
        return { count: hit.length };
      },
    },
    secureAuditRecord: { async create({ data }) { audits.push(data); return data; } },
  };
  return { db, rows, sessions, audits, memberships };
}

const ctx = { organizationId: "org_a", apiKeyId: "key_1", baseUrl: "https://visionxixlabs.com/api/scim/v2", now: new Date("2026-11-28T12:00:00Z") };
const entraUser = { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], externalId: "e-123", userName: "Alex@Example.com", active: true, emails: [{ primary: true, type: "work", value: "Alex@Example.com" }], displayName: "Alex" };

describe("SCIM provisioning", () => {
  it("creates a provisioned identity only, returns a SCIM user and audits it", async () => {
    const { db, rows, audits } = memoryDb();
    const r = await createUser(db, ctx, entraUser);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ id: "scim_1", userName: "alex@example.com", externalId: "e-123", active: true, meta: { location: `${ctx.baseUrl}/Users/scim_1` } });
    expect(rows[0]).toMatchObject({ organizationId: "org_a", email: "alex@example.com", scimActive: true });
    expect(audits.map((a) => a.action)).toEqual(["identity.scim_provision"]);
  });

  it("refuses duplicates by externalId or userName with a SCIM uniqueness error", async () => {
    const { db } = memoryDb();
    await createUser(db, ctx, entraUser);
    expect((await createUser(db, ctx, { ...entraUser, externalId: "other" })).body).toMatchObject({ status: "409", scimType: "uniqueness" });
    expect((await createUser(db, ctx, { ...entraUser, userName: "b@example.com", emails: [] })).status).toBe(409);
  });

  it("filters the way Entra and Okta match users, and rejects other filters", async () => {
    const { db } = memoryDb();
    await createUser(db, ctx, entraUser);
    const hit = await listUsers(db, ctx, { filter: 'userName eq "ALEX@example.com"', startIndex: null, count: null });
    expect(hit.body).toMatchObject({ totalResults: 1, Resources: [{ externalId: "e-123" }] });
    expect((await listUsers(db, ctx, { filter: 'externalId eq "nope"', startIndex: null, count: null })).body).toMatchObject({ totalResults: 0, Resources: [] });
    expect((await listUsers(db, ctx, { filter: 'displayName co "a"', startIndex: null, count: null })).body).toMatchObject({ status: "400", scimType: "invalidFilter" });
    expect(parseFilter('userName eq "a\\"b@x.io"')).toEqual({ field: "email", value: 'a"b@x.io' });
  });

  it("never reads or changes another workspace's users", async () => {
    const { db } = memoryDb();
    const created = await createUser(db, ctx, entraUser);
    const id = (created.body as { id: string }).id;
    const other = { ...ctx, organizationId: "org_b" };
    expect((await getUser(db, other, id)).status).toBe(404);
    expect((await patchUser(db, other, id, { Operations: [{ op: "replace", path: "active", value: false }] })).status).toBe(404);
    expect((await deleteUser(db, other, id)).status).toBe(404);
    expect((await listUsers(db, other, { filter: null, startIndex: null, count: null })).body).toMatchObject({ totalResults: 0 });
  });

  it("deprovisions on Entra's PATCH active False: keeps the record, revokes only this workspace's sessions, audits", async () => {
    const { db, rows, sessions, audits, memberships } = memoryDb();
    const id = ((await createUser(db, ctx, entraUser)).body as { id: string }).id;
    const r = await patchUser(db, ctx, id, { schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], Operations: [{ op: "Replace", path: "active", value: "False" }] });
    expect(r.body).toMatchObject({ active: false });
    expect(rows[0]).toMatchObject({ scimActive: false, deprovisionedAt: ctx.now });
    expect(sessions.find((s) => s.id === "s1")?.revokedAt).toEqual(ctx.now);
    expect(sessions.find((s) => s.id === "s2")?.revokedAt).toBeNull();
    expect(memberships.map((m) => m.acceptedAt === null)).toEqual([true, false]);
    expect(audits.at(-1)).toMatchObject({ action: "identity.scim_deprovision", detail: { sessionsRevoked: 1, membershipSuspended: true, apiKeyId: "key_1" } });
  });

  it("accepts Okta's value-object PATCH and reactivation", async () => {
    const { db, audits } = memoryDb();
    const id = ((await createUser(db, ctx, entraUser)).body as { id: string }).id;
    await patchUser(db, ctx, id, { Operations: [{ op: "replace", value: { active: false } }] });
    const back = await patchUser(db, ctx, id, { Operations: [{ op: "replace", value: { active: true, displayName: "Alex R" } }] });
    expect(back.body).toMatchObject({ active: true });
    expect(audits.map((a) => a.action)).toEqual(["identity.scim_provision", "identity.scim_deprovision", "identity.scim_reactivate"]);
  });

  it("never suspends the workspace owner, and reactivation does not restore access by itself", async () => {
    const { db, memberships, audits } = memoryDb();
    memberships[0].role = "owner";
    const id = ((await createUser(db, ctx, entraUser)).body as { id: string }).id;
    await deleteUser(db, ctx, id);
    expect(memberships[0].acceptedAt).not.toBeNull();
    expect(audits.at(-1)).toMatchObject({ detail: { membershipSuspended: false, sessionsRevoked: 1 } });
    memberships[0].role = "operator"; memberships[0].acceptedAt = null;
    await patchUser(db, ctx, id, { Operations: [{ op: "replace", path: "active", value: true }] });
    expect(memberships[0].acceptedAt).toBeNull();
  });

  it("DELETE deprovisions once and is safe to repeat; the record stays", async () => {
    const { db, rows, audits } = memoryDb();
    const id = ((await createUser(db, ctx, entraUser)).body as { id: string }).id;
    expect((await deleteUser(db, ctx, id)).status).toBe(204);
    expect((await deleteUser(db, ctx, id)).status).toBe(204);
    expect(rows).toHaveLength(1);
    expect(audits.filter((a) => a.action === "identity.scim_deprovision")).toHaveLength(1);
  });

  it("rejects bad input without changing anything", async () => {
    const { db, rows } = memoryDb();
    expect((await createUser(db, ctx, { userName: "not-an-email" })).status).toBe(400);
    expect((await createUser(db, ctx, { userName: "a@b.io", active: "maybe" })).status).toBe(400);
    const id = ((await createUser(db, ctx, entraUser)).body as { id: string }).id;
    expect((await patchUser(db, ctx, id, { Operations: [{ op: "remove", path: "active" }] })).status).toBe(400);
    expect((await patchUser(db, ctx, id, { Operations: [{ op: "replace", path: "roles", value: "admin" }] })).body).toMatchObject({ scimType: "invalidPath" });
    expect((await patchUser(db, ctx, id, { Operations: [] })).status).toBe(400);
    expect(rows[0]).toMatchObject({ scimActive: true, email: "alex@example.com" });
  });

  it("PUT replaces email and status and refuses a clash with another user", async () => {
    const { db } = memoryDb();
    const id = ((await createUser(db, ctx, entraUser)).body as { id: string }).id;
    await createUser(db, ctx, { userName: "sam@example.com", externalId: "e-9" });
    expect((await replaceUser(db, ctx, id, { userName: "sam@example.com", externalId: "e-123" })).status).toBe(409);
    expect((await replaceUser(db, ctx, id, { userName: "alex.r@example.com", externalId: "e-123", active: true })).body).toMatchObject({ userName: "alex.r@example.com" });
  });
});
