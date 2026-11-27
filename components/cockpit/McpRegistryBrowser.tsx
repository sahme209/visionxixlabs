"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { McpRegistryServer } from "@/lib/integrations/mcp/mcpRegistry";

type Page = { servers: McpRegistryServer[]; nextCursor: string | null };
const TOPICS = ["kubernetes", "aws", "github", "postgres", "datadog", "jira", "slack", "terraform"];

/**
 * Browse the public MCP server registry: thousands of third-party servers, shown as untrusted listings.
 * Browsing never connects to a server or grants an agent anything. Owners and admins can add a hosted
 * server to the workspace; it starts disabled until a connection check lists its tools.
 */
export function McpRegistryBrowser({ onAdd, added, canAdd = false }: { onAdd?: (s: McpRegistryServer) => void; added?: ReadonlySet<string>; canAdd?: boolean } = {}) {
  const [query, setQuery] = useState("");
  const [servers, setServers] = useState<McpRegistryServer[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const live = useRef(0);
  const load = useCallback(async (search: string, after: string | null) => {
    const call = ++live.current; setState("busy");
    try {
      const params = new URLSearchParams(); if (search.trim()) params.set("search", search.trim()); if (after) params.set("cursor", after);
      const res = await fetch(`/api/control/mcp/registry?${params}`, { cache: "no-store" });
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: Page } | null;
      if (call !== live.current) return;
      if (!res.ok || !body?.ok || !body.data) { setState("error"); return; }
      setServers((prev) => (after && prev ? [...prev, ...body.data!.servers] : body.data!.servers));
      setCursor(body.data.nextCursor); setState("idle");
    } catch { if (call === live.current) setState("error"); }
  }, []);
  useEffect(() => { void load("", null); }, [load]);
  return (
    <section aria-labelledby="mcp-registry-heading" className="mt-10 border-t border-white/8 pt-7">
      <h2 id="mcp-registry-heading" className="text-base font-medium">MCP server registry</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Thousands of third-party MCP servers from the public registry. Listings come from their publishers and are not reviewed by V19. Browsing connects to nothing and gives agents no new tools. Owners and admins can add hosted servers to the workspace above.</p>
      <form className="mt-4 flex max-w-xl gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setServers(null); void load(query, null); }}>
        <label className="sr-only" htmlFor="mcp-registry-search">Search MCP servers</label>
        <input id="mcp-registry-search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} placeholder="Search, for example postgres, jira or kubernetes" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100" />
        <button type="submit" className="inline-flex min-h-9 items-center rounded-full bg-white/5 px-4 text-sm text-zinc-200 hover:bg-white/10">Search</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Popular topics">{TOPICS.map((t) => <button key={t} type="button" onClick={() => { setQuery(t); setServers(null); void load(t, null); }} className="min-h-8 rounded-full border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/5">{t}</button>)}</div>
      <div aria-live="polite">
        {state === "error" && <p role="alert" className="mt-4 text-sm text-amber-300">The registry could not be reached. Try again.</p>}
        {servers === null && state === "busy" && <p className="mt-4 text-sm text-zinc-400">Loading servers…</p>}
        {servers !== null && servers.length === 0 && state !== "busy" && <p className="mt-4 text-sm text-zinc-400">No servers match that search.</p>}
      </div>
      {servers && servers.length > 0 && <ul aria-label="MCP servers" className="mt-4 grid gap-x-6 gap-y-1 md:grid-cols-2 2xl:grid-cols-3">{servers.map((s) => (
        <li key={s.name} className="min-w-0 rounded-xl px-2 py-3 hover:bg-white/[0.025]">
          <p className="truncate text-[13px] font-medium text-zinc-100" title={s.title}>{s.title}</p>
          <p className="truncate font-mono text-[11px] text-zinc-500" title={s.name}>{s.name}{s.version ? ` · ${s.version}` : ""}</p>
          {s.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{s.description}</p>}
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400">
            {s.connections.includes("remote") && <span>Hosted at {s.remoteHosts.slice(0, 2).join(", ")}</span>}
            {s.connections.includes("local_package") && <span>Runs locally ({s.packageTypes.join(", ")})</span>}
            {canAdd && onAdd && s.remotes.length > 0 && (added?.has(s.name) ? <span className="text-emerald-300">Added</span> : <button type="button" onClick={() => onAdd(s)} aria-label={`Add ${s.title} to this workspace`} className="text-zinc-200 underline underline-offset-2">Add to workspace</button>)}
            {(s.repositoryUrl || s.websiteUrl) && <a href={(s.repositoryUrl ?? s.websiteUrl)!} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">Publisher page</a>}
          </p>
        </li>))}</ul>}
      {cursor && servers && <button type="button" disabled={state === "busy"} onClick={() => void load(query, cursor)} className="mt-4 inline-flex min-h-9 items-center rounded-full bg-white/5 px-4 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50">{state === "busy" ? "Loading…" : "Show more"}</button>}
    </section>
  );
}
