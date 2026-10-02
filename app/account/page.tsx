import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { AccountSettingsForm } from "@/components/auth/AccountSettingsForm";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.userId || !context.email) redirect("/auth/signin?callbackUrl=/account");
  const user = await prisma.user.findUnique({ where: { id: context.userId }, select: { name: true } });
  return (
    <main className="axiom-canvas min-h-screen px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <AuthCompanionHeader email={context.email} />
        <section className="py-14 sm:py-20">
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">Axiom web companion · account settings</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Keep your profile current.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">Your web companion is for your account and release context. Deployment authority, provider credentials, and approvals stay protected in Axiom Agent.</p>
          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_0.72fr] lg:items-start">
            <AccountSettingsForm initialDisplayName={user?.name ?? context.displayName ?? ""} email={context.email} />
            <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7">
              <p className="text-[10px] uppercase tracking-[0.18em] text-violet-300">Workspace access</p>
              <h2 className="mt-3 text-xl font-medium tracking-[-0.03em] text-zinc-100">No-charge pilot</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">Your account can use the browser companion while pilot access is scoped with the Axiom team. There is no checkout or billing setting to manage today.</p>
              <div className="mt-6 border-t border-white/[0.07] pt-5">
                <p className="text-sm font-medium text-zinc-200">Protected account fields</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">Your email, role, workspace membership, approval authority, and connected-provider access cannot be changed from this page.</p>
              </div>
            </aside>
          </div>
          <Link href="/auth/success" className="mt-8 inline-flex text-sm text-violet-300 transition hover:text-violet-200">← Back to overview</Link>
        </section>
      </div>
    </main>
  );
}
