"use client";

/**
 * DashboardSidebar — premium left navigation for the /dashboard shell.
 *
 * Registers every dashboard route in a typed group structure. Active route
 * is highlighted; on mobile the sidebar is hidden and collapses into a
 * horizontal scroll-strip. New pages register here, not in scattered links.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Squares2X2Icon,
  CloudIcon,
  CodeBracketIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
  BeakerIcon,
  BoltIcon,
  LockClosedIcon,
  ComputerDesktopIcon,
  ServerStackIcon,
  DocumentTextIcon,
  ChartBarIcon,
  EyeIcon,
  CpuChipIcon,
  PuzzlePieceIcon,
  ArrowsRightLeftIcon, // also used in the Operator group for the Operating Graph
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

interface NavLink {
  href: string;
  label: string;
  icon: typeof CloudIcon;
}

interface NavGroup {
  label: string;
  items: NavLink[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Operator",
    items: [
      { href: "/dashboard/command-center",     label: "Command Center",   icon: Squares2X2Icon       },
      { href: "/dashboard/executive-summary",  label: "Executive summary",icon: DocumentTextIcon     },
      { href: "/dashboard/priorities",         label: "Priorities",       icon: ChartBarIcon         },
      { href: "/dashboard/next-actions",       label: "Next actions",     icon: BoltIcon             },
      { href: "/dashboard/root-causes",        label: "Root causes",      icon: PuzzlePieceIcon      },
      { href: "/dashboard/graph",              label: "Operating Graph",  icon: ArrowsRightLeftIcon  },
      { href: "/dashboard/sources",            label: "Sources",          icon: CloudIcon            },
      { href: "/dashboard/surfaces",           label: "Product surfaces", icon: PuzzlePieceIcon      },
      { href: "/dashboard/readiness",          label: "Readiness",        icon: RocketLaunchIcon     },
    ],
  },
  {
    label: "Providers",
    items: [
      { href: "/dashboard/aws",        label: "AWS",      icon: CloudIcon      },
      { href: "/dashboard/azure",      label: "Azure",    icon: CloudIcon      },
      { href: "/dashboard/gcp",        label: "GCP",      icon: CloudIcon      },
      { href: "/dashboard/github",     label: "GitHub",   icon: CodeBracketIcon},
      { href: "/dashboard/multi-cloud",label: "Multi-cloud", icon: ServerStackIcon },
    ],
  },
  {
    label: "Engines",
    items: [
      { href: "/dashboard/risks",          label: "Risk Queue",     icon: ShieldCheckIcon       },
      { href: "/dashboard/notifications",  label: "Notifications",  icon: ShieldCheckIcon       },
      { href: "/dashboard/security",       label: "Security",       icon: ShieldCheckIcon       },
      { href: "/dashboard/releaseops",     label: "ReleaseOps",     icon: RocketLaunchIcon      },
      { href: "/dashboard/remediation",    label: "Remediation",    icon: WrenchScrewdriverIcon },
      { href: "/dashboard/simulations",    label: "Simulations",    icon: BeakerIcon            },
      { href: "/dashboard/approvals",         label: "Approvals",        icon: LockClosedIcon        },
      { href: "/dashboard/approval-packets",  label: "Approval packets", icon: LockClosedIcon        },
      { href: "/dashboard/orchestration",  label: "Orchestration",  icon: ArrowsRightLeftIcon   },
      { href: "/dashboard/autonomous-ops", label: "Autonomous ops", icon: CpuChipIcon           },
      { href: "/dashboard/workflows",      label: "Workflows",      icon: ChartBarIcon          },
    ],
  },
  {
    label: "Desktop",
    items: [
      { href: "/dashboard/desktop", label: "Runtime status", icon: ComputerDesktopIcon },
      { href: "/download",          label: "Download",       icon: ComputerDesktopIcon },
    ],
  },
  {
    label: "Trust & evidence",
    items: [
      { href: "/dashboard/trust",                  label: "Trust Center",         icon: ShieldCheckIcon   },
      { href: "/dashboard/policies",               label: "Policies",             icon: LockClosedIcon    },
      { href: "/dashboard/automation-boundaries",  label: "Automation boundaries",icon: ShieldCheckIcon   },
      { href: "/dashboard/evidence", label: "Evidence",      icon: DocumentTextIcon  },
      { href: "/dashboard/audit",    label: "Audit",         icon: DocumentTextIcon  },
      { href: "/dashboard/traces",   label: "Traces",        icon: EyeIcon           },
      { href: "/dashboard/memory",   label: "Memory",        icon: CpuChipIcon       },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/dashboard/finops",              label: "FinOps",             icon: PuzzlePieceIcon },
      { href: "/dashboard/integrations",        label: "Integrations",       icon: PuzzlePieceIcon },
      { href: "/dashboard/integrations/health", label: "Integration health", icon: ServerStackIcon },
      { href: "/dashboard/integrations/github", label: "GitHub setup",       icon: CodeBracketIcon },
      { href: "/dashboard/topology",            label: "Topology",           icon: ServerStackIcon },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  // Treat the bare /dashboard index as the Command Center entry — it has no
  // dedicated page but the layout shell redirects/renders it there in spirit.
  if (href === "/dashboard/command-center") {
    return pathname === href || pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:sticky lg:top-[57px] lg:self-start lg:h-[calc(100vh-57px)] lg:overflow-y-auto border-r border-white/[0.06] py-6 pr-2">
        <nav className="space-y-6 pl-2">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] px-3 mb-2">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12.5px] transition-all ${
                          active
                            ? "bg-violet-500/[0.10] text-white border border-violet-500/[0.22]"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.03] border border-transparent"
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-violet-300" : "text-zinc-500"}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile horizontal nav strip */}
      <div className="lg:hidden border-b border-white/[0.06] -mx-4 sm:-mx-6 mb-4 overflow-x-auto">
        <nav className="flex items-center gap-1 px-4 sm:px-6 py-2 whitespace-nowrap">
          {GROUPS.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border transition-all ${
                  active
                    ? "bg-violet-500/[0.10] text-white border-violet-500/[0.22]"
                    : "text-zinc-400 border-white/[0.06] hover:text-white hover:border-white/[0.18]"
                }`}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
