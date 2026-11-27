import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { founderContext } from "@/lib/founder/founderAccess";
import { validateBlueprint } from "@/lib/founder/blueprint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
const BLUEPRINT_ID = "company";

/** GET: the last 50 saved versions of the blueprint, newest first. Founder only. */
export async function GET(): Promise<NextResponse> {
  if (!await founderContext()) return fail("not_found", 404);
  try {
    const revisions = await prisma.founderBlueprintRevision.findMany({ where: { blueprintId: BLUEPRINT_ID }, orderBy: { version: "desc" }, take: 50, select: { version: true, summary: true, savedByEmail: true, createdAt: true } });
    return NextResponse.json({ ok: true, data: { revisions } }, { headers: noStore });
  } catch {
    return fail("revisions_unavailable", 503);
  }
}

const restoreSchema = z.object({ version: z.number().int().min(1), expectedVersion: z.number().int().min(1) }).strict();

/** POST { version, expectedVersion }: save an earlier version again as the newest one. History is never rewritten. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const founder = await founderContext();
  if (!founder) return fail("not_found", 404);
  const body = restoreSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("invalid_payload", 400);
  try {
    const out = await prisma.$transaction(async (tx) => {
      const old = await tx.founderBlueprintRevision.findUnique({ where: { blueprintId_version: { blueprintId: BLUEPRINT_ID, version: body.data.version } }, select: { document: true } });
      if (!old) return "not_found" as const;
      if (!validateBlueprint(old.document).ok) return "unreadable" as const;
      const next = body.data.expectedVersion + 1;
      const r = await tx.founderBlueprint.updateMany({ where: { id: BLUEPRINT_ID, version: body.data.expectedVersion }, data: { document: old.document as object, version: next, updatedByEmail: founder.email } });
      if (r.count !== 1) return "changed" as const;
      await tx.founderBlueprintRevision.create({ data: { blueprintId: BLUEPRINT_ID, version: next, document: old.document as object, summary: `Restored version ${body.data.version}`, savedByEmail: founder.email } });
      return next;
    });
    if (out === "not_found") return fail("revision_not_found", 404);
    if (out === "unreadable") return fail("revision_unreadable", 422);
    if (out === "changed") return fail("blueprint_changed", 409);
    return NextResponse.json({ ok: true, data: { version: out } }, { headers: noStore });
  } catch {
    return fail("revisions_unavailable", 503);
  }
}
