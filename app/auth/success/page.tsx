import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";

export const dynamic = "force-dynamic";

export default async function AuthSuccessPage() {
  const context = await currentContext();
  if (!context.isAuthenticated) redirect("/auth/signin?callbackUrl=/auth/success");
  return (
    <main className="axiom-canvas min-h-screen px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <AuthCompanionHeader email={context.email ?? null} />

        <section className="py-14 sm:py-20">
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">Axiom web companion · signed in</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Your workspace is ready.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            Use this lightweight companion to confirm your account and understand the workspace. The installed Axiom Agent is where release records, approvals, integrations, and governed operations live.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Workspace overview">
          <article className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">Account</p>
            <h2 className="mt-3 text-lg font-semibold">Identity verified</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Your browser session is active. Access stays scoped to the workspace that has been provisioned for you.</p>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Desktop workspace</p>
            <h2 className="mt-3 text-lg font-semibold">Axiom Agent</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Create and review governed releases, connect systems, and work through approval gates in the installed app.</p>
            <Link href="/download" className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-100">Open or download Agent</Link>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Usage & access</p>
            <h2 className="mt-3 text-lg font-semibold">Invite-only pilot</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Pilot access is no-charge. Usage limits and workspace access are provisioned deliberately while the product is being proven.</p>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Integrations</p>
            <h2 className="mt-3 text-lg font-semibold">Connect your release stack</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">See what is scoped, what is still unavailable, and where the Agent manages consent and validation.</p>
            <Link href="/account/integrations" className="mt-5 inline-flex text-sm font-medium text-violet-300 hover:text-violet-200">View integrations →</Link>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Settings</p>
            <h2 className="mt-3 text-lg font-semibold">Workspace preferences</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Keep your display name current and review what stays deliberately protected from browser changes.</p>
            <Link href="/account" className="mt-5 inline-flex text-sm font-medium text-violet-300 hover:text-violet-200">Open settings →</Link>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Help</p>
            <h2 className="mt-3 text-lg font-semibold">Get support</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Find release, security, and desktop guidance without leaving your signed-in companion.</p>
            <Link href="/account/help" className="mt-5 inline-flex text-sm font-medium text-violet-300 hover:text-violet-200">Open help →</Link>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Safety posture</p>
            <h2 className="mt-3 text-lg font-semibold">Human-governed</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">This companion does not run releases. Consequential actions stay permissioned, auditable, and approval-gated in Axiom Agent.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
