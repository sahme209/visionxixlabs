import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { isValidUtcCron, nextCronOccurrence } from "@/lib/integrations/airflow/schedule";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/airflow/automations", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const organizationId = String(session.organizationId);
  const [automations, executions] = await Promise.all([
    prisma.airflowAutomation.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    prisma.airflowAutomationExecution.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return NextResponse.json({ ok: true, data: { automations, executions } });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "policy:manage", route: "POST /api/desktop/airflow/automations", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const organizationId = String(session.organizationId);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const dagId = typeof body?.dagId === "string" ? body.dagId.trim() : "";
  const triggerMode = body?.triggerMode === "schedule" ? "schedule" : body?.triggerMode === "dag_completion" ? "dag_completion" : null;
  const actionType = ["none", "open_pull_request", "deploy"].includes(String(body?.actionType)) ? String(body?.actionType) : null;
  const scheduleCron = triggerMode === "schedule" && typeof body?.scheduleCron === "string" ? body.scheduleCron.trim() : null;
  if (!name || name.length > 120 || !dagId || !triggerMode || !actionType || (scheduleCron && !isValidUtcCron(scheduleCron)) || (triggerMode === "schedule" && !scheduleCron)) return NextResponse.json({ ok: false, error: "invalid_automation_configuration" }, { status: 400 });
  const connection = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } }, select: { id: true, status: true } });
  if (!connection || connection.status !== "active") return NextResponse.json({ ok: false, error: "airflow_not_connected" }, { status: 409 });
  const environmentId = typeof body?.environmentId === "string" && body.environmentId ? body.environmentId : null;
  const environment = environmentId ? await prisma.environment.findFirst({ where: { id: environmentId, organizationId } }) : null;
  if (actionType === "deploy" && !environment) return NextResponse.json({ ok: false, error: "deployment_environment_required" }, { status: 400 });
  const repositoryFullName = typeof body?.repositoryFullName === "string" && /^[^/\s]+\/[^/\s]+$/.test(body.repositoryFullName) ? body.repositoryFullName : null;
  if (actionType !== "none" && !repositoryFullName) return NextResponse.json({ ok: false, error: "repository_required" }, { status: 400 });
  const dependencyDagIds = Array.isArray(body?.dependencyDagIds) ? Array.from(new Set(body.dependencyDagIds.filter((value): value is string => typeof value === "string" && Boolean(value.trim()) && value !== dagId).map((value) => value.trim()))).slice(0, 20) : [];
  // Every GitHub/cloud write follows Axiom's explicit-approval rule.
  const approvalRequired = actionType === "none" ? body?.approvalRequired !== false : true;
  const automation = await prisma.airflowAutomation.create({ data: {
    organizationId, connectionId: connection.id, name, dagId, triggerMode, scheduleCron,
    requiredDagState: ["success", "failed", "any"].includes(String(body?.requiredDagState)) ? String(body?.requiredDagState) : "success",
    dependencyDagIds, actionType, repositoryFullName,
    sourceRef: typeof body?.sourceRef === "string" ? body.sourceRef.trim() || null : null,
    sourceKind: body?.sourceKind === "tag" ? "tag" : "branch",
    pullRequestBase: typeof body?.pullRequestBase === "string" ? body.pullRequestBase.trim() || null : null,
    pullRequestTitle: typeof body?.pullRequestTitle === "string" ? body.pullRequestTitle.trim() || null : null,
    environmentId,
    promotedFromExecutionId: typeof body?.promotedFromExecutionId === "string" ? body.promotedFromExecutionId || null : null,
    approvalRequired,
    maxRetries: Math.min(10, Math.max(1, Number.isInteger(body?.maxRetries) ? Number(body?.maxRetries) : 3)),
    retryDelaySeconds: Math.min(86_400, Math.max(30, Number.isInteger(body?.retryDelaySeconds) ? Number(body?.retryDelaySeconds) : 60)),
    notifyOnSuccess: body?.notifyOnSuccess !== false, notifyOnFailure: body?.notifyOnFailure !== false,
    nextScheduledAt: scheduleCron ? nextCronOccurrence(scheduleCron) : null,
    createdByUserId: String(session.userId),
  } });
  await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "airflow.automation.created", subjectKind: "policy", subjectId: automation.id, summary: `Created governed Airflow automation ${name} for DAG ${dagId}`, actorUserId: String(session.userId) });
  return NextResponse.json({ ok: true, data: { automation } }, { status: 201 });
}
