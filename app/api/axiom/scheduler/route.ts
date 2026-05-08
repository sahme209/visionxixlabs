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
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
} from "@/lib/axiom/scheduler";
import type { ScheduleFrequency } from "@/lib/axiom/enums";

const VALID_FREQUENCIES = new Set(["daily", "weekly"]);

async function authenticate(req: NextRequest) {
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

// ---- GET: list schedules ----

export async function GET(req: NextRequest) {
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  const schedules = await listSchedules(organizationId);
  return NextResponse.json({ schedules });
}

// ---- POST: create schedule ----

export async function POST(req: NextRequest) {
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { organizationId, cloudAccountId, frequency, timezone } = body;

  if (!organizationId || !cloudAccountId) {
    return NextResponse.json({ error: "organizationId and cloudAccountId are required" }, { status: 400 });
  }

  if (!frequency || !VALID_FREQUENCIES.has(frequency)) {
    return NextResponse.json({ error: "frequency must be 'daily' or 'weekly'" }, { status: 400 });
  }

  const account = await prisma.cloudAccount.findUnique({ where: { id: cloudAccountId } });
  if (!account || account.organizationId !== organizationId) {
    return NextResponse.json({ error: "Cloud account not found" }, { status: 404 });
  }

  const existing = await prisma.axiomScheduledRun.findFirst({
    where: { cloudAccountId, enabled: true },
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
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { scheduleId, frequency, enabled, timezone } = body;

  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }

  if (frequency && !VALID_FREQUENCIES.has(frequency)) {
    return NextResponse.json({ error: "frequency must be 'daily' or 'weekly'" }, { status: 400 });
  }

  await updateSchedule(scheduleId, { frequency, enabled, timezone });
  return NextResponse.json({ ok: true });
}

// ---- DELETE: delete schedule ----

export async function DELETE(req: NextRequest) {
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scheduleId = req.nextUrl.searchParams.get("scheduleId");
  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }

  await deleteSchedule(scheduleId);
  return NextResponse.json({ ok: true });
}
