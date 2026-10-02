import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { currentContext } from "@/lib/auth/currentContext";

const CONNECTIONS = [
  { name: "GitHub", detail: "Release evidence is collected with repository-scoped, read-only access. Choose repository access in the browser, then validate it in Axiom Agent.", state: "Managed in Agent" },
  { name: "Cloud accounts", detail: "AWS, Azure, and Google Cloud stay tenant-scoped and are validated from the installed application.", state: "Managed in Agent" },
  { name: "Collaboration", detail: "Slack and Teams remain unavailable until their connection has completed browser consent and live server-side validation.", state: "Not connected" },
  { name: "Observability", detail: "Production health is not shown as connected until a tenant-scoped observability connection is verified.", state: "Not connected" },
];

export const dynamic = "force-dynamic";

export default async function AccountIntegrationsPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.email) redirect("/auth/signin?callbackUrl=/account/integrations");
  return (
    <main className="axiom-canvas min-h-screen px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <AuthCompanionHeader email={context.email ?? null} />
        <section className="py-14 sm:py-20">
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">Axiom web companion · integrations</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Your release stack, clearly scoped.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">This companion keeps your account context in place. Connection setup and consequential operations remain in Axiom Agent, where each provider can be consented, validated, revoked, and audited.</p>
        </section>
        <section className="grid gap-3 md:grid-cols-2" aria-label="Integration overview">
          {CONNECTIONS.map((connection) => (
            <article key={connection.name} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-medium text-zinc-100">{connection.name}</h2><span className="rounded-full border border-white/[0.1] bg-black/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">{connection.state}</span></div>
              <p className="mt-3 text-sm leading-6 text-zinc-500">{connection.detail}</p>
            </article>
          ))}
        </section>
        <div className="mt-8 rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-5 sm:p-6">
          <p className="text-sm font-medium text-zinc-100">Open Axiom Agent to configure a connection.</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">The browser companion does not collect provider credentials or claim a provider is connected before live validation.</p>
          <Link href="/download" className="mt-5 inline-flex rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white">Open or download Agent</Link>
        </div>
      </div>
    </main>
  );
}
