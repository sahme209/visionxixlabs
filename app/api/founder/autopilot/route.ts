import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { founderContext } from "@/lib/founder/founderAccess";
import { validateBlueprint } from "@/lib/founder/blueprint";
import { DEFAULT_BLUEPRINT } from "@/lib/founder/defaultBlueprint";
import { AUTOPILOT_ACTOR } from "@/lib/founder/autopilot";
import { runFounderAutopilot } from "@/lib/founder/founderAutopilot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
const BLUEPRINT_ID = "company";

/** GET: whether the autopilot is paused and its last 20 runs that changed the map. Founder only. */
export async function GET(): Promise<NextResponse> {
  if (!await founderContext()) return fail("not_found", 404);
  try {
    const [row, runs] = await Promise.all([
      prisma.founderBlueprint.findUnique({ where: { id: BLUEPRINT_ID }, select: { document: true } }),
      prisma.founderBlueprintRevision.findMany({ where: { blueprintId: BLUEPRINT_ID, savedByEmail: AUTOPILOT_ACTOR }, orderBy: { version: "desc" }, take: 20, select: { version: true, summary: true, createdAt: true } }),
    ]);
    const doc = row ? validateBlueprint(row.document) : null;
    const paused = doc?.ok ? doc.blueprint.autopilot.paused : false;
    return NextResponse.json({ ok: true, data: { paused, runs } }, { headers: noStore });
  } catch { return fail("autopilot_unavailable", 503); }
}

/** POST: run the autopilot now. Founder only. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  if (!await founderContext()) return fail("not_found", 404);
  try { return NextResponse.json({ ok: true, data: await runFounderAutopilot() }, { headers: noStore }); }
  catch { return fail("autopilot_unavailable", 503); }
}

const patchSchema = z.object({ paused: z.boolean(), expectedVersion: z.number().int().min(0) }).strict();

/** PATCH: pause or resume the autopilot, saved as a new version. Founder only. */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const founder = await founderContext();
  if (!founder) return fail("not_found", 404);
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("invalid_payload", 400);
  try {
    const version = await prisma.$transaction(async (tx) => {
      const row = await tx.founderBlueprint.findUnique({ where: { id: BLUEPRINT_ID }, select: { document: true, version: true } });
      if ((row?.version ?? 0) !== body.data.expectedVersion) return null;
      const parsed = row ? validateBlueprint(row.document) : { ok: true as const, blueprint: DEFAULT_BLUEPRINT };
      if (!parsed.ok) return null;
      const next = { ...parsed.blueprint, autopilot: { paused: body.data.paused } };
      const v = body.data.expectedVersion + 1;
      if (row) { const r = await tx.founderBlueprint.updateMany({ where: { id: BLUEPRINT_ID, version: body.data.expectedVersion }, data: { document: next as object, version: v, updatedByEmail: founder.email } }); if (r.count !== 1) return null; }
      else await tx.founderBlueprint.create({ data: { id: BLUEPRINT_ID, document: next as object, version: v, updatedByEmail: founder.email } });
      await tx.founderBlueprintRevision.create({ data: { blueprintId: BLUEPRINT_ID, version: v, document: next as object, summary: body.data.paused ? "Paused the autopilot." : "Resumed the autopilot.", savedByEmail: founder.email } });
      return v;
    });
    if (version === null) return fail("blueprint_changed", 409);
    return NextResponse.json({ ok: true, data: { version, paused: body.data.paused } }, { headers: noStore });
  } catch { return fail("autopilot_unavailable", 503); }
}
