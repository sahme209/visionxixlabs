import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getScaffoldZipPath } from "@/lib/leads/scaffoldGenerator";
import fs from "fs";

/**
 * GET /api/admin/leads/[id]/scaffold/download
 * Download scaffold zip file. Admin only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(_req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const zipPath = getScaffoldZipPath(id);
  if (!zipPath) {
    return NextResponse.json(
      { error: "Scaffold not found. Generate scaffold first." },
      { status: 404 }
    );
  }

  try {
    const buffer = fs.readFileSync(zipPath);
    const filename = `website-scaffold-${id.slice(0, 8)}.zip`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("[Admin Scaffold Download] Error:", e);
    return NextResponse.json({ error: "Failed to read scaffold" }, { status: 500 });
  }
}
