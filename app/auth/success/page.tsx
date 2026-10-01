import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";

export const dynamic = "force-dynamic";

export default async function AuthSuccessPage() {
  const context = await currentContext();
  if (!context.isAuthenticated) redirect("/auth/signin?callbackUrl=/auth/success");
  return (
    <main className="axiom-canvas min-h-screen px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-white/[0.07] pb-6">
          <Link href="/" className="text-sm font-semibold tracking-[-0.02em] text-zinc-100">Vision XIX Labs</Link>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">Signed in</p>
            <p className="mt-1 text-xs text-zinc-400">{context.email}</p>
          </div>
        </header>

        <section className="py-14 sm:py-20">
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">Axiom web companion</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Your workspace is ready.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            Use this lightweight companion to confirm your account and understand the workspace. The installed Axiom Agent is where release records, approvals, integrations, and governed operations live.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3" aria-label="Workspace overview">
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
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Safety posture</p>
            <h2 className="mt-3 text-lg font-semibold">Human-governed</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">This companion does not run releases. Consequential actions stay permissioned, auditable, and approval-gated in Axiom Agent.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
