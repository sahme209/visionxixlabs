"use client";
import { useId, useState } from "react";

type Mode = "cloud" | "offline";
type Flow = { id: string; from: string; to: string; label: string; detail: string; crosses: boolean };

const NODES = {
  desktop: { x: 90, y: 150, title: "V19 desktop", sub: "Your machine" },
  service: { x: 330, y: 150, title: "V19 service", sub: "Workspace records" },
  gateway: { x: 570, y: 70, title: "AI Gateway", sub: "Cloud model providers" },
  local: { x: 570, y: 70, title: "Your model server", sub: "vLLM · Ollama · LM Studio" },
  providers: { x: 570, y: 230, title: "Connected providers", sub: "GitHub · cloud · tickets" },
} as const;

/** What leaves the machine, per AI mode. Statements mirror the Offline AI and integration guides; nothing here enables a mode. */
function flows(mode: Mode, connectors: boolean): Flow[] {
  const out: Flow[] = [
    { id: "workspace", from: "desktop", to: "service", crosses: mode === "cloud", label: "Sign-in and workspace records",
      detail: mode === "cloud"
        ? "The desktop signs in to your workspace and reads or saves release, ticket and task records through the hosted V19 service. Paired sessions can be revoked by an administrator."
        : "In an offline installation, the V19 service is operated in your environment by your deployment operator, so workspace records stay there. Paired sessions can still be revoked by an administrator." },
  ];
  out.push(mode === "cloud"
    ? { id: "ai", from: "service", to: "gateway", crosses: true, label: "Prompts and context for AI calls",
        detail: "Cloud AI calls send the prompt and the context you include to model providers through the AI Gateway. Usage is metered against your prepaid allowance." }
    : { id: "ai", from: "service", to: "local", crosses: false, label: "Agent decisions to your model server",
        detail: "Offline AI sends Agent decisions only to the operator-configured server on its allowlisted host. Cloud fallback and Gateway discovery are refused; Bot AI, generic cloud text calls and image generation are unavailable." });
  if (connectors) out.push({ id: "connectors", from: "service", to: "providers", crosses: true, label: "Scoped provider calls",
    detail: "Connections use scoped credentials stored encrypted for your workspace. Calls happen only when a workflow uses that connection, and writes still need their approval gates. Offline AI does not make these calls local." });
  return out;
}

export function DataBoundaryDiagram() {
  const [mode, setMode] = useState<Mode>("cloud");
  const [connectors, setConnectors] = useState(true);
  const [active, setActive] = useState<string>("ai");
  const id = useId();
  const list = flows(mode, connectors);
  const current = list.find((f) => f.id === active) ?? list[0];
  const node = (key: keyof typeof NODES) => NODES[key];
  const aiNode = mode === "cloud" ? "gateway" : "local";
  return (
    <figure className="my-8 rounded-2xl border border-white/10 bg-[#111111] p-5" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="text-sm font-medium text-zinc-100">Where your data goes</figcaption>
      <p className="mt-1 text-xs text-zinc-400">Switch the AI mode and connectors to see which paths exist. This explains the documented design; it does not change any setting.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <div role="radiogroup" aria-label="AI mode" className="inline-flex overflow-hidden rounded-lg border border-white/10">
          {(["cloud", "offline"] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m}
            onClick={() => { setMode(m); setActive("ai"); }}
            className={`px-3 py-1.5 ${mode === m ? "bg-white/10 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>{m === "cloud" ? "Cloud AI" : "Offline AI (customer-hosted)"}</button>)}
        </div>
        <label className="inline-flex items-center gap-2 text-zinc-300"><input type="checkbox" checked={connectors} onChange={(e) => { setConnectors(e.target.checked); if (!e.target.checked && active === "connectors") setActive("ai"); }} />Connected providers</label>
      </div>
      <svg viewBox="0 0 680 300" className="mt-4 w-full" role="img" aria-label={`${list.length} data paths: ${list.map((f) => f.label).join("; ")}`}>
        <defs>
          <marker id={`${id}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="currentColor" /></marker>
        </defs>
        {mode === "cloud"
          ? <rect x="8" y="20" width="200" height="260" rx="14" fill="none" stroke="rgba(110,231,183,.45)" strokeDasharray="5 5" />
          : <path d="M8 20 H660 V140 H460 V280 H8 Z" fill="none" stroke="rgba(110,231,183,.45)" strokeDasharray="5 5" strokeLinejoin="round" />}
        <text x="20" y="40" fontSize="11" fill="rgba(110,231,183,.9)">{mode === "cloud" ? "Your machine" : "Your environment"}</text>
        {list.map((f) => {
          const a = node(f.from as keyof typeof NODES), b = node(f.to as keyof typeof NODES);
          const on = f.id === current.id;
          return <g key={f.id} className={on ? "text-sky-300" : "text-zinc-400"} style={{ cursor: "pointer" }} onClick={() => setActive(f.id)}>
            <path d={`M${a.x + 70} ${a.y} C${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} ${b.x - 74} ${b.y}`} fill="none" stroke="currentColor" strokeWidth={on ? 2.5 : 1.5}
              strokeDasharray={f.crosses ? undefined : "4 4"} markerEnd={`url(#${id}-arrow)`} />
          </g>;
        })}
        {(["desktop", "service", aiNode, ...(connectors ? ["providers"] as const : [])] as Array<keyof typeof NODES>).map((key) => {
          const n = node(key);
          return <g key={key} transform={`translate(${n.x - 70} ${n.y - 26})`}>
            <rect width="140" height="52" rx="10" fill="#171717" stroke={key === "local" || (key === "service" && mode === "offline") ? "rgba(110,231,183,.6)" : "rgba(255,255,255,.14)"} />
            <text x="12" y="22" fontSize="12" fill="#f4f4f5">{n.title}</text>
            <text x="12" y="39" fontSize="10" fill="#a1a1aa">{key === "service" && mode === "offline" ? "Your installation" : n.sub}</text>
          </g>;
        })}
      </svg>
      <div role="tablist" aria-label="Data paths" className="mt-2 flex flex-wrap gap-2">
        {list.map((f) => <button key={f.id} type="button" role="tab" aria-selected={f.id === current.id} aria-controls={`${id}-panel`} onClick={() => setActive(f.id)}
          className={`rounded-full border px-3 py-1 text-xs ${f.id === current.id ? "border-sky-300/60 bg-sky-300/10 text-sky-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>{f.label}</button>)}
      </div>
      <div id={`${id}-panel`} role="tabpanel" className="mt-3 rounded-xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
        <p className="text-xs uppercase tracking-wider text-zinc-400">{current.crosses ? "Leaves your machine" : "Stays in your environment"}</p>
        <p className="mt-1">{current.detail}</p>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-zinc-400">Offline AI is a source preview: production enablement, model qualification and disconnected-installation acceptance are not complete. It does not certify that the whole application makes no external network calls.</p>
    </figure>
  );
}
