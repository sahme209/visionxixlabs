/**
 * GET /api/compliance/export.csv
 *
 * Streams the org's compliance scorecard as CSV — same scoring the
 * /dashboard/compliance page uses, plus a 'matched_finding_ids'
 * column so auditors can trace each failing control back to the
 * exact findings that caused it.
 *
 * Columns:
 *   framework, control_id, title, description, status,
 *   matched_count, matched_finding_ids
 *
 * 'matched_finding_ids' is pipe-delimited and capped at 50 entries
 * per control — beyond that the file gets noisy and the operator
 * should just open the findings page filtered to the control.
 */

import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { COMPLIANCE_CONTROLS, scoreControl } from "@/lib/compliance/controls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csv(field: string | number | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const ctx = await requireContext();

  const findings = await prisma.axiomFinding.findMany({
    where: { run: { organizationId: ctx.organizationId } },
    select: { id: true, data: true },
    take: 5000,
  });

  // (ruleCode → finding ids) so each control row can name its matches.
  const idsByCode = new Map<string, string[]>();
  const ruleCodes: string[] = [];
  for (const f of findings) {
    const data = f.data as Record<string, unknown> | null;
    const code = data && typeof data.ruleCode === "string" ? data.ruleCode : null;
    if (!code) continue;
    ruleCodes.push(code);
    const list = idsByCode.get(code) ?? [];
    list.push(f.id);
    idsByCode.set(code, list);
  }

  const header = [
    "framework", "control_id", "title", "description", "status",
    "matched_count", "matched_finding_ids",
  ].join(",");

  const rows = COMPLIANCE_CONTROLS.map((c) => {
    const { status, matchedCount } = scoreControl(c, ruleCodes);
    const matchedIds: string[] = [];
    if (matchedCount > 0) {
      for (const [code, ids] of idsByCode) {
        const codeLower = code.toLowerCase();
        if (c.ruleCodeMatchers.some((m) => codeLower.includes(m.toLowerCase()))) {
          for (const id of ids) {
            if (matchedIds.length >= 50) break;
            matchedIds.push(id);
          }
        }
        if (matchedIds.length >= 50) break;
      }
    }
    return [
      csv(c.framework),
      csv(c.id),
      csv(c.title),
      csv(c.description),
      csv(status),
      csv(matchedCount),
      csv(matchedIds.join("|")),
    ].join(",");
  });

  const csvBody = [header, ...rows].join("\n");
  const filename = `axiom-compliance-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
