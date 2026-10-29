import {useEffect, useRef, useState} from "react";
import {open} from "@tauri-apps/plugin-shell";
import {desktopClient} from "../lib/desktopClient";
interface DocumentationResult {title: string; excerpt: string; url: string}
function safeResult(value: unknown): value is DocumentationResult {
  if (!value || typeof value !== "object") return false;
  const item = value as DocumentationResult;
  if (typeof item.title !== "string" || typeof item.excerpt !== "string" || typeof item.url !== "string") return false;
  try { const url = new URL(item.url); return url.origin === "https://learn.microsoft.com" && !url.username && !url.password && !url.port; } catch { return false; }
}
export function DesktopMcpTools({enabled}: {enabled: boolean}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"check" | "search" | null>(null);
  const [results, setResults] = useState<DocumentationResult[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false), pending = useRef(false), epoch = useRef(0);
  useEffect(() => { mounted.current = true; epoch.current++; setResults([]); setNotice(null); return () => { mounted.current = false; epoch.current++; }; }, [enabled]);
  async function run(action: "check" | "search") {
    if (pending.current || (action === "search" && (!enabled || !query.trim()))) return;
    const context = desktopClient.config, generation = epoch.current;
    const owns = () => mounted.current && generation === epoch.current && context === desktopClient.config;
    pending.current = true; setBusy(action); setNotice(null); setResults([]);
    try {
      const result = await desktopClient.microsoftLearn(action === "check" ? {action} : {action, query: query.trim()});
      if (!owns()) return;
      if (!result.ok) throw Error("documentation_unavailable");
      if (action === "check") {
        if (!("searchAvailable" in result.data) || result.data.searchAvailable !== true) throw Error("documentation_contract_invalid");
        setNotice("Microsoft Learn documentation search is reachable. Workspace installation and Agent tool permissions remain separate.");
      } else {
        if (!("results" in result.data) || !Array.isArray(result.data.results)) throw Error("documentation_contract_invalid");
        const safe = result.data.results.filter(safeResult).slice(0, 10);
        setResults(safe); setNotice(safe.length ? `${safe.length} documentation results received.` : "No documentation matched this topic.");
      }
    } catch { if (owns()) setNotice("The documentation request could not be verified. Check workspace installation and service availability, then try again."); }
    finally { pending.current = false; if (mounted.current) setBusy(null); }
  }
  return <section aria-label="Microsoft Learn MCP tools" className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.018] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-medium text-zinc-100">Microsoft Learn MCP</h2><p className="mt-1 text-xs text-zinc-500">Reviewed public documentation server · {enabled ? "Enabled in workspace" : "Install and enable below to search"}</p></div><button type="button" disabled={busy !== null} onClick={() => void run("check")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-40">{busy === "check" ? "Checking…" : "Check connection"}</button></div>
    <form onSubmit={event => {event.preventDefault(); void run("search");}} className="mt-4">
      <label htmlFor="desktop-docs-topic" className="text-xs text-zinc-300">Documentation topic</label>
      <p className="mt-1 text-xs leading-5 text-zinc-500">Your topic is sent to Microsoft’s public server. Use public technical terms; do not include secrets, private code or personal information. This does not inspect your cloud account.</p>
      <div className="mt-3 flex gap-2"><input id="desktop-docs-topic" type="search" maxLength={300} value={query} onChange={event => setQuery(event.target.value)} disabled={!enabled || busy !== null} placeholder="Azure managed identity" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#151719] px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"/><button type="submit" disabled={!enabled || busy !== null || !query.trim()} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-40">{busy === "search" ? "Searching…" : "Search docs"}</button></div>
    </form>
    {notice && <p role="status" className="mt-3 text-xs leading-5 text-zinc-300">{notice}</p>}
    {results.length > 0 && <div aria-label="Documentation results" className="mt-4 divide-y divide-white/[0.06]">{results.map((result, index) => <article key={`${result.url}:${index}`} className="py-3"><button type="button" onClick={() => {if (safeResult(result)) void open(result.url).catch(() => setNotice("The documentation link could not be opened."));}} className="text-left text-xs font-medium text-zinc-100 underline underline-offset-4">{result.title.slice(0, 200)} ↗</button><p className="mt-2 whitespace-pre-line break-words text-xs leading-5 text-zinc-500">{result.excerpt.slice(0, 500)}</p></article>)}</div>}
  </section>;
}
