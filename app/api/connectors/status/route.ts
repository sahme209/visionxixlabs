import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { isCloudConnectorEnabled } from "@/lib/featureFlags";

/**
 * Phase 5: GET /api/connectors/status?token=
 * Returns connector status (no credentials, only metadata).
 * Stub cloud connectors (AWS/Azure/GCP) show "unavailable" when feature flag is off.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const connectors = (payload.connectors as Record<string, unknown>) || {};

    const status: Record<
      string,
      { status: string; linkedAt?: string; verifiedAccountId?: string; verifiedCallerArn?: string }
    > = {};
    for (const [k, v] of Object.entries(connectors)) {
      const meta = v as Record<string, unknown>;
      let s = (meta.status as string) || "pending";
      if (k === "aws" || k === "azure" || k === "gcp") {
        if (!isCloudConnectorEnabled(k as "aws" | "azure" | "gcp")) {
          s = "unavailable";
        }
      }
      const entry: { status: string; linkedAt?: string; verifiedAccountId?: string; verifiedCallerArn?: string } = {
        status: s,
        linkedAt: meta.linkedAt as string | undefined,
      };
      if (k === "aws" && s === "linked" && meta.verifiedAccountId) {
        entry.verifiedAccountId = String(meta.verifiedAccountId);
        entry.verifiedCallerArn = meta.verifiedCallerArn ? String(meta.verifiedCallerArn) : undefined;
      }
      status[k] = entry;
    }

    return NextResponse.json({ success: true, connectors: status });
  } catch (e) {
    console.error("[connectors status]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
