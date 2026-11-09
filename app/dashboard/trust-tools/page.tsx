/**
 * /control/trust-tools — tamper-evident audit (A11), policy replay (A12) and
 * change impact preview (A13) on one page.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { ModuleIntro } from "@/components/portal/ModuleIntro";
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
      <ModuleIntro
        title="Trust tools"
        explanation="Prove the audit log is untouched, test a rule against real history before enabling it, and see what a change touches before approving it."
        helpsYouDo={["Verify the audit log has not been edited", "Replay a draft rule over the last 30 days", "Preview a change's blast radius and rollback"]}
        connectFirst={["Audit activity in this workspace", "Approval history for replay (cloud actions)"]}
        aiEngineers={[]}
        approval={{ severity: "read_only", note: "Verify, replay and preview are read-only. Sealing is limited to owners and admins and only adds a seal; it never changes events. Nothing here enables a policy." }}
        storageKey="trust-tools"
        lastReviewed="2026-11-09"
      />
      <GovernanceTools organizationId={organizationId} canSeal={canSeal} />
    </div>
  );
}
