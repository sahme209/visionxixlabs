import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { disconnectConnector } from "@/lib/connectors/disconnectConnector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const ctx = await requireContext();
  await disconnectConnector(
    { organizationId: ctx.organizationId, userId: ctx.userId, email: ctx.email },
    "azure",
  );
  return NextResponse.json({ ok: true });
}
