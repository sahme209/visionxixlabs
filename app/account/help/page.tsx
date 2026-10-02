import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { currentContext } from "@/lib/auth/currentContext";

const HELP_ITEMS = [
  { title: "Getting started", detail: "Install Axiom Agent, sign in through the browser, and begin with a complete deployment request.", href: "/docs/getting-started" },
  { title: "Release workflow", detail: "See how readiness, approval, validation, recovery, and closure remain distinct in a governed release.", href: "/docs/releaseops" },
  { title: "Security and permissions", detail: "Review tenant boundaries, approval authority, and how provider access stays least-privilege.", href: "/docs/security-model" },
  { title: "Troubleshooting", detail: "Find the current desktop installation and connection guidance before changing a provider setup.", href: "/docs/troubleshooting" },
];

export const dynamic = "force-dynamic";

export default async function AccountHelpPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.email) redirect("/auth/signin?callbackUrl=/account/help");
  return (
    <main className="axiom-canvas min-h-screen px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <AuthCompanionHeader email={context.email ?? null} />
        <section className="py-14 sm:py-20">
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">Axiom web companion · help</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Guidance that stays with your account.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">You remain signed in while reading product guidance. Axiom Agent is still the place for deployment operations and provider configuration.</p>
        </section>
        <section className="grid gap-3 md:grid-cols-2" aria-label="Help topics">
          {HELP_ITEMS.map((item) => <Link key={item.title} href={item.href} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-white/[0.16] hover:bg-white/[0.045]"><h2 className="text-lg font-medium text-zinc-100">{item.title}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">{item.detail}</p><span className="mt-5 inline-block text-sm text-violet-300">Read guide →</span></Link>)}
        </section>
      </div>
    </main>
  );
}
