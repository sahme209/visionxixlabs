"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Home, ShieldCheck, Bot, Plug, CreditCard, Users, Settings, ScrollText, BookOpen, LayoutGrid, LogOut } from "lucide-react";

const groups = [
  { label: "Workspace", items: [
    { href: "/control", label: "Overview", icon: Home },
    { href: "/control/governance", label: "Governance", icon: ShieldCheck },
    { href: "/control/ai-agents", label: "AI & Agents", icon: Bot },
    { href: "/control/integrations", label: "Integrations", icon: Plug },
    { href: "/control/plugins", label: "Plugins & skills", icon: LayoutGrid },
  ] },
  { label: "Organization", items: [
    { href: "/control/members", label: "Members", icon: Users },
    { href: "/control/usage-billing", label: "Usage & Billing", icon: CreditCard },
    { href: "/control/audit-security", label: "Audit & Security", icon: ScrollText },
  ] },
  { label: "Account", items: [
    { href: "/control/settings", label: "Settings & sessions", icon: Settings },
    { href: "/account/help", label: "Help", icon: BookOpen },
  ] },
];

export function CockpitShell({ children, email, workspace, roles = [] }: { children?: ReactNode; email: string; workspace?: string; roles?: string[] }) {
  const pathname = usePathname();
  const active = (href: string) => href === "/control" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <div className="min-h-screen bg-[#101010] text-zinc-100 selection:bg-orange-400/25">
    <a href="#cockpit-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3 focus:text-black">Skip to content</a>
    <aside className="cockpit-sidebar border-b border-white/[0.08] bg-[#151515] lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[232px] lg:flex-col lg:border-b-0 lg:border-r">
      <Link href="/control" className="flex h-[72px] items-center gap-2.5 px-5 text-sm font-semibold tracking-tight"><Image src="/vision-xix-logo.png" width={28} height={28} alt="" /><span>Axiom <span className="ml-1 text-zinc-500 font-normal">Control</span></span></Link>
      <div className="mx-3 hidden rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 lg:block"><p className="truncate text-xs font-medium">{workspace || "Your workspace"}</p><p className="mt-1 text-[11px] text-zinc-400">{roles.length ? roles.join(", ") : "Workspace access unverified"}</p></div>
      <nav aria-label="Axiom cockpit" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-4 lg:block lg:flex-1 lg:space-y-4 lg:overflow-y-auto">
        {groups.map(group => <div key={group.label} className="flex shrink-0 gap-1 lg:block"><p className="mb-2 hidden px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 lg:block">{group.label}</p>{group.items.map(({href,label,icon:Icon}) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex min-h-[34px] items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-[13px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 ${active(href) ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"}`}><Icon aria-hidden size={15} strokeWidth={1.6} />{label}</Link>)}</div>)}
      </nav>
      <div className="hidden space-y-3 border-t border-white/[0.08] p-4 lg:block"><Link href="/control/plans" className="flex min-h-9 items-center justify-center rounded-md border border-white/10 text-xs text-zinc-200 hover:bg-white/5">Review plans</Link><div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-400/10 text-[10px] text-orange-200">{email.slice(0,2).toUpperCase()}</span><span className="truncate text-[11px] text-zinc-400" title={email}>{email}</span><button aria-label="Sign out" title="Ends this browser session. Paired desktop sessions can be revoked in Settings." onClick={() => void signOut({callbackUrl:"/"})} className="ml-auto rounded p-2 text-zinc-400 hover:bg-white/5 hover:text-white"><LogOut size={14} /></button></div></div>
    </aside>
    <div className="lg:pl-[232px]">
      <header className="flex h-12 items-center lg:hidden justify-between border-b border-white/[0.06] px-5 text-xs text-zinc-500 sm:px-8"><span>Workspace <span className="mx-2 text-zinc-700">/</span><span className="text-zinc-300">{groups.flatMap(g=>g.items).find(i=>active(i.href))?.label ?? "Axiom Control"}</span></span><button onClick={() => void signOut({callbackUrl:"/"})} title="Ends this browser session; paired devices remain signed in." className="rounded px-2 py-1.5 text-zinc-400 hover:bg-white/5">Sign out</button></header>
      <main id="cockpit-content" className="cockpit-content mx-auto w-full max-w-[1250px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10 [&_h1]:text-2xl [&_h1]:font-medium [&_h1]:tracking-[-0.035em] [&_h1]:leading-tight [&_h2]:tracking-tight">{children}</main>
    </div>
  </div>;
}
