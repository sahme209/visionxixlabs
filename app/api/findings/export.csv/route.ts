/**
 * GET /api/findings/export.csv
 *
 * Streams an org-scoped findings CSV with the same filters the
 * /dashboard/findings page supports (?severity, ?q). Up to 5000
 * rows per response — that's an order of magnitude more than the
 * dashboard's display window, so operators can grab a full week
 * of scheduled scans in one download.
 *
 * Columns:
 *   id, created_at, run_id, provider, region, severity, category,
 *   title, description, affected_resources, confidence
 *
 * Content-Disposition: attachment so browsers save the .csv directly.
 */

import { type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Severity = "info" | "low" | "medium" | "high" | "critical";

function clampSev(input: string | null): Severity | null {
  if (input === "critical" || input === "high" || input === "medium" || input === "low" || input === "info") return input;
  return null;
}

/** CSV-escape: wrap in quotes, double any embedded quote. */
function csv(field: string | number | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const ctx = await requireContext();
  const severityFilter = clampSev(req.nextUrl.searchParams.get("severity"));
  const search = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const accountId = (req.nextUrl.searchParams.get("accountId") ?? "").trim();

  const findings = await prisma.axiomFinding.findMany({
    where: {
      run: {
        organizationId: ctx.organizationId,
        ...(accountId.length > 0 ? { cloudAccountId: accountId } : {}),
      },
      ...(severityFilter ? { severity: severityFilter } : {}),
      ...(search.length > 0
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      createdAt: true,
      runId: true,
      provider: true,
      region: true,
      severity: true,
      category: true,
      title: true,
      description: true,
      affectedResources: true,
      confidence: true,
    },
  });

  const header = [
    "id", "created_at", "run_id", "provider", "region", "severity",
    "category", "title", "description", "affected_resources", "confidence",
  ].join(",");

  const rows = findings.map((f) => {
    const resources = Array.isArray(f.affectedResources)
      ? (f.affectedResources as unknown[]).map((r) => String(r)).join("|")
      : "";
    return [
      csv(f.id),
      csv(f.createdAt.toISOString()),
      csv(f.runId),
      csv(f.provider),
      csv(f.region),
      csv(f.severity),
      csv(f.category),
      csv(f.title),
      csv(f.description),
      csv(resources),
      csv(f.confidence),
    ].join(",");
  });

  const csvBody = [header, ...rows].join("\n");
  const filename = `axiom-findings-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
