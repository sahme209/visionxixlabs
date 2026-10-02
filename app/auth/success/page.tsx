import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { AuthCompanionShell } from "@/components/auth/AuthCompanionShell";

export const dynamic = "force-dynamic";

const GITHUB_NOTICES: Record<string, { tone: "emerald" | "amber" | "rose"; title: string; detail: string }> = {
  installation_recorded: { tone: "emerald", title: "GitHub installation recorded", detail: "Axiom Agent will perform the first scoped, read-only validation before this installation contributes release evidence." },
  approval_requested: { tone: "amber", title: "GitHub approval requested", detail: "Your organization administrator must approve the requested installation before Axiom can record it." },
  missing_installation: { tone: "rose", title: "GitHub did not return an installation", detail: "No connection was recorded. You can restart the setup from Integrations when ready." },
  invalid_state: { tone: "rose", title: "GitHub setup link is no longer valid", detail: "No connection was recorded. Start a new setup from Integrations instead of reusing a previous link." },
  error: { tone: "rose", title: "GitHub setup could not be recorded", detail: "No connection was recorded. Try again from Integrations or contact the Axiom team." },
};

export default async function AuthSuccessPage({ searchParams }: { searchParams: Promise<{ integration?: string; status?: string }> }) {
  const context = await currentContext();
  if (!context.isAuthenticated) redirect("/auth/signin?callbackUrl=/auth/success");
  const params = await searchParams;
  const githubNotice = params.integration === "github" ? GITHUB_NOTICES[params.status ?? ""] ?? null : null;
  return (
    <AuthCompanionShell>
      <div className="mx-auto max-w-6xl">
        <AuthCompanionHeader email={context.email ?? null} />

        {githubNotice && <div role="status" className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${githubNotice.tone === "emerald" ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-100" : githubNotice.tone === "amber" ? "border-amber-300/20 bg-amber-300/[0.05] text-amber-100" : "border-rose-300/20 bg-rose-300/[0.05] text-rose-100"}`}><p className="font-medium">{githubNotice.title}</p><p className="mt-1 text-zinc-400">{githubNotice.detail}</p></div>}

        <section className="grid gap-5 py-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.72fr)] lg:py-14">
          <div className="rounded-3xl border border-white/[0.09] bg-white/[0.035] p-6 shadow-[0_24px_100px_rgba(0,0,0,0.18)] sm:p-9">
            <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">Axiom web companion</p>
            <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">A clear home for your release workspace.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400 sm:text-base">Review account context, connection posture, and guidance here. The installed Axiom Agent remains the focused environment for governed release records, approvals, and operations.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/download" className="inline-flex min-h-11 items-center rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white">Open Axiom Agent</Link>
              <Link href="/account/integrations" className="inline-flex min-h-11 items-center rounded-xl border border-white/[0.1] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]">Review connections</Link>
            </div>
          </div>
          <aside className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.045] p-6 sm:p-7">
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200">Current access</p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em] text-zinc-100">Pilot workspace</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Your browser session is verified and access is scoped to the workspace provisioned for you.</p>
            <dl className="mt-7 space-y-3 border-t border-emerald-200/10 pt-5 text-sm">
              <div className="flex items-center justify-between gap-4"><dt className="text-zinc-500">Billing</dt><dd className="text-zinc-200">No-charge pilot</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-zinc-500">Release authority</dt><dd className="text-zinc-200">In Axiom Agent</dd></div>
            </dl>
          </aside>
        </section>

        <section className="grid gap-3 pb-10 md:grid-cols-3" aria-label="Workspace destinations">
          <Link href="/account/integrations" className="group rounded-2xl border border-white/[0.08] bg-black/10 p-5 transition hover:border-violet-300/25 hover:bg-white/[0.045]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">01 · Connections</p><h2 className="mt-3 text-lg font-medium text-zinc-100">Integration posture</h2><p className="mt-2 text-sm leading-6 text-zinc-500">See what is scoped, awaiting validation, or deliberately unavailable.</p><span className="mt-5 inline-block text-sm text-violet-300 transition group-hover:text-violet-200">Open integrations →</span>
          </Link>
          <Link href="/account" className="group rounded-2xl border border-white/[0.08] bg-black/10 p-5 transition hover:border-violet-300/25 hover:bg-white/[0.045]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">02 · Account</p><h2 className="mt-3 text-lg font-medium text-zinc-100">Profile and access</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Keep your display name current and review protected account boundaries.</p><span className="mt-5 inline-block text-sm text-violet-300 transition group-hover:text-violet-200">Open settings →</span>
          </Link>
          <Link href="/account/help" className="group rounded-2xl border border-white/[0.08] bg-black/10 p-5 transition hover:border-violet-300/25 hover:bg-white/[0.045]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">03 · Guidance</p><h2 className="mt-3 text-lg font-medium text-zinc-100">Help and reference</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Find release, security, and desktop guidance without losing your session.</p><span className="mt-5 inline-block text-sm text-violet-300 transition group-hover:text-violet-200">Open help →</span>
          </Link>
        </section>
      </div>
    </AuthCompanionShell>
  );
}
