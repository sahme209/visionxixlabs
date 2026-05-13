import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { DashboardView } from "./views/DashboardView";
import { ConnectorsView } from "./views/ConnectorsView";
import { ScansView } from "./views/ScansView";
import { SettingsView } from "./views/SettingsView";

export type View = "dashboard" | "connectors" | "scans" | "settings";

export default function App() {
  const [activeView, setActiveView] = useState<View>("dashboard");

  return (
    <div className="flex h-screen bg-axiom-bg text-white overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-y-auto">
        {activeView === "dashboard" && <DashboardView />}
        {activeView === "connectors" && <ConnectorsView />}
        {activeView === "scans" && <ScansView />}
        {activeView === "settings" && <SettingsView />}
      </main>
    </div>
  );
}
