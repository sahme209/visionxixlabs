import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { DashboardView } from "./views/DashboardView";
import { ConnectorsView } from "./views/ConnectorsView";
import { ScansView } from "./views/ScansView";
import { SettingsView } from "./views/SettingsView";
import { HandoffsView } from "./views/HandoffsView";
import { SecurityView } from "./views/SecurityView";

export type View = "dashboard" | "handoffs" | "connectors" | "scans" | "security" | "settings";

export default function App() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [booted, setBooted] = useState(false);

  // Premium boot — short pause so the loading screen actually registers.
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 650);
    return () => clearTimeout(t);
  }, []);

  if (!booted) return <BootScreen />;

  return (
    <div className="flex h-screen bg-axiom-bg text-white overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-y-auto flex flex-col">
        <ConnectionBanner />
        <div className="flex-1">
          {activeView === "dashboard"  && <DashboardView />}
          {activeView === "handoffs"   && <HandoffsView />}
          {activeView === "connectors" && <ConnectorsView />}
          {activeView === "scans"      && <ScansView />}
          {activeView === "security"   && <SecurityView />}
          {activeView === "settings"   && <SettingsView />}
        </div>
      </main>
    </div>
  );
}

function BootScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0c] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-violet-500/[0.07] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[480px] h-[480px] rounded-full bg-fuchsia-500/[0.05] blur-[100px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xl font-bold mb-5 shadow-[0_0_40px_rgba(139,92,246,0.35)]">
          A
        </div>
        <p className="text-sm font-semibold tracking-tight text-zinc-100">Axiom Agent</p>
        <p className="text-[11px] text-zinc-500 tracking-widest uppercase mt-1.5">Initialising local runtime</p>
        <div className="mt-6 w-44 h-0.5 bg-zinc-800/70 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-[boot-bar_1s_ease-in-out_infinite]" />
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
