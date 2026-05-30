/**
 * /dashboard/settings — the settings hub.
 *
 * Single page enumerating every tenant-configurable surface in the
 * platform. Linked from the topbar profile menu (Cog icon) and from
 * the sidebar. Each section is a calm row with a one-sentence hint.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import {
  BellAlertIcon,
  PuzzlePieceIcon,
  UserGroupIcon,
  BoltIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

interface Row {
  label: string;
  hint: string;
  href: string;
  icon: typeof BellAlertIcon;
  stub?: boolean;
}

const SECTIONS: Array<{ title: string; rows: Row[] }> = [
  {
    title: "Workspace",
    rows: [
      { label: "Team & roles", hint: "Invite teammates, assign roles.", href: "/dashboard/team", icon: UserGroupIcon, stub: true },
      { label: "Billing & usage", hint: "Plan, scan volume, AI usage caps.", href: "/dashboard/billing", icon: BoltIcon },
    ],
  },
  {
    title: "Integrations",
    rows: [
      { label: "Notifications", hint: "Slack / Teams / email digest + severity floor.", href: "/dashboard/settings/notifications", icon: BellAlertIcon },
      { label: "All integrations", hint: "Connected clouds + notification channels.", href: "/dashboard/integrations", icon: PuzzlePieceIcon },
    ],
  },
  {
    title: "Security",
    rows: [
      { label: "Trust center", hint: "Encryption, RBAC, audit retention.", href: "/dashboard/trust", icon: ShieldCheckIcon },
    ],
  },
];

export default async function SettingsHubPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    redirect("/auth/signin?callbackUrl=/dashboard/settings");
  }

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">settings</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Configure the platform.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Everything tenant-configurable, in one place.
        </p>
      </header>

      <div className="space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">{section.title}</p>
            <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
              {section.rows.map((row) => {
                const Icon = row.icon;
                return (
                  <li key={row.href}>
                    <Link
                      href={row.href}
                      className="group flex items-center gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors"
                    >
                      <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-medium text-white">{row.label}</p>
                          {row.stub && (
                            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 border border-white/[0.08] rounded-full px-1.5 py-px">
                              preview
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{row.hint}</p>
                      </div>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
