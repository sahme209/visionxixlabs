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
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">Account identity is separate from deployment authority. Changes here cannot alter permissions, approvals, integrations, or a release record.</p>
          <AccountSettingsForm initialDisplayName={user?.name ?? context.displayName ?? ""} email={context.email} />
          <Link href="/auth/success" className="mt-8 inline-flex text-sm text-violet-300 transition hover:text-violet-200">← Back to overview</Link>
        </section>
      </div>
    </main>
  );
}
