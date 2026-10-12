import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { AccountSettingsForm } from "@/components/auth/AccountSettingsForm";
import { DesktopSessionsPanel } from "@/components/auth/DesktopSessionsPanel";
import { AuthCompanionShell } from "@/components/auth/AuthCompanionShell";
import { WorkspaceAISettingsForm } from "@/components/auth/WorkspaceAISettingsForm";
import { AccountBillingPanel } from "@/components/auth/AccountBillingPanel";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSelfServiceBillingEnabled } from "@/lib/billing/publicPlanCatalog";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.userId || !context.email) redirect("/auth/signin?callbackUrl=/account");
  const [user, billingPlan] = await Promise.all([
    prisma.user.findUnique({ where: { id: context.userId }, select: { name: true } }),
    readBillingPlan(String(context.organizationId ?? "")),
  ]);
  const canManageBilling = isAdminOrOwner({ email: context.email, roles: context.roles });
  const publicPlanLabel = billingPlan.tier === "growth" ? "Pro" : billingPlan.tier === "enterprise" ? "Enterprise" : billingPlan.tier === "starter" ? "Legacy Starter" : "Free";
  return (
    <AuthCompanionShell>
      <div className="mx-auto max-w-[1400px]">
        <AuthCompanionHeader email={context.email} />
        <section className="py-14 sm:py-20">
          <p className="text-[10px] uppercase tracking-[0.22em] text-orange-300">Axiom web companion · account settings</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Keep your profile current.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">Your web companion is for your account and release context. Deployment authority, provider credentials, and approvals stay protected in Axiom Agent.</p>
          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_0.72fr] lg:items-start">
            <AccountSettingsForm initialDisplayName={user?.name ?? context.displayName ?? ""} email={context.email} />
            <AccountBillingPanel planLabel={publicPlanLabel} status={billingPlan.status} billingEnabled={isSelfServiceBillingEnabled()} canManage={canManageBilling} hasStripeCustomer={Boolean(billingPlan.stripeCustomerId)} />
          </div>
          <div className="mt-4 max-w-3xl"><DesktopSessionsPanel /></div>
          {canManageBilling && <div className="mt-4 max-w-xl"><WorkspaceAISettingsForm /></div>}
          <Link href="/auth/success" className="mt-8 inline-flex text-sm text-orange-300 transition hover:text-orange-200">← Back to overview</Link>
        </section>
      </div>
    </AuthCompanionShell>
  );
}
