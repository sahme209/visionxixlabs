import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { AccountSettingsForm } from "@/components/auth/AccountSettingsForm";
import { DesktopSessionsPanel } from "@/components/auth/DesktopSessionsPanel";
import { AuthCompanionShell } from "@/components/auth/AuthCompanionShell";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.userId || !context.email) redirect("/auth/signin?callbackUrl=/account");
  const user = await prisma.user.findUnique({ where: { id: context.userId }, select: { name: true } });
  const canManageOrganization = isAdminOrOwner({ email: context.email, roles: context.roles });
  return (
    <AuthCompanionShell>
      <div className="mx-auto max-w-[1400px]">
        <AuthCompanionHeader email={context.email} />
        <section className="py-14 sm:py-20">
          <p className="text-[10px] uppercase tracking-[0.22em] text-orange-300">Axiom web companion · account settings</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Keep your profile current.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">Manage your personal profile and paired desktop sessions here. Organization authority belongs in Axiom Control.</p>
          <div className="mt-8 max-w-3xl">
            <AccountSettingsForm initialDisplayName={user?.name ?? context.displayName ?? ""} email={context.email} />
          </div>
          <div className="mt-4 max-w-3xl"><DesktopSessionsPanel /></div>
          {canManageOrganization && <div className="mt-4 max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><p className="text-sm font-medium text-zinc-200">Organization controls moved to Axiom Control</p><p className="mt-2 text-xs leading-5 text-zinc-500">Models, Agent permissions, integrations, usage, and billing now share one authoritative administration surface.</p><Link href="/control" className="mt-4 inline-flex text-sm text-orange-300 hover:text-orange-200">Open Axiom Control →</Link></div>}
          <Link href="/auth/success" className="mt-8 inline-flex text-sm text-orange-300 transition hover:text-orange-200">← Back to overview</Link>
        </section>
      </div>
    </AuthCompanionShell>
  );
}
