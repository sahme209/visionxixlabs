/**
 * SCIM 2.0 user provisioning (RFC 7643 / 7644), the subset Microsoft Entra ID and Okta use.
 *
 * Follows docs/ENTERPRISE_IDENTITY_DESIGN.md ("SCIM lifecycle boundaries"):
 * - Provisioning creates or updates a ScimProvisionedIdentity row only. It never creates an
 *   OrgMembership or grants a role; a role comes only from a later validated sign-in.
 * - Deprovisioning (DELETE, or active=false) keeps the row, sets scimActive=false and
 *   deprovisionedAt, revokes that person's live desktop sessions in this workspace and suspends
 *   their membership (never the owner's). Memberships are never deleted, so the audit trail
 *   shows the deprovision. Reactivation does not restore access; an admin re-admits the person.
 * - Every change writes a secure audit record. A request that fails changes nothing.
 * Everything is scoped to the organization of the API key that called it.
 */
import { newAuditId } from "@/lib/audit/secureAudit";

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
export const SCIM_PATCH_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
export const SCIM_CONTENT_TYPE = "application/scim+json";

export interface ScimRow { id: string; organizationId: string; externalId: string; email: string; scimActive: boolean; lastSyncedAt: Date; deprovisionedAt: Date | null }

/** The database operations SCIM needs (a Prisma client or transaction satisfies it). */
export interface ScimDb {
  scimProvisionedIdentity: {
    findFirst(args: { where: Record<string, unknown> }): Promise<ScimRow | null>;
    findMany(args: { where: Record<string, unknown>; orderBy: Record<string, "asc">; skip: number; take: number }): Promise<ScimRow[]>;
    count(args: { where: Record<string, unknown> }): Promise<number>;
    create(args: { data: Record<string, unknown> }): Promise<ScimRow>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<ScimRow>;
  };
  user: { findFirst(args: { where: Record<string, unknown>; select: { id: true } }): Promise<{ id: string } | null> };
  desktopSessionRecord: { updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }> };
  orgMembership: { updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }> };
  secureAuditRecord: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
}
export interface ScimContext { organizationId: string; apiKeyId: string; baseUrl: string; now?: Date }
export type ScimResult = { status: number; body: Record<string, unknown> | null };

const err = (status: number, detail: string, scimType?: string): ScimResult =>
  ({ status, body: { schemas: [SCIM_ERROR_SCHEMA], status: String(status), ...(scimType ? { scimType } : {}), detail } });

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{1,63}$/;
const EXTERNAL_ID = /^[\x21-\x7e]{1,256}$/;

export function toScimUser(row: ScimRow, baseUrl: string) {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: row.id,
    externalId: row.externalId,
    userName: row.email,
    emails: [{ value: row.email, type: "work", primary: true }],
    active: row.scimActive,
    meta: { resourceType: "User", created: row.lastSyncedAt.toISOString(), lastModified: row.lastSyncedAt.toISOString(), location: `${baseUrl}/Users/${row.id}` },
  };
}

interface ParsedUser { email: string; externalId: string; active: boolean }

/** Reads a SCIM User body. userName must be an email; externalId falls back to userName (Okta may omit it). */
export function parseUser(body: unknown): ParsedUser | ScimResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return err(400, "The request body must be a SCIM User object.", "invalidSyntax");
  const b = body as Record<string, unknown>;
  const primary = Array.isArray(b.emails) ? (b.emails as Array<Record<string, unknown>>).find((e) => e && e.primary === true) ?? (b.emails as Array<Record<string, unknown>>)[0] : undefined;
  const raw = typeof b.userName === "string" && b.userName.includes("@") ? b.userName : typeof primary?.value === "string" ? primary.value : b.userName;
  if (typeof raw !== "string" || !EMAIL.test(raw.trim())) return err(400, "userName (or a primary email) must be an email address.", "invalidValue");
  const email = raw.trim().toLowerCase();
  const externalId = typeof b.externalId === "string" && b.externalId.trim() ? b.externalId.trim() : email;
  if (!EXTERNAL_ID.test(externalId)) return err(400, "externalId must be 1 to 256 printable characters.", "invalidValue");
  const active = parseActive(b.active);
  if (active === "invalid") return err(400, "active must be true or false.", "invalidValue");
  return { email, externalId, active: active ?? true };
}

function parseActive(v: unknown): boolean | null | "invalid" {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string" && /^(true|false)$/i.test(v)) return v.toLowerCase() === "true"; // Entra sends "False"
  return "invalid";
}

/** Only the filter Entra and Okta use for matching: userName eq "..." or externalId eq "...". */
export function parseFilter(filter: string | null): { field: "email" | "externalId"; value: string } | null | "unsupported" {
  if (!filter) return null;
  const m = /^\s*(userName|externalId)\s+eq\s+"((?:[^"\\]|\\.){1,320})"\s*$/i.exec(filter);
  if (!m) return "unsupported";
  const value = m[2].replace(/\\(.)/g, "$1");
  return m[1].toLowerCase() === "username" ? { field: "email", value: value.toLowerCase() } : { field: "externalId", value };
}

async function audit(db: ScimDb, ctx: ScimContext, action: string, row: ScimRow, detail: Record<string, unknown>) {
  await db.secureAuditRecord.create({
    data: {
      id: newAuditId(), organizationId: ctx.organizationId, actorUserId: null, actorKind: "system", action, outcome: "success",
      entityRef: `scim_identity:${row.id}`, correlationId: `scim_${row.id}_${(ctx.now ?? new Date()).getTime()}`, source: "live",
      occurredAt: ctx.now ?? new Date(), detail: { apiKeyId: ctx.apiKeyId, externalId: row.externalId, ...detail },
    },
  });
}

/**
 * Cuts the person off in this workspace: revokes their live desktop sessions and suspends their
 * membership (acceptedAt cleared), which every desktop request rechecks. The row is kept, never
 * deleted. The workspace owner is never suspended by SCIM, so a directory mistake cannot lock the
 * workspace out. Reactivating in the identity provider does not restore access by itself: an
 * admin re-admits the person, because SCIM never grants access.
 */
async function cutOff(db: ScimDb, ctx: ScimContext, email: string): Promise<{ sessionsRevoked: number; membershipSuspended: boolean }> {
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (!user) return { sessionsRevoked: 0, membershipSuspended: false };
  const now = ctx.now ?? new Date();
  const m = await db.orgMembership.updateMany({
    where: { userId: user.id, organizationId: ctx.organizationId, acceptedAt: { not: null }, role: { not: "owner" } },
    data: { acceptedAt: null },
  });
  const r = await db.desktopSessionRecord.updateMany({
    where: { userId: user.id, organizationId: ctx.organizationId, revokedAt: null, expiresAt: { gt: now } },
    data: { revokedAt: now, revokeReason: "Deprovisioned by the organization's identity provider (SCIM)." },
  });
  return { sessionsRevoked: r.count, membershipSuspended: m.count > 0 };
}

async function setActive(db: ScimDb, ctx: ScimContext, row: ScimRow, active: boolean, email = row.email, externalId = row.externalId): Promise<ScimRow> {
  const now = ctx.now ?? new Date();
  const wasActive = row.scimActive, deactivating = wasActive && !active, previousEmail = row.email, previousDeprovisionedAt = row.deprovisionedAt;
  const updated = await db.scimProvisionedIdentity.update({
    where: { id: row.id },
    data: { email, externalId, scimActive: active, lastSyncedAt: now, deprovisionedAt: active ? null : previousDeprovisionedAt ?? now },
  });
  if (deactivating) {
    await audit(db, ctx, "identity.scim_deprovision", updated, await cutOff(db, ctx, previousEmail));
  } else {
    await audit(db, ctx, active && !wasActive ? "identity.scim_reactivate" : "identity.scim_update", updated, {});
  }
  return updated;
}

async function load(db: ScimDb, ctx: ScimContext, id: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return db.scimProvisionedIdentity.findFirst({ where: { id, organizationId: ctx.organizationId } });
}

export async function listUsers(db: ScimDb, ctx: ScimContext, q: { filter: string | null; startIndex: string | null; count: string | null }): Promise<ScimResult> {
  const f = parseFilter(q.filter);
  if (f === "unsupported") return err(400, 'Only userName eq "..." and externalId eq "..." filters are supported.', "invalidFilter");
  const start = Math.max(1, Number.parseInt(q.startIndex ?? "1", 10) || 1);
  const count = Math.min(100, Math.max(0, Number.parseInt(q.count ?? "100", 10) || 0));
  const where: Record<string, unknown> = { organizationId: ctx.organizationId, ...(f ? { [f.field]: f.value } : {}) };
  const [total, rows] = await Promise.all([
    db.scimProvisionedIdentity.count({ where }),
    count === 0 ? Promise.resolve([] as ScimRow[]) : db.scimProvisionedIdentity.findMany({ where, orderBy: { id: "asc" }, skip: start - 1, take: count }),
  ]);
  return { status: 200, body: { schemas: [SCIM_LIST_SCHEMA], totalResults: total, startIndex: start, itemsPerPage: rows.length, Resources: rows.map((r) => toScimUser(r, ctx.baseUrl)) } };
}

export async function getUser(db: ScimDb, ctx: ScimContext, id: string): Promise<ScimResult> {
  const row = await load(db, ctx, id);
  return row ? { status: 200, body: toScimUser(row, ctx.baseUrl) } : err(404, "User not found.");
}

export async function createUser(db: ScimDb, ctx: ScimContext, body: unknown): Promise<ScimResult> {
  const p = parseUser(body);
  if ("status" in p) return p;
  const clash = await db.scimProvisionedIdentity.findFirst({ where: { organizationId: ctx.organizationId, OR: [{ externalId: p.externalId }, { email: p.email }] } });
  if (clash) return err(409, "A user with this userName or externalId is already provisioned.", "uniqueness");
  const row = await db.scimProvisionedIdentity.create({
    data: { organizationId: ctx.organizationId, externalId: p.externalId, email: p.email, scimActive: p.active, lastSyncedAt: ctx.now ?? new Date(), deprovisionedAt: p.active ? null : ctx.now ?? new Date() },
  });
  await audit(db, ctx, "identity.scim_provision", row, { active: p.active });
  return { status: 201, body: toScimUser(row, ctx.baseUrl) };
}

export async function replaceUser(db: ScimDb, ctx: ScimContext, id: string, body: unknown): Promise<ScimResult> {
  const row = await load(db, ctx, id);
  if (!row) return err(404, "User not found.");
  const p = parseUser(body);
  if ("status" in p) return p;
  const clash = await db.scimProvisionedIdentity.findFirst({ where: { organizationId: ctx.organizationId, NOT: { id: row.id }, OR: [{ externalId: p.externalId }, { email: p.email }] } });
  if (clash) return err(409, "Another provisioned user already has this userName or externalId.", "uniqueness");
  return { status: 200, body: toScimUser(await setActive(db, ctx, row, p.active, p.email, p.externalId), ctx.baseUrl) };
}

/** PATCH: supports the active flag (the operation identity providers use to deprovision) and userName/email changes. */
export async function patchUser(db: ScimDb, ctx: ScimContext, id: string, body: unknown): Promise<ScimResult> {
  const row = await load(db, ctx, id);
  if (!row) return err(404, "User not found.");
  const ops = body && typeof body === "object" ? (body as { Operations?: unknown }).Operations : undefined;
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 20) return err(400, "Operations must be a non-empty list.", "invalidSyntax");
  let active = row.scimActive, email = row.email;
  for (const raw of ops) {
    const op = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const kind = typeof op.op === "string" ? op.op.toLowerCase() : "";
    if (kind !== "replace" && kind !== "add") return err(400, `Unsupported PATCH operation "${String(op.op)}".`, "invalidSyntax");
    const path = typeof op.path === "string" ? op.path.trim() : "";
    const values: Array<[string, unknown]> = path ? [[path, op.value]] : op.value && typeof op.value === "object" ? Object.entries(op.value as Record<string, unknown>) : [];
    if (values.length === 0) return err(400, "Each operation needs a path or a value object.", "invalidSyntax");
    for (const [key, value] of values) {
      const k = key.toLowerCase();
      if (k === "active") {
        const a = parseActive(value);
        if (a === null || a === "invalid") return err(400, "active must be true or false.", "invalidValue");
        active = a;
      } else if (k === "username" || k === 'emails[type eq "work"].value' || k === "emails[primary eq true].value") {
        if (typeof value !== "string" || !EMAIL.test(value.trim())) return err(400, "userName must be an email address.", "invalidValue");
        email = value.trim().toLowerCase();
      } else if (["displayname", "name.givenname", "name.familyname", "name.formatted", "title", "department", "externalid"].includes(k) || k.startsWith("urn:ietf:params:scim:schemas:extension:enterprise")) {
        // Accepted and ignored: V19 stores only the email and status. externalId stays the id the user was created with.
      } else {
        return err(400, `Unsupported attribute "${key}".`, "invalidPath");
      }
    }
  }
  if (email !== row.email) {
    const clash = await db.scimProvisionedIdentity.findFirst({ where: { organizationId: ctx.organizationId, NOT: { id: row.id }, email } });
    if (clash) return err(409, "Another provisioned user already has this userName.", "uniqueness");
  }
  return { status: 200, body: toScimUser(await setActive(db, ctx, row, active, email), ctx.baseUrl) };
}

/** DELETE deprovisions; the record stays for the audit trail. Repeating it is harmless. */
export async function deleteUser(db: ScimDb, ctx: ScimContext, id: string): Promise<ScimResult> {
  const row = await load(db, ctx, id);
  if (!row) return err(404, "User not found.");
  if (row.scimActive) await setActive(db, ctx, row, false);
  return { status: 204, body: null };
}

export function serviceProviderConfig(baseUrl: string) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: "https://visionxixlabs.com/docs/members#scim",
    patch: { supported: true }, bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 100 }, changePassword: { supported: false }, sort: { supported: false }, etag: { supported: false },
    authenticationSchemes: [{ type: "oauthbearertoken", name: "API key", description: "A V19 API key with the scim:provision scope, sent as a bearer token.", primary: true }],
    meta: { resourceType: "ServiceProviderConfig", location: `${baseUrl}/ServiceProviderConfig` },
  };
}

export function resourceTypes(baseUrl: string) {
  return {
    schemas: [SCIM_LIST_SCHEMA], totalResults: 1, startIndex: 1, itemsPerPage: 1,
    Resources: [{ schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"], id: "User", name: "User", endpoint: "/Users", schema: SCIM_USER_SCHEMA, meta: { resourceType: "ResourceType", location: `${baseUrl}/ResourceTypes/User` } }],
  };
}
