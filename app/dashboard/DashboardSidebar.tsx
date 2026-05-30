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
import { useState } from "react";
import {
  Squares2X2Icon,
  CloudIcon,
  ClockIcon,
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
  BellAlertIcon,
  QuestionMarkCircleIcon,
  DocumentMagnifyingGlassIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

interface NavLink {
  href: string;
  label: string;
  icon: typeof CloudIcon;
  /** Phase 405: when true, link is only visible in the expanded "more" section. */
  power?: boolean;
}

interface NavGroup {
  /** Plain-English label shown in the sidebar. */
  label: string;
  /** Closed-union grouping key — matches the 7 groups specified in Phase 405. */
  kind:
    | "start_here"
    | "operations"
    | "team_workflows"
    | "ai_workforce"
    | "automation"
    | "integrations"
    | "admin";
  items: NavLink[];
  /**
   * When true, the group is collapsed by default and the user expands it.
   * Reduces the visible-at-rest nav from 60+ entries to ~25.
   */
  defaultCollapsed?: boolean;
}

/**
 * Phase 405 — 7-group portal reorganization.
 *
 * Reduces the visible-at-rest sidebar from 60+ entries to ~25 by:
 *   - Collapsing power-user routes under a `power: true` flag (hidden
 *     until the user clicks "show more" inside each group).
 *   - Mapping every existing /dashboard/* route into exactly one of
 *     7 plain-English groups instead of 9 implementation-oriented ones.
 *   - Putting "Start Here" at the top so a brand-new user sees the
 *     setup guide + product tour BEFORE any feature surface.
 *
 * Every route in the previous structure remains reachable — power
 * routes are demoted, not deleted.
 */
const GROUPS: NavGroup[] = [
  {
    label: "Start Here",
    kind: "start_here",
    items: [
      { href: "/dashboard/command-center", label: "Command Center",  icon: Squares2X2Icon   },
      { href: "/dashboard/briefing",       label: "Daily briefing",  icon: SparklesIcon     },
      { href: "/dashboard/mission",        label: "Mission Control", icon: BoltIcon         },
      { href: "/dashboard/start-here",     label: "Setup Guide",     icon: RocketLaunchIcon },
      { href: "/dashboard/onboarding",     label: "First-run checklist", icon: SparklesIcon },
      { href: "/demo",                     label: "Product Tour / Sandbox", icon: BeakerIcon },
      { href: "/docs",                     label: "What is VisionXIXLabs?", icon: QuestionMarkCircleIcon },
      // Power-user routes — visible behind "more".
      { href: "/dashboard/setup",            label: "Setup wizard (advanced)", icon: RocketLaunchIcon, power: true },
      { href: "/dashboard/help",             label: "Help & Docs",     icon: QuestionMarkCircleIcon, power: true },
      { href: "/dashboard/readiness",        label: "Readiness checks",icon: RocketLaunchIcon, power: true },
    ],
  },
  {
    label: "Operations",
    kind: "operations",
    items: [
      // Cloud + multi-cloud first — most-clicked.
      { href: "/dashboard/multi-cloud",      label: "Cloud overview",    icon: ServerStackIcon },
      { href: "/dashboard/cloud-accounts",   label: "Cloud accounts",    icon: CloudIcon       },
      { href: "/dashboard/findings",         label: "Findings",          icon: EyeIcon         },
      { href: "/dashboard/scans",            label: "Scans",             icon: ClockIcon       },
      { href: "/dashboard/scheduled-scans",  label: "Scheduled scans",   icon: ClockIcon       },
      { href: "/dashboard/resources",        label: "Resources",         icon: ServerStackIcon },
      { href: "/dashboard/observability",    label: "Monitoring",        icon: ChartBarIcon    },
      { href: "/dashboard/security",         label: "Security",          icon: ShieldCheckIcon },
      { href: "/dashboard/incidents",        label: "Incidents",         icon: BellAlertIcon   },
      { href: "/dashboard/alerts",           label: "Alerts",            icon: BellAlertIcon   },
      { href: "/dashboard/services",         label: "Services",          icon: ServerStackIcon },
      // Per-provider drill-downs — power-user.
      { href: "/dashboard/aws",              label: "AWS",               icon: CloudIcon, power: true        },
      { href: "/dashboard/aws-services",     label: "AWS services",      icon: ServerStackIcon, power: true  },
      { href: "/dashboard/azure",            label: "Azure",             icon: CloudIcon, power: true        },
      { href: "/dashboard/gcp",              label: "GCP",               icon: CloudIcon, power: true        },
      { href: "/dashboard/github",           label: "GitHub",            icon: CodeBracketIcon, power: true  },
      { href: "/dashboard/cloud-inventory",  label: "Cloud inventory",   icon: ServerStackIcon, power: true  },
      { href: "/dashboard/network-topology", label: "Network topology",  icon: ArrowsRightLeftIcon, power: true },
      { href: "/dashboard/cloudtrail",       label: "CloudTrail",        icon: EyeIcon, power: true          },
      { href: "/dashboard/containers",       label: "Containers",        icon: ServerStackIcon, power: true  },
      { href: "/dashboard/k8s-eol",          label: "K8s EOL",           icon: RocketLaunchIcon, power: true },
      { href: "/dashboard/cloud-security",   label: "Cloud security",    icon: ShieldCheckIcon, power: true  },
      { href: "/dashboard/cicd",             label: "CI/CD operations",  icon: CodeBracketIcon, power: true  },
      { href: "/dashboard/releaseops",       label: "ReleaseOps",        icon: RocketLaunchIcon, power: true },
      { href: "/dashboard/risks",            label: "Risk queue",        icon: ShieldCheckIcon, power: true  },
      { href: "/dashboard/topology",         label: "Topology",          icon: ServerStackIcon, power: true  },
    ],
  },
  {
    label: "Team Workflows",
    kind: "team_workflows",
    defaultCollapsed: true,
    items: [
      // The team-workflow modules (Knowledge Base, Customer Support,
      // IT Support, Employee Ops) live alongside existing surfaces.
      { href: "/dashboard/notifications",        label: "Notifications",       icon: BellAlertIcon  },
      { href: "/dashboard/notifications-outbound", label: "Outbound · Slack / Teams", icon: BellAlertIcon },
      { href: "/dashboard/slack-notifications",  label: "Slack notifications (AGI)", icon: BellAlertIcon, power: true },
      { href: "/dashboard/agi-memory",            label: "AGI memory (cross-engine)", icon: BellAlertIcon, power: true },
      { href: "/dashboard/agi-suggestions",       label: "AGI suggestions (proactive)", icon: BellAlertIcon, power: true },
      { href: "/dashboard/ai-call-log",           label: "AI call log (engineer)", icon: BellAlertIcon, power: true },
      { href: "/dashboard/outbound-digest",      label: "Outbound digest",     icon: BellAlertIcon, power: true },
      { href: "/dashboard/executive-summary",    label: "Executive summary",   icon: DocumentTextIcon },
      { href: "/dashboard/priorities",           label: "Priorities",          icon: ChartBarIcon, power: true },
      { href: "/dashboard/next-actions",         label: "Next actions",        icon: BoltIcon, power: true },
      { href: "/dashboard/root-causes",          label: "Root causes",         icon: PuzzlePieceIcon, power: true },
    ],
  },
  {
    label: "AI Workforce",
    kind: "ai_workforce",
    items: [
      { href: "/dashboard/workforce",            label: "AI engineers",        icon: CpuChipIcon },
      { href: "/dashboard/agents",               label: "Agent registry",      icon: CpuChipIcon },
      { href: "/dashboard/agent-tools",          label: "Tool access",         icon: ShieldCheckIcon },
      { href: "/dashboard/agent-activity",       label: "Activity",            icon: ChartBarIcon },
      { href: "/dashboard/learning",             label: "Learning",            icon: BeakerIcon },
      { href: "/dashboard/gaps",                 label: "Gaps",                icon: BellAlertIcon },
      // Power-user routes — internal agent plumbing.
      { href: "/dashboard/agi",                  label: "AGI Cockpit",         icon: CpuChipIcon, power: true },
      { href: "/dashboard/autonomy",             label: "Autonomy Cockpit",    icon: CpuChipIcon, power: true },
      { href: "/dashboard/charter",              label: "Autonomy Charter",    icon: CpuChipIcon, power: true },
      { href: "/dashboard/rationale",            label: "Decision rationale",  icon: DocumentMagnifyingGlassIcon, power: true },
      { href: "/dashboard/decision-heatmap",     label: "Decision heatmap",    icon: ChartBarIcon, power: true },
      { href: "/dashboard/agent-bus",            label: "Agent bus",           icon: CpuChipIcon, power: true },
      { href: "/dashboard/agent-proposals",      label: "Method proposals",    icon: CpuChipIcon, power: true },
      { href: "/dashboard/engineer-workspace",   label: "Engineer workspace",  icon: CpuChipIcon, power: true },
      { href: "/dashboard/tenant-insights",      label: "Tenant insights",     icon: SparklesIcon, power: true },
      { href: "/dashboard/workflow-translator",  label: "Workflow translator", icon: SparklesIcon, power: true },
    ],
  },
  {
    label: "Automation",
    kind: "automation",
    items: [
      { href: "/dashboard/workflows",            label: "Workflows",           icon: ChartBarIcon },
      { href: "/dashboard/automation",           label: "Automations",         icon: BoltIcon },
      { href: "/dashboard/approvals",            label: "Approvals",           icon: LockClosedIcon },
      { href: "/dashboard/runbooks",             label: "Runbooks",            icon: WrenchScrewdriverIcon },
      { href: "/dashboard/audit",                label: "Audit log",           icon: DocumentTextIcon },
      // Power-user routes — internal pipeline plumbing.
      { href: "/dashboard/remediation",          label: "Remediation",         icon: WrenchScrewdriverIcon, power: true },
      { href: "/dashboard/runbooks/queue",       label: "Runbook queue",       icon: WrenchScrewdriverIcon, power: true },
      { href: "/dashboard/orchestration",        label: "Orchestration",       icon: ArrowsRightLeftIcon, power: true },
      { href: "/dashboard/autonomous-ops",       label: "Autonomous ops",      icon: CpuChipIcon, power: true },
      { href: "/dashboard/scheduled-scans",      label: "Scheduled scans",     icon: ClockIcon, power: true },
      { href: "/dashboard/simulations",          label: "Simulations",         icon: BeakerIcon, power: true },
      { href: "/dashboard/scp-simulator",        label: "SCP simulator",       icon: BeakerIcon, power: true },
      { href: "/dashboard/policy-previews",      label: "Policy previews",     icon: LockClosedIcon, power: true },
      { href: "/dashboard/approval-packets",     label: "Approval packets",    icon: LockClosedIcon, power: true },
      { href: "/dashboard/traces",               label: "Traces",              icon: EyeIcon, power: true },
      { href: "/dashboard/memory",               label: "Memory",              icon: CpuChipIcon, power: true },
    ],
  },
  {
    label: "Integrations",
    kind: "integrations",
    items: [
      { href: "/dashboard/connectors",           label: "Connectors",          icon: PuzzlePieceIcon },
      { href: "/dashboard/connector-store",      label: "Connector store",    icon: PuzzlePieceIcon },
      { href: "/dashboard/developer-tools",      label: "Developer tools",     icon: CodeBracketIcon },
      { href: "/dashboard/integrations",         label: "All integrations",    icon: PuzzlePieceIcon },
      { href: "/dashboard/desktop",              label: "Desktop app",         icon: ComputerDesktopIcon },
      { href: "/dashboard/models",               label: "Model registry",      icon: SparklesIcon },
      // Power-user routes.
      { href: "/dashboard/desktop-agents",       label: "Desktop agents",      icon: ComputerDesktopIcon, power: true },
      { href: "/dashboard/desktop/intelligence", label: "Intelligence workstation", icon: CpuChipIcon, power: true },
      { href: "/dashboard/desktop/releases",     label: "Desktop release mgmt",icon: RocketLaunchIcon, power: true },
      { href: "/dashboard/integrations/health",  label: "Integration health",  icon: ServerStackIcon, power: true },
      { href: "/dashboard/integrations/github",  label: "GitHub setup",        icon: CodeBracketIcon, power: true },
      { href: "/dashboard/modules",              label: "Modules",             icon: Squares2X2Icon, power: true },
      { href: "/dashboard/sub-tools",            label: "Sub-tools",           icon: Squares2X2Icon, power: true },
      { href: "/dashboard/sources",              label: "Sources",             icon: CloudIcon, power: true },
      { href: "/dashboard/surfaces",             label: "Product surfaces",    icon: PuzzlePieceIcon, power: true },
      { href: "/dashboard/graph",                label: "Operating graph",     icon: ArrowsRightLeftIcon, power: true },
      { href: "/download",                       label: "Download desktop",    icon: ComputerDesktopIcon },
    ],
  },
  {
    label: "Business / Admin",
    kind: "admin",
    items: [
      { href: "/dashboard/billing",                  label: "Billing & usage",     icon: BoltIcon },
      { href: "/dashboard/cost-analysis",            label: "Cost analysis",       icon: ChartBarIcon },
      { href: "/dashboard/ai-usage",                 label: "AI usage",            icon: ChartBarIcon },
      { href: "/dashboard/settings/notifications",   label: "Notifications",       icon: BellAlertIcon },
      { href: "/dashboard/settings/workspace",       label: "Users & roles",       icon: ShieldCheckIcon },
      { href: "/dashboard/trust",                label: "Trust center",        icon: ShieldCheckIcon },
      { href: "/dashboard/compliance",           label: "Compliance",          icon: DocumentMagnifyingGlassIcon },
      { href: "/dashboard/policies",             label: "Policies",            icon: LockClosedIcon },
      // Power-user routes — internal/admin.
      { href: "/dashboard/cost-overview",        label: "Cost overview",       icon: ChartBarIcon, power: true },
      { href: "/dashboard/cost-explainer",       label: "Cost explainer",      icon: ChartBarIcon, power: true },
      { href: "/dashboard/finops",               label: "FinOps",              icon: PuzzlePieceIcon, power: true },
      { href: "/dashboard/ai-settings",          label: "AI settings",         icon: SparklesIcon, power: true },
      { href: "/dashboard/help-analytics",       label: "Help analytics",      icon: ChartBarIcon, power: true },
      { href: "/dashboard/help-suggestions",     label: "Doc suggestions",     icon: ChartBarIcon, power: true },
      { href: "/dashboard/automation-boundaries",label: "Automation boundaries", icon: ShieldCheckIcon, power: true },
      { href: "/dashboard/evidence",             label: "Evidence",            icon: DocumentTextIcon, power: true },
      { href: "/dashboard/evidence-library",     label: "Evidence library",    icon: DocumentTextIcon, power: true },
      { href: "/dashboard/compliance-packet",    label: "Compliance packet",   icon: DocumentTextIcon, power: true },
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
  // Phase 405 — per-group expand state. `expanded[label] = true` means
  // show power-user routes inside that group. Groups marked
  // defaultCollapsed start fully hidden until clicked.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Auto-expand the group containing the active route so deep links
    // never land on an empty-looking sidebar.
    const out: Record<string, boolean> = {};
    for (const g of GROUPS) {
      if (g.items.some((it) => isActive(pathname, it.href) && it.power)) {
        out[g.label] = true;
      }
    }
    return out;
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const g of GROUPS) {
      out[g.label] = !g.defaultCollapsed ||
        g.items.some((it) => isActive(pathname, it.href));
    }
    return out;
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:sticky lg:top-[57px] lg:self-start lg:h-[calc(100vh-57px)] lg:overflow-y-auto border-r border-white/[0.06] py-6 pr-2">
        <nav className="space-y-5 pl-2">
          {GROUPS.map((group) => {
            const isOpen = openGroups[group.label] !== false;
            const isExpanded = expanded[group.label] === true;
            const visibleItems = group.items.filter((it) => isExpanded || !it.power);
            const hiddenCount = group.items.filter((it) => it.power).length;
            return (
              <div key={group.label}>
                <button
                  onClick={() => setOpenGroups((s) => ({ ...s, [group.label]: !isOpen }))}
                  className="flex items-center gap-1.5 px-3 mb-2 w-full text-left group"
                >
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] group-hover:text-zinc-300 transition-colors">
                    {group.label}
                  </span>
                  <span className={`text-[8px] text-zinc-700 ml-auto transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}>
                    ▼
                  </span>
                </button>
                {isOpen && (
                  <ul className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(pathname, item.href);
                      return (
                        <li key={item.href} className="relative">
                          {active && (
                            <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-white" />
                          )}
                          <Link
                            href={item.href}
                            className={`flex items-center gap-2.5 rounded-lg pl-4 pr-3 py-1.5 text-[12.5px] transition-colors ${
                              active
                                ? "text-white"
                                : "text-zinc-500 hover:text-zinc-200"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <li>
                        <button
                          onClick={() => setExpanded((s) => ({ ...s, [group.label]: !isExpanded }))}
                          className="w-full text-left flex items-center gap-2 rounded-lg px-3 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <span>{isExpanded ? "− show less" : `+ show ${hiddenCount} more`}</span>
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Mobile horizontal nav strip — show non-power items only (the
          power-user routes are hidden on mobile to keep the strip short). */}
      <div className="lg:hidden border-b border-white/[0.06] -mx-4 sm:-mx-6 mb-4 overflow-x-auto">
        <nav className="flex items-center gap-1 px-4 sm:px-6 py-2 whitespace-nowrap">
          {GROUPS.flatMap((g) => g.items.filter((it) => !it.power)).map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border transition-colors ${
                  active
                    ? "text-white border-white/[0.18]"
                    : "text-zinc-500 border-white/[0.04] hover:text-zinc-200 hover:border-white/[0.10]"
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
