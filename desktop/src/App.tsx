import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { DashboardView } from "./views/DashboardView";
import { ConnectorsView } from "./views/ConnectorsView";
import { ScansView } from "./views/ScansView";
import { SettingsView } from "./views/SettingsView";
import { HandoffsView } from "./views/HandoffsView";
import { SecurityView } from "./views/SecurityView";
import { MultiCloudView } from "./views/MultiCloudView";
import { RemediationView } from "./views/RemediationView";
import { SimulationsView } from "./views/SimulationsView";
import { OrchestrationView } from "./views/OrchestrationView";

export type View =
  | "dashboard"
  | "multi-cloud"
  | "remediation"
  | "simulations"
  | "orchestration"
  | "handoffs"
  | "scans"
  | "security"
  | "connectors"
  | "settings";

export default function App() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (!booted) return <BootScreen />;

  return (
    <div className="flex h-screen bg-axiom-bg text-white overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar activeView={activeView} />
        <div className="flex-1 overflow-hidden">
          {activeView === "dashboard"     && <DashboardView />}
          {activeView === "multi-cloud"   && <MultiCloudView />}
          {activeView === "remediation"   && <RemediationView />}
          {activeView === "simulations"   && <SimulationsView />}
          {activeView === "orchestration" && <OrchestrationView />}
          {activeView === "handoffs"      && <HandoffsView />}
          {activeView === "scans"         && <ScansView />}
          {activeView === "security"      && <SecurityView />}
          {activeView === "connectors"    && <ConnectorsView />}
          {activeView === "settings"      && <SettingsView />}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boot screen — cinematic loading
// ---------------------------------------------------------------------------

function BootScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-axiom-bg text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full bg-violet-500/[0.10] blur-[160px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[520px] h-[520px] rounded-full bg-fuchsia-500/[0.07] blur-[140px]" />
        <div className="absolute top-0 left-0 w-[420px] h-[420px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 blur-2xl opacity-50 scale-110 animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold shadow-[0_0_60px_rgba(139,92,246,0.5)]">
            A
          </div>
        </div>
        <p className="text-base font-semibold tracking-tight text-white">Axiom Agent</p>
        <p className="text-[10px] font-mono text-zinc-500 tracking-[0.22em] uppercase mt-2">Initialising local runtime</p>
        <div className="mt-6 w-48 h-[2px] bg-zinc-800/70 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 animate-[boot-bar_1s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`
        @keyframes boot-bar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
