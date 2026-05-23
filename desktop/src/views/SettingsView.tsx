import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ViewShell } from "../components/Primitives";
import { useWorkspaceState } from "../lib/workspaceState";
import {
  apiKeyPrefix,
  clearApiKey,
  readPersistedApiKey,
  saveApiKey,
} from "../lib/apiKeyStore";
import { desktopClient } from "../lib/desktopClient";

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
  const workspace = useWorkspaceState();
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Phase 399+ vxlk_* API key state.
  const [storedKey, setStoredKey] = useState<string | undefined>(undefined);
  const [keyPasteValue, setKeyPasteValue] = useState("");
  const [keyPasteError, setKeyPasteError] = useState<string | null>(null);
  const [keyTestStatus, setKeyTestStatus] = useState<
    { kind: "ok"; workspace: string; planTier: string; scopes: ReadonlyArray<string> } |
    { kind: "err"; message: string } |
    null
  >(null);

  useEffect(() => {
    invoke<Preferences>("get_preferences").then(setPrefs).catch(console.error);
    invoke<string>("get_api_endpoint").then(setApiEndpoint).catch(console.error);
    readPersistedApiKey().then(setStoredKey).catch(console.error);
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

      {/* API Key (vxlk_*) — Phase 399 surface */}
      <section className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-300">VisionXIXLabs API key</h2>
          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
            storedKey ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400"
          }`}>{storedKey ? "active" : "not set"}</span>
        </div>

        {storedKey ? (
          <div className="space-y-3">
            <div className="text-xs text-zinc-400">
              Stored key:{" "}
              <span className="text-zinc-200 font-mono">{apiKeyPrefix(storedKey)}…</span>{" "}
              <span className="text-zinc-500">(plaintext never re-shown — mint a new key if lost)</span>
            </div>
            {keyTestStatus?.kind === "ok" && (
              <div className="text-xs rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 px-3 py-2">
                ✓ Authenticated as <span className="font-mono">{keyTestStatus.workspace}</span> on <span className="font-mono">{keyTestStatus.planTier}</span>.
                Scopes: <span className="font-mono">{keyTestStatus.scopes.join(", ")}</span>
              </div>
            )}
            {keyTestStatus?.kind === "err" && (
              <div className="text-xs rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 px-3 py-2">
                ✗ {keyTestStatus.message}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setKeyTestStatus(null);
                  const r = await desktopClient.v1Whoami();
                  if (r.ok) {
                    const d = r.data as {
                      apiKey: { scopes: ReadonlyArray<string> };
                      organization: { id: string; planTier: string };
                    };
                    setKeyTestStatus({
                      kind: "ok",
                      workspace: d.organization.id,
                      planTier: d.organization.planTier,
                      scopes: d.apiKey.scopes,
                    });
                  } else {
                    setKeyTestStatus({ kind: "err", message: r.error });
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
              >
                Test connection
              </button>
              <button
                onClick={async () => {
                  await clearApiKey();
                  setStoredKey(undefined);
                  setKeyTestStatus(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 text-xs text-zinc-200 transition-colors"
              >
                Remove key
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Mint a key on the web admin panel at{" "}
              <span className="font-mono text-zinc-400">/admin/api-keys</span>{" "}
              with at least <span className="font-mono text-zinc-400">release_gate:read</span> scope, then paste the <span className="font-mono text-zinc-400">vxlk_live_…</span> string here.
              The plaintext is shown to you exactly once at mint time.
            </p>
            <input
              type="password"
              value={keyPasteValue}
              onChange={(e) => { setKeyPasteValue(e.target.value); setKeyPasteError(null); }}
              placeholder="vxlk_live_…_……"
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
            />
            {keyPasteError && <div className="text-xs text-red-400">{keyPasteError}</div>}
            <button
              onClick={async () => {
                try {
                  await saveApiKey(keyPasteValue);
                  setStoredKey(keyPasteValue.trim());
                  setKeyPasteValue("");
                  setKeyTestStatus(null);
                } catch (err) {
                  setKeyPasteError(err instanceof Error ? err.message : String(err));
                }
              }}
              disabled={!keyPasteValue.trim()}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save API key
            </button>
          </div>
        )}
      </section>

      {/* Workspace pairing */}
      <section className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-300">Workspace pairing</h2>
          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
            workspace.status === "paired"   ? "bg-emerald-500/15 text-emerald-300" :
            workspace.status === "unpaired" ? "bg-zinc-700/40 text-zinc-400" :
                                              "bg-zinc-700/40 text-zinc-500"
          }`}>{workspace.status}</span>
        </div>

        {workspace.status === "paired" && workspace.session ? (
          <div className="space-y-3">
            <div className="text-xs text-zinc-400">
              Paired as <span className="text-zinc-200 font-mono">{workspace.session.deviceLabel}</span>
              {" · expires "}<span className="font-mono">{new Date(workspace.session.expiresAt).toLocaleDateString()}</span>
            </div>
            <button
              onClick={() => workspace.disconnect()}
              className="px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 text-xs text-zinc-200 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Mint a pairing token on the web app at <span className="font-mono text-zinc-400">visionxixlabs.com/settings/desktop</span>, then paste it here.
            </p>
            <textarea
              rows={3}
              value={pasteValue}
              onChange={(e) => { setPasteValue(e.target.value); setPasteError(null); }}
              placeholder="Paste the JSON the web app showed you (token + session)…"
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 resize-none"
            />
            {pasteError && <div className="text-xs text-red-400">{pasteError}</div>}
            <button
              onClick={async () => {
                try {
                  const parsed = JSON.parse(pasteValue.trim());
                  if (!parsed.token || !parsed.session?.id) {
                    setPasteError("Paste must include both `token` and `session.id`.");
                    return;
                  }
                  await workspace.connect({ token: parsed.token, session: parsed.session });
                  setPasteValue("");
                } catch (err) {
                  setPasteError(err instanceof Error ? err.message : "Invalid JSON.");
                }
              }}
              disabled={!pasteValue.trim()}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pair workspace
            </button>
          </div>
        )}
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
