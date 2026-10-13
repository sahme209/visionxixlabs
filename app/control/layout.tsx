import Link from "next/link";
import { redirect } from "next/navigation";

import { currentContext } from "@/lib/auth/currentContext";

export const dynamic = "force-dynamic";

const navigation = [
  { href: "/control", label: "Overview" },
  { href: "/control/governance", label: "Governance" },
  { href: "/control/ai-agents", label: "AI & Agents" },
  { href: "/control/integrations", label: "Integrations" },
  { href: "/control/usage-billing", label: "Usage & Billing" },
  { href: "/control/audit-security", label: "Audit & Security" },
];

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.email || !context.organizationId) {
    redirect("/auth/signin?callbackUrl=/control");
  }

  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
          <Link href="/control" className="flex items-center gap-3 font-semibold tracking-[-0.03em]">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-[#1a1a1a] text-sm text-[#ff783d]">A</span>
            Axiom Control
          </Link>
          <div className="min-w-0 text-right">
            <p className="truncate text-xs text-zinc-300">{context.workspaceLabel} workspace</p>
            <p className="truncate text-[11px] text-zinc-600">{context.email}</p>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1480px] lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-b border-white/[0.08] px-4 py-5 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <nav aria-label="Governance control plane" className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 hidden border-t border-white/[0.08] pt-5 lg:block">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Authority</p>
            <p className="mt-2 text-xs text-zinc-400">{context.roles.length ? context.roles.join(", ") : "No organization role"}</p>
            <Link href="/account" className="mt-3 inline-flex text-xs text-[#ff783d] hover:text-[#ff9a6d]">Personal settings →</Link>
          </div>
        </aside>
        <main className="min-w-0 px-5 py-10 lg:px-10 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
