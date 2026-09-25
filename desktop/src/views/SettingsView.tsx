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
import { markNotificationPrefDirty, notifyResult } from "../lib/notifications";
import { useVoteHistory } from "../lib/voteHistory";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const workspace = useWorkspaceState();
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const voteHistory = useVoteHistory();

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
    invoke<Preferences>("get_preferences").then(setPrefs).catch((err) => setLoadError(String(err)));
    invoke<string>("get_api_endpoint").then(setApiEndpoint).catch((err) => setLoadError(String(err)));
    readPersistedApiKey().then(setStoredKey).catch((err) => setLoadError(String(err)));
  }, []);

  const savePrefs = async () => {
    if (!prefs) return;
    setSaveError(null);
    try {
      await invoke("set_preferences", { prefs });
      await invoke("set_api_endpoint", { endpoint: apiEndpoint });
      // Notification helper caches the pref between polls — force a re-read
      // so toggling here takes effect on the very next approval, not on
      // page reload.
      markNotificationPrefDirty();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  if (!prefs) {
    return (
      <ViewShell>
        <div className="text-sm text-zinc-500">{loadError ? `Preferences unavailable: ${loadError}` : "Loading preferences..."}</div>
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
              Paste an administrator-issued <span className="font-mono text-zinc-400">vxlk_live_…</span> key with at least{" "}
              <span className="font-mono text-zinc-400">release_gate:read</span> scope. The installed application stores it in the operating-system credential vault.
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
              Paste a desktop pairing credential issued by an authorized workspace administrator. Browser authentication is used only to authorize this installed application.
            </p>
            <textarea
              rows={3}
              value={pasteValue}
              onChange={(e) => { setPasteValue(e.target.value); setPasteError(null); }}
              placeholder="Paste desktop pairing JSON (token + session)…"
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
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await notifyResult({
                  title: "Axiom Agent · test notification",
                  body: "If you can read this, native OS notifications are working.",
                });
              }}
              disabled={!prefs.notifications_enabled}
              title={prefs.notifications_enabled
                ? "Fire a test notification right now"
                : "Enable notifications first"}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Test
            </button>
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

      {/* Recent votes — local audit log of approvals/rejections cast from this
          desktop. Last 25 entries persist across restarts via tauri-plugin-store.
          Empty state is the silent no-op for first-launch / unpaired sessions. */}
      {voteHistory.length > 0 && (
        <section className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-300">Recent votes from this desktop</h2>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{voteHistory.length}/25</span>
          </div>
          <ul className="space-y-2">
            {voteHistory.map((v) => (
              <li
                key={`${v.runId}:${v.castAt}`}
                className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      v.decision === "approved"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-red-500/15 text-red-300"
                    }`}>
                      {v.decision}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">{v.source}</span>
                    {v.isTerminal && (
                      <span className="text-[10px] font-mono text-violet-300">→ run {v.snapshotStatus}</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 truncate" title={v.runId}>
                    {v.runId.slice(0, 24)}…
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono text-zinc-500">
                    {v.approvedCount}/{v.requiredApprovers} approved
                  </div>
                  <div className="text-[10px] font-mono text-zinc-600">
                    {new Date(v.castAt).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Save button */}
      {saveError && (
        <div role="alert" className="text-xs rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 px-3 py-2">
          Preferences were not saved: {saveError}
        </div>
      )}
      <button
        onClick={savePrefs}
        className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
      >
        {saved ? "Saved" : "Save preferences"}
      </button>
    </ViewShell>
  );
}
