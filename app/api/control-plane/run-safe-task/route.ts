/**
 * POST /api/control-plane/run-safe-task
 *
 * Executes a single safe non-destructive task. Strict allow-list — see
 * `lib/controlPlane/safeTaskRunner.ts`. Unsafe / destructive task kinds
 * are blocked with a typed reason + safe alternative.
 *
 * Body: { kind: SafeTaskKind, payload?: unknown }
 */

import { NextResponse } from "next/server";
import { runSafeTask, isSafeTaskKind, listSafeTaskKinds } from "@/lib/controlPlane/safeTaskRunner";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

function isValidBody(v: unknown): v is { kind: string; payload?: unknown } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.kind === "string";
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const body = await req.json().catch(() => null);
    if (!isValidBody(body)) throw AxiomErrors.validation("safe_task.bad_input", "Body must be { kind, payload? }.");
    if (!isSafeTaskKind(body.kind)) {
      throw AxiomErrors.validation("safe_task.unknown_kind", `Unknown or unsafe task. Allowed: ${listSafeTaskKinds().join(", ")}.`);
    }

    const result = await runSafeTask({ kind: body.kind, payload: body.payload });
    return NextResponse.json(apiSuccess(result), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(apiSuccess({ allowedKinds: listSafeTaskKinds() }), { status: 200 });
}
