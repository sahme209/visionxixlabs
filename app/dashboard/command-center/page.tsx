/**
 * /dashboard/command-center — Phase 651 server shell.
 *
 * The page is now a thin server component:
 *   1. Auth gate
 *   2. Fetch canonical ControlPlaneState (server-side, no extra HTTP hop)
 *   3. Render the IntelligenceBand (action registry counts + top 3
 *      next-best-actions + autonomous loop status) ABOVE the existing
 *      client experience
 *   4. Render CommandCenterClient (the prior 1879-line interactive page)
 *
 * Founder audit answer: the first paint of Command Center now surfaces
 * what Axiom can do right now — pulled from typed metadata and real
 * control-plane state — instead of decorative cards.
 */

import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { buildControlPlaneState } from "@/lib/controlPlane/controlPlaneBuilder";
import type { ControlPlaneState } from "@/lib/controlPlane/controlPlaneModel";
import { prisma } from "@/lib/db";
import CommandCenterClient from "./CommandCenterClient";
import { IntelligenceBand, IntelligenceBandFallback } from "./IntelligenceBand";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    redirect("/auth/signin?callbackUrl=/dashboard/command-center");
  }

  let state: ControlPlaneState | null = null;
  let fallbackReason: string | undefined;
  try {
    state = await buildControlPlaneState();
  } catch (err) {
    fallbackReason = err instanceof Error ? err.message.slice(0, 200) : "control plane unavailable";
  }

  // Phase 663: 24h dispatch count + most-recent dispatch timestamp.
  // Best-effort — if the table is missing the band still renders.
  let dispatch24h = 0;
  let lastDispatchAt: Date | null = null;
  if (ctx.organizationId) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [count, latest] = await Promise.all([
        prisma.aiRationaleEnrichment.count({
          where: {
            organizationId: String(ctx.organizationId),
            targetKind: "workforce_action_execution",
            updatedAt: { gte: since },
          },
        }),
        prisma.aiRationaleEnrichment.findFirst({
          where: {
            organizationId: String(ctx.organizationId),
            targetKind: "workforce_action_execution",
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
      ]);
      dispatch24h = count;
      lastDispatchAt = latest?.updatedAt ?? null;
    } catch { /* skip */ }
  }

  return (
    <>
      {state ? (
        <IntelligenceBand state={state} dispatch24h={dispatch24h} lastDispatchAt={lastDispatchAt} />
      ) : (
        <IntelligenceBandFallback reason={fallbackReason} />
      )}
      <CommandCenterClient />
    </>
  );
}
