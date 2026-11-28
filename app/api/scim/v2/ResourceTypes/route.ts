import type { NextRequest } from "next/server";
import { resourceTypes } from "@/lib/iam/scim/scimService";
import { scimAuth, scimResponse } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const a = await scimAuth(req, "GET /api/scim/v2/ResourceTypes");
  if (!a.ok) return a.response;
  return scimResponse({ status: 200, body: resourceTypes(a.ctx.baseUrl) });
}
