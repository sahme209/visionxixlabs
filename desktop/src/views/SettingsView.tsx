import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ViewShell } from "../components/Primitives";

interface Preferences {
  theme: string;
  notifications_enabled: boolean;
  auto_scan_interval_minutes: number;
  default_provider: string;
  scan_on_launch: boolean;
}

export function SettingsView() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    invoke<Preferences>("get_preferences").then(setPrefs).catch(console.error);
    invoke<string>("get_api_endpoint").then(setApiEndpoint).catch(console.error);
  }, []);

  const savePrefs = async () => {
    if (!prefs) return;
    try {
      await invoke("set_preferences", { prefs });
      await invoke("set_api_endpoint", { endpoint: apiEndpoint });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save preferences:", err);
    }
  };

  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  if (!prefs) {
    return (
      <ViewShell>
        <div className="text-sm text-zinc-500">Loading preferences...</div>
      </ViewShell>
    );
  }

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Configure Axiom Agent preferences</p>
      </div>

      {/* API Endpoint */}
      <section className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">API Connection</h2>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">API Endpoint</label>
          <input
            type="text"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </section>

      {/* General */}
      <section className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">General</h2>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-200">Desktop notifications</div>
            <div className="text-xs text-zinc-500">Scan results, alerts, and approvals</div>
          </div>
          <button
            onClick={() => updatePref("notifications_enabled", !prefs.notifications_enabled)}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              prefs.notifications_enabled ? "bg-violet-600" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                prefs.notifications_enabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-200">Scan on launch</div>
            <div className="text-xs text-zinc-500">Automatically scan connected providers on startup</div>
          </div>
          <button
            onClick={() => updatePref("scan_on_launch", !prefs.scan_on_launch)}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              prefs.scan_on_launch ? "bg-violet-600" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                prefs.scan_on_launch ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="block text-sm text-zinc-200 mb-1">Auto-scan interval</label>
          <select
            value={prefs.auto_scan_interval_minutes}
            onChange={(e) => updatePref("auto_scan_interval_minutes", Number(e.target.value))}
            className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50"
          >
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every hour</option>
            <option value={360}>Every 6 hours</option>
            <option value={1440}>Daily</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-200 mb-1">Default provider</label>
          <select
            value={prefs.default_provider}
            onChange={(e) => updatePref("default_provider", e.target.value)}
            className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50"
          >
            <option value="aws">AWS</option>
            <option value="azure">Azure</option>
            <option value="gcp">GCP</option>
          </select>
        </div>
      </section>

      {/* Save button */}
      <button
        onClick={savePrefs}
        className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
      >
        {saved ? "Saved" : "Save preferences"}
      </button>
    </ViewShell>
  );
}
