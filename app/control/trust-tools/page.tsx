/**
 * /control/trust-tools — tamper-evident audit (A11), policy replay (A12) and
 * change impact preview (A13) on one page.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { GovernanceTools } from "@/components/governanceTools/GovernanceTools";

export const metadata: Metadata = { title: "Trust tools · Axiom" };
export const dynamic = "force-dynamic";

export default async function TrustToolsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) redirect("/auth/signin?callbackUrl=%2Fcontrol%2Ftrust-tools");
  const organizationId = String(ctx.organizationId);
  // Sealing needs a stable session id; the server route re-checks admin role regardless.
  const canSeal = ctx.sessionUserId ? await authorizedForOrganization(String(ctx.sessionUserId), organizationId, true) : false;
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1>Trust tools</h1>
      <p className="mt-1 max-w-2xl text-[13px] leading-5 text-zinc-400">Prove the audit log is untouched, test a rule against real history before enabling it, and see what a change touches before approving it.</p>
      <GovernanceTools organizationId={organizationId} canSeal={canSeal} />
    </div>
  );
}
