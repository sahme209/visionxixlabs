/**
 * SCIM 2.0 Users collection: GET lists or filters (userName/externalId eq), POST provisions.
 * Auth: API key with scim:provision. Provisioning never grants workspace access by itself.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createUser, listUsers, type ScimDb } from "@/lib/iam/scim/scimService";
import { inTransaction, readJson, scimAuth, scimResponse } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const a = await scimAuth(req, "GET /api/scim/v2/Users");
  if (!a.ok) return a.response;
  const p = req.nextUrl.searchParams;
  return scimResponse(await listUsers(prisma as unknown as ScimDb, a.ctx, { filter: p.get("filter"), startIndex: p.get("startIndex"), count: p.get("count") }));
}

export async function POST(req: NextRequest) {
  const a = await scimAuth(req, "POST /api/scim/v2/Users");
  if (!a.ok) return a.response;
  const body = await readJson(req);
  return scimResponse(await inTransaction((db) => createUser(db, a.ctx, body)));
}
