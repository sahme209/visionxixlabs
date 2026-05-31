/**
 * POST /api/workforce/department/[dept]/run-agi — Phase 561.
 *
 * Department-scoped variant of the Phase 559 bulk sweep. Lets an
 * operator refresh AGI rationales for one team without invoking the
 * entire workforce. Same sequential pacing, same deadline-bounded
 * loop, same per-engineer fallback semantics.
 *
 * 404s on unknown department slugs (closed-union check) so the
 * URL space stays honest.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  AGENT_WORKFORCE_REGISTRY,
  type WorkforceDepartment,
} from "@/lib/workforce/agentWorkforceRegistry";
import { runEngineerAgi, persistEngineerAgiResult } from "@/lib/workforce/engineerAgi";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const HARD_DEADLINE_MS = 270_000;

const DEPARTMENT_SET = new Set<WorkforceDepartment>([
  "perception", "reasoning", "planning", "safety", "verification",
  "memory", "workflow", "devops", "database", "security", "finops",
  "observability", "incident_response", "marketing", "sales",
]);

function clampDept(input: string): WorkforceDepartment | null {
  return DEPARTMENT_SET.has(input as WorkforceDepartment) ? (input as WorkforceDepartment) : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dept: string }> },
) {
  const ctx = await requireContext();
  const { dept: deptRaw } = await params;
  const dept = clampDept(deptRaw);
  if (!dept) {
    return NextResponse.json({ error: "department not found" }, { status: 404 });
  }

  const engineers = AGENT_WORKFORCE_REGISTRY.filter(
    (e) => e.productLayer === "client" && e.department === dept,
  );
  if (engineers.length === 0) {
    return NextResponse.json({ error: "no client engineers in department" }, { status: 404 });
  }

  const org = String(ctx.organizationId);
  const startedAt = Date.now();
  const correlationId = `engineer_agi_dept_${Date.now().toString(36)}` as CorrelationId;
  const counts = { ai_generated: 0, fallback_rules: 0, error: 0, skipped_deadline: 0 };

  for (const engineer of engineers) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) {
      counts.skipped_deadline = engineers.length - (counts.ai_generated + counts.fallback_rules + counts.error);
      break;
    }
    try {
      const result = await runEngineerAgi(engineer, org);
      await persistEngineerAgiResult(engineer, org, result);
      counts[result.outcome] += 1;
    } catch (err) {
      console.warn("[run-agi-dept]", dept, "engineer", engineer.id, "failed:", err instanceof Error ? err.message : err);
      counts.error += 1;
    }
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: counts.error > 0 ? "failure" : "success",
    entityRef: `workforce:department:${dept}`,
    correlationId,
    detail: {
      action: "engineer.run_agi_department",
      department: dept,
      engineerCount: engineers.length,
      durationMs: Date.now() - startedAt,
      result: counts,
    },
  });

  return NextResponse.redirect(
    new URL(`/dashboard/workforce/department/${dept}`, req.url),
    303,
  );
}
