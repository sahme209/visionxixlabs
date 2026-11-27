/**
 * /control/trust-tools — tamper-evident audit (A11), policy replay (A12) and
 * change impact preview (A13) on one page.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { CockpitPageHeader } from "@/components/cockpit/CockpitPageHeader";
import { GovernanceTools } from "@/components/governanceTools/GovernanceTools";

export const metadata: Metadata = { title: "Trust tools · V19" };
export const dynamic = "force-dynamic";

export default async function TrustToolsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) redirect("/auth/signin?callbackUrl=%2Fcontrol%2Ftrust-tools");
  const organizationId = String(ctx.organizationId);
  // Sealing needs a stable session id; the server route re-checks admin role regardless.
  const canSeal = ctx.sessionUserId ? await authorizedForOrganization(String(ctx.sessionUserId), organizationId, true) : false;
  return (
    <div className="w-full min-w-0">
      <CockpitPageHeader title="Trust tools" description="Prove the audit log is untouched, test a rule against real history before enabling it, and see what a change touches before approving it." howItWorks={<>
        <p>Verify the audit log has not been edited, download an anchor to keep outside V19 and check it later, replay a draft rule over the last 30 days, and preview a change&apos;s blast radius and rollback.</p>
        <p>Verify, anchors, replay and preview are read-only. Sealing is limited to owners and admins and only adds a seal; it never changes events. Nothing here enables a policy.</p>
      </>} />
      <div className="mt-6" />
      <GovernanceTools organizationId={organizationId} canSeal={canSeal} />
    </div>
  );
}
