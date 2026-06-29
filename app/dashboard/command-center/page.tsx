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

  return (
    <>
      {state ? (
        <IntelligenceBand state={state} />
      ) : (
        <IntelligenceBandFallback reason={fallbackReason} />
      )}
      <CommandCenterClient />
    </>
  );
}
