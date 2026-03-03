import { NextRequest, NextResponse } from "next/server";
import { verifyStarterToken } from "@/lib/starterToken";
import { buildExportPack } from "@/lib/cloudOperator/buildExportPack";
import { logAudit } from "@/lib/security/auditLog";
import { eventExportDownloaded } from "@/lib/observability/events";

/**
 * Phase 4: Export Pack — tier-gated ZIP download.
 * Free: executive-summary.md only
 * Pro: summary + plan + configs
 * Growth: + drift + trend CSV
 * Enterprise: + advisory-notes.md template
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
    const buildResult = await buildExportPack(result.leadId);
    if (!buildResult.success) {
      return NextResponse.json(
        { error: buildResult.error ?? "Export failed" },
        { status: 400 }
      );
    }

    await logAudit({ leadId: result.leadId, action: "export_downloaded", actor: "user" });
    eventExportDownloaded({ leadId: result.leadId });

    return new NextResponse(new Uint8Array(buildResult.buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="axiom-export-pack.zip"',
      },
    });
  } catch (e) {
    console.error("[cloud-operator export]", e);
    return NextResponse.json({ error: "Failed to generate export pack" }, { status: 500 });
  }
}
