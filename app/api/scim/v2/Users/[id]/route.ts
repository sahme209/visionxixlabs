/**
 * SCIM 2.0 single user: GET, PUT (replace), PATCH (active flag, userName), DELETE (deprovision).
 * Deprovisioning keeps the record for the audit trail and revokes the person's live desktop sessions.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { deleteUser, getUser, patchUser, replaceUser, type ScimDb } from "@/lib/iam/scim/scimService";
import { inTransaction, readJson, scimAuth, scimResponse } from "../../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const a = await scimAuth(req, "GET /api/scim/v2/Users/[id]");
  if (!a.ok) return a.response;
  return scimResponse(await getUser(prisma as unknown as ScimDb, a.ctx, (await params).id));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const a = await scimAuth(req, "PUT /api/scim/v2/Users/[id]");
  if (!a.ok) return a.response;
  const id = (await params).id, body = await readJson(req);
  return scimResponse(await inTransaction((db) => replaceUser(db, a.ctx, id, body)));
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const a = await scimAuth(req, "PATCH /api/scim/v2/Users/[id]");
  if (!a.ok) return a.response;
  const id = (await params).id, body = await readJson(req);
  return scimResponse(await inTransaction((db) => patchUser(db, a.ctx, id, body)));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const a = await scimAuth(req, "DELETE /api/scim/v2/Users/[id]");
  if (!a.ok) return a.response;
  const id = (await params).id;
  return scimResponse(await inTransaction((db) => deleteUser(db, a.ctx, id)));
}
