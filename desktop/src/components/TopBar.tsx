import type { View } from "../App";
import type { VerifiedDesktopIdentity } from "../lib/desktopClient";

const VIEW_TITLES: Partial<Record<View, { title: string; subtitle: string }>> = {
  "deployment-requests": { title: "Requests & playbooks", subtitle: "Turn governed intake into a versioned deployment playbook" },
  docs: { title: "Documentation", subtitle: "Product guidance and operating references" },
  settings: { title: "Settings", subtitle: "Authentication and workstation configuration" },
};

export function TopBar({ activeView, identity }: { activeView: View; identity: VerifiedDesktopIdentity }) {
  const meta = VIEW_TITLES[activeView] ?? { title: "Deployment workspace", subtitle: "Unavailable surfaces are not part of customer navigation" };
  const workspace = identity.organizationId;

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-axiom-border bg-axiom-bg-elev/60 backdrop-blur-xl drag">
      <div className="flex min-w-0 flex-col">
        <h2 className="text-[13px] font-semibold tracking-tight text-white leading-tight">{meta.title}</h2>
        <span className="truncate text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em]">{meta.subtitle}</span>
      </div>
      <div className="no-drag ml-4 flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-1.5 text-[11px] font-mono text-emerald-300" title={`Verified ${identity.kind.replace("_", " ")} with active commercial access`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="max-w-[180px] truncate">{workspace}</span>
        <span className="text-emerald-500/60">· access active</span>
      </div>
    </header>
  );
}
