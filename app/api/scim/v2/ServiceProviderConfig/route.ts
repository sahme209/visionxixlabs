import type { NextRequest } from "next/server";
import { serviceProviderConfig } from "@/lib/iam/scim/scimService";
import { scimAuth, scimResponse } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const a = await scimAuth(req, "GET /api/scim/v2/ServiceProviderConfig");
  if (!a.ok) return a.response;
  return scimResponse({ status: 200, body: serviceProviderConfig(a.ctx.baseUrl) });
}
