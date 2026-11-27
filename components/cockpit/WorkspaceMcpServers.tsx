"use client";
import { useCallback, useEffect, useState } from "react";
import type { McpRegistryServer } from "@/lib/integrations/mcp/mcpRegistry";
import { McpRegistryBrowser } from "./McpRegistryBrowser";
import { StatusDot } from "./StatusDot";

interface Server { id: string; registryName: string; title: string; version: string | null; remoteUrl: string; transport: string; enabled: boolean; lastCheckAt: string | null; lastCheckOutcome: string | null; lastCheckDetail: string | null; toolNames: string[]; allowedTools: string[] }
const OUTCOME: Record<string, { label: string; tone: "success" | "attention" | "failed" | "idle" }> = {
  ok: { label: "Connected", tone: "success" }, needs_credentials: { label: "Needs credentials", tone: "attention" },
  unreachable: { label: "Unreachable", tone: "failed" }, refused: { label: "Refused", tone: "failed" }, invalid_response: { label: "Not an MCP server", tone: "failed" },
};
const ERRORS: Record<string, string> = {
  mcp_server_already_added: "That server is already in this workspace.", mcp_server_limit_reached: "This workspace has the most servers allowed (50). Remove one first.",
  mcp_server_check_required: "Run a connection check that lists the server's tools before enabling it.", check_rate_limited: "Wait 30 seconds between checks of the same server.",
  workspace_admin_required: "Only owners and admins can change MCP servers.",
};

/**
 * The workspace's own MCP servers, added from the public registry below. Each one starts disabled;
 * a connection check (no credentials, no tool calls) lists its tools, and only then can it be enabled.
 */
export function WorkspaceMcpServers() {
  const [data, setData] = useState<{ canEdit: boolean; servers: Server[] } | "error" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const res = await fetch("/api/control/mcp/servers", { cache: "no-store" }); const body = await res.json(); setData(res.ok && body.ok ? body.data : "error"); } catch { setData("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function call(method: string, url: string, payload: unknown, key: string): Promise<{ ok: boolean; body: { ok?: boolean; error?: string; data?: unknown } | null }> {
    setBusy(key); setMessage(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) setMessage({ tone: "warn", text: ERRORS[body?.error ?? ""] ?? "That could not be done. Try again." });
      return { ok: res.ok && Boolean(body?.ok), body };
    } catch { setMessage({ tone: "warn", text: "The request could not be reached. Try again." }); return { ok: false, body: null }; }
    finally { setBusy(null); await load(); }
  }
  async function add(s: McpRegistryServer) {
    const remote = s.remotes.find((r) => r.type === "streamable-http") ?? s.remotes[0];
    if (!remote) return;
    const r = await call("POST", "/api/control/mcp/servers", { registryName: s.name, title: s.title, version: s.version, remoteUrl: remote.url, transport: remote.type }, `add:${s.name}`);
    if (r.ok) setMessage({ tone: "ok", text: `Added ${s.title}. Run a connection check to list its tools before enabling it.` });
  }
  async function check(sv: Server) {
    const r = await call("POST", `/api/control/mcp/servers/${encodeURIComponent(sv.id)}/check`, undefined, `check:${sv.id}`);
    const d = r.body?.data as { outcome?: string; detail?: string } | undefined;
    if (r.ok && d) setMessage({ tone: d.outcome === "ok" ? "ok" : "warn", text: `${sv.title}: ${d.detail}` });
  }

  const servers = data && data !== "error" ? data.servers : [];
  const canEdit = data !== null && data !== "error" && data.canEdit;
  return (
    <>
      <section aria-labelledby="workspace-mcp-heading" className="mt-10 border-t border-white/8 pt-7">
        <h2 id="workspace-mcp-heading" className="text-base font-medium">This workspace&apos;s MCP servers</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Hosted servers added from the registry. A connection check initializes the server and lists its tools without credentials and without calling any tool. Enable a server, then approve the individual tools agents may call. Agents never get tools you have not approved.</p>
        <p aria-live="polite" className={`mt-2 min-h-5 text-sm ${message?.tone === "warn" ? "text-amber-300" : "text-zinc-300"}`}>{message?.text ?? ""}</p>
        {data === "error" ? <p role="alert" className="text-sm text-amber-300">MCP servers could not be loaded.</p>
          : data === null ? <p className="text-sm text-zinc-400">Loading…</p>
          : servers.length === 0 ? <p className="text-sm text-zinc-400">None yet.{canEdit ? " Add one from the registry below." : ""}</p>
          : <ul className="mt-2 divide-y divide-white/[0.07] rounded-xl border border-white/8">{servers.map((sv) => {
            const o = sv.lastCheckOutcome ? OUTCOME[sv.lastCheckOutcome] : null;
            return (
              <li key={sv.id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-100">{sv.title} <span className="font-mono text-xs text-zinc-500">{sv.registryName}{sv.version ? ` · ${sv.version}` : ""}</span></p>
                  <p className="mt-1 break-all font-mono text-[11px] text-zinc-400">{sv.remoteUrl}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs">{o ? <StatusDot tone={o.tone} label={o.label} className="text-xs" /> : <span className="text-zinc-500">Not checked yet</span>}{sv.lastCheckDetail && <span className="text-zinc-400">{sv.lastCheckDetail}</span>}<span className={sv.enabled ? "text-emerald-300" : "text-zinc-500"}>{sv.enabled ? "Enabled" : "Disabled"}</span></p>
                  {sv.toolNames.length > 0 && <details className="mt-1 text-xs text-zinc-400"><summary className="cursor-pointer">{sv.toolNames.length} tool{sv.toolNames.length === 1 ? "" : "s"} · {sv.allowedTools.length} approved for agents</summary>
                    <fieldset className="mt-2"><legend className="sr-only">Tools agents may call on {sv.title}</legend><ul className="grid gap-1 sm:grid-cols-2">{sv.toolNames.map((t) => <li key={t}><label className="flex items-center gap-2 font-mono text-[11px] text-zinc-300"><input type="checkbox" disabled={!canEdit || busy !== null} checked={sv.allowedTools.includes(t)} onChange={(e) => void call("PATCH", "/api/control/mcp/servers", { id: sv.id, allowedTools: e.target.checked ? [...sv.allowedTools, t] : sv.allowedTools.filter((x) => x !== t) }, `tools:${sv.id}`)} />{t}</label></li>)}</ul></fieldset>
                    <p className="mt-1 text-[11px] text-zinc-500">Agents can call only approved tools, and only while the server is enabled. Each call is limited to 4 KB of input with no secrets, and its output is treated as untrusted.</p></details>}
                </div>
                {canEdit && <div className="flex flex-wrap gap-3 text-xs">
                  <button type="button" disabled={busy !== null} onClick={() => void check(sv)} className="text-zinc-200 underline underline-offset-2 disabled:opacity-50">{busy === `check:${sv.id}` ? "Checking…" : "Check connection"}</button>
                  <button type="button" disabled={busy !== null || (!sv.enabled && sv.lastCheckOutcome !== "ok")} onClick={() => void call("PATCH", "/api/control/mcp/servers", { id: sv.id, enabled: !sv.enabled }, `toggle:${sv.id}`)} className="text-zinc-200 underline underline-offset-2 disabled:opacity-40">{sv.enabled ? "Disable" : "Enable"}</button>
                  <button type="button" disabled={busy !== null} aria-label={`Remove ${sv.title}`} onClick={() => void call("DELETE", "/api/control/mcp/servers", { id: sv.id }, `remove:${sv.id}`)} className="text-zinc-400 underline underline-offset-2 disabled:opacity-50">Remove</button>
                </div>}
              </li>);
          })}</ul>}
      </section>
      <McpRegistryBrowser canAdd={canEdit} onAdd={(s) => void add(s)} added={new Set(servers.map((s) => s.registryName))} />
    </>
  );
}
