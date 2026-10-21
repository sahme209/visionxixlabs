/**
 * GET  /api/axiom/scheduler — list schedules for the org
 * POST /api/axiom/scheduler — create a new schedule
 * PUT  /api/axiom/scheduler — update a schedule
 * DELETE /api/axiom/scheduler — delete a schedule
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isWorkspaceAdminRole } from "@/lib/desktop/desktopAuthorization";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
} from "@/lib/axiom/scheduler";
import type { ScheduleFrequency } from "@/lib/axiom/enums";

const VALID_FREQUENCIES = new Set(["daily", "weekly"]);

async function authenticate() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) {
    return null;
  }

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
  if (!entitlements.axiomExecution) return null;

  return userId;
}

/** Session identity and subscription are not workspace authority. Recheck
 * accepted membership on every request; invitations and store failures deny. */
async function authorizedForOrganization(userId: string, organizationId: string, mutation = false): Promise<boolean> {
  try {
    const membership = await prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true, acceptedAt: true },
    });
    return Boolean(membership?.acceptedAt && (!mutation || isWorkspaceAdminRole(membership.role)));
  } catch { return false; }
}

// ---- GET: list schedules ----

export async function GET(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  if (!await authorizedForOrganization(userId, organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const schedules = await listSchedules(organizationId);
  return NextResponse.json({ schedules });
}

// ---- POST: create schedule ----

export async function POST(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { organizationId, cloudAccountId, frequency, timezone } = body;

  if (typeof organizationId !== "string" || !organizationId || typeof cloudAccountId !== "string" || !cloudAccountId) {
    return NextResponse.json({ error: "organizationId and cloudAccountId are required" }, { status: 400 });
  }

  if (typeof frequency !== "string" || !VALID_FREQUENCIES.has(frequency)) {
    return NextResponse.json({ error: "frequency must be 'daily' or 'weekly'" }, { status: 400 });
  }

  if (timezone !== undefined && typeof timezone !== "string") return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  if (!await authorizedForOrganization(userId, organizationId, true)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const account = await prisma.cloudAccount.findUnique({ where: { id: cloudAccountId } });
  if (!account || account.organizationId !== organizationId) {
    return NextResponse.json({ error: "Cloud account not found" }, { status: 404 });
  }

  const existing = await prisma.axiomScheduledRun.findFirst({
    where: { organizationId, cloudAccountId, enabled: true },
  });
  if (existing) {
    return NextResponse.json({ error: "A schedule already exists for this account. Update or delete it first." }, { status: 409 });
  }

  const id = await createSchedule({
    organizationId,
    cloudAccountId,
    frequency: frequency as ScheduleFrequency,
    timezone,
  });

  return NextResponse.json({ id }, { status: 201 });
}

// ---- PUT: update schedule ----

export async function PUT(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { scheduleId, frequency, enabled, timezone } = body;

  if (typeof scheduleId !== "string" || !scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }

  if (frequency !== undefined && (typeof frequency !== "string" || !VALID_FREQUENCIES.has(frequency))) {
    return NextResponse.json({ error: "frequency must be 'daily' or 'weekly'" }, { status: 400 });
  }

  if (enabled !== undefined && typeof enabled !== "boolean" || timezone !== undefined && typeof timezone !== "string") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const schedule = await prisma.axiomScheduledRun.findUnique({ where: { id: scheduleId }, select: { organizationId: true } });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  if (!await authorizedForOrganization(userId, schedule.organizationId, true)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const updated = await updateSchedule(scheduleId, schedule.organizationId, { frequency: frequency as ScheduleFrequency | undefined, enabled, timezone });
  if (!updated) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// ---- DELETE: delete schedule ----

export async function DELETE(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scheduleId = req.nextUrl.searchParams.get("scheduleId");
  if (typeof scheduleId !== "string" || !scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }

  const schedule = await prisma.axiomScheduledRun.findUnique({ where: { id: scheduleId }, select: { organizationId: true } });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  if (!await authorizedForOrganization(userId, schedule.organizationId, true)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!await deleteSchedule(scheduleId, schedule.organizationId)) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
