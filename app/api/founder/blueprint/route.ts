import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { founderContext } from "@/lib/founder/founderAccess";
import { validateBlueprint } from "@/lib/founder/blueprint";
import { DEFAULT_BLUEPRINT } from "@/lib/founder/defaultBlueprint";
import { readFounderSignals } from "@/lib/founder/founderSignals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });
const BLUEPRINT_ID = "company";

/** GET: the company blueprint (the default draft until the founder saves one) and live signals. Founder only. */
export async function GET(): Promise<NextResponse> {
  if (!await founderContext()) return fail("not_found", 404);
  try {
    const row = await prisma.founderBlueprint.findUnique({ where: { id: BLUEPRINT_ID } });
    const stored = row ? validateBlueprint(row.document) : null;
    const signals = await readFounderSignals();
    return NextResponse.json({ ok: true, data: { blueprint: stored?.ok ? stored.blueprint : DEFAULT_BLUEPRINT, version: row?.version ?? 0, saved: Boolean(row), unreadable: Boolean(row && stored && !stored.ok), updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedByEmail ?? null, signals } }, { headers: noStore });
  } catch {
    return fail("blueprint_unavailable", 503);
  }
}

const putSchema = z.object({ blueprint: z.unknown(), expectedVersion: z.number().int().min(0), summary: z.string().trim().min(1).max(200) }).strict();

/** PUT: save the blueprint if nobody saved since the version the founder read. Keeps every version. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const founder = await founderContext();
  if (!founder) return fail("not_found", 404);
  const raw = await request.text();
  if (raw.length > 1_000_000) return fail("payload_too_large", 413);
  let parsedJson: unknown; try { parsedJson = JSON.parse(raw); } catch { return fail("invalid_payload", 400); }
  const body = putSchema.safeParse(parsedJson);
  if (!body.success) return fail("invalid_payload", 400);
  const valid = validateBlueprint(body.data.blueprint);
  if (!valid.ok) return fail("blueprint_invalid", 422, { issues: valid.errors });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.founderBlueprint.findUnique({ where: { id: BLUEPRINT_ID }, select: { version: true } });
      if ((current?.version ?? 0) !== body.data.expectedVersion) return null;
      const version = body.data.expectedVersion + 1;
      if (current) {
        const r = await tx.founderBlueprint.updateMany({ where: { id: BLUEPRINT_ID, version: body.data.expectedVersion }, data: { document: valid.blueprint as object, version, updatedByEmail: founder.email } });
        if (r.count !== 1) return null;
      } else {
        await tx.founderBlueprint.create({ data: { id: BLUEPRINT_ID, document: valid.blueprint as object, version, updatedByEmail: founder.email } });
      }
      await tx.founderBlueprintRevision.create({ data: { blueprintId: BLUEPRINT_ID, version, document: valid.blueprint as object, summary: body.data.summary, savedByEmail: founder.email } });
      return version;
    });
    if (result === null) return fail("blueprint_changed", 409, { detail: "The blueprint was saved elsewhere since you opened it. Reload to see the latest version." });
    return NextResponse.json({ ok: true, data: { version: result } }, { headers: noStore });
  } catch {
    return fail("blueprint_unavailable", 503);
  }
}
