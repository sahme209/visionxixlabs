import type { View } from "../App";
import type { VerifiedDesktopIdentity } from "../lib/desktopClient";

const VIEW_TITLES: Partial<Record<View, { title: string; subtitle: string }>> = {
  agent: { title: "Agent", subtitle: "Plain-English requests become risk-checked, approval-gated, auditable actions" },
  "deployment-requests": { title: "Release workspace", subtitle: "Bring governed intake, readiness, approval evidence, recovery, and playbooks into one place" },
  "airflow-automation": { title: "Airflow automation", subtitle: "Batch completion becomes dependency-checked, approval-gated GitHub and deployment work" },
  "repository-workspace": { title: "GitHub repositories", subtitle: "Clone, sync, edit, commit, push, and open pull requests with repository-scoped access" },
  "plugins-skills": { title: "Plugins & Skills", subtitle: "Verified systems and reusable workflows for the governed Agent" },
  docs: { title: "Documentation", subtitle: "Product guidance and operating references" },
  settings: { title: "Settings", subtitle: "Authentication and workstation configuration" },
};

export function TopBar({ activeView, identity }: { activeView: View; identity: VerifiedDesktopIdentity }) {
  const meta = VIEW_TITLES[activeView] ?? { title: "Deployment workspace", subtitle: "Unavailable surfaces are not part of customer navigation" };
  const workspace = identity.organizationId;

  return (
    <header className="h-[68px] flex items-center justify-between px-7 border-b border-white/[0.07] bg-[#111214] drag">
      <div className="flex min-w-0 flex-col">
        <h2 className="text-[14px] font-semibold tracking-tight text-white leading-tight">{meta.title}</h2>
        <span className="mt-0.5 truncate text-[11px] text-zinc-500">{meta.subtitle}</span>
      </div>
      <div className="no-drag ml-4 flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-300" title={`Verified ${identity.kind.replace("_", " ")} with active approved workspace access`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="max-w-[180px] truncate">{workspace}</span>
        <span className="text-zinc-500">· access active</span>
      </div>
    </header>
  );
}
