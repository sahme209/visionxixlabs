"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";

type NodeId = "desktop" | "cockpit" | "agents" | "service" | "github" | "cloud" | "tickets" | "batch" | "ai";
interface MapNode { id: NodeId; x: number; y: number; title: string; sub: string; detail: string; guide: { href: string; label: string } }

const NODES: MapNode[] = [
  { id: "desktop", x: 110, y: 70, title: "Desktop app", sub: "Operational work", detail: "Plan, review, approve and inspect releases, tickets, batches and saved tasks. Paired to your workspace; sessions can be revoked.", guide: { href: "/docs/desktop-install", label: "Install the desktop app" } },
  { id: "cockpit", x: 110, y: 170, title: "Cockpit", sub: "Workspace administration", detail: "Members, roles, usage and billing, API keys, integrations, governance and audit, in the browser at /control.", guide: { href: "/docs/workspaces", label: "Workspaces and administration" } },
  { id: "agents", x: 110, y: 270, title: "External agents", sub: "Cursor, Claude Code, others", detail: "AI agents call V19 through the MCP gateway with scoped API keys. They can request approval and read policy; a key holder cannot approve its own requests.", guide: { href: "/docs/agent-gateway", label: "Agent gateway" } },
  { id: "service", x: 360, y: 170, title: "V19 service", sub: "Records, policy, approvals", detail: "Holds workspace records, permissions, approvals and audit evidence, and makes provider calls with scoped, encrypted credentials. Every write keeps its own approval gate.", guide: { href: "/docs/permissions-model", label: "Permissions model" } },
  { id: "github", x: 630, y: 50, title: "GitHub", sub: "Repos, PRs, workflows", detail: "Repository context and pull-request evidence, and dispatch of the governed GitHub workflow for an exact release version. Dispatch acknowledgement is not proof of application health.", guide: { href: "/docs/releaseops", label: "Release operations" } },
  { id: "cloud", x: 630, y: 125, title: "Cloud accounts", sub: "AWS · Azure · GCP", detail: "Read-oriented discovery and evidence from your cloud accounts through scoped connections.", guide: { href: "/docs/aws-setup", label: "AWS setup" } },
  { id: "tickets", x: 630, y: 200, title: "Tickets and chat", sub: "Jira · ServiceNow · Slack", detail: "Change tickets and incidents linked to exact releases, and governed notifications. Ticket actions follow each provider's own approvals.", guide: { href: "/docs/integration-setup", label: "Integration setup" } },
  { id: "batch", x: 630, y: 275, title: "Batch orchestration", sub: "Airflow · Prefect · Dagster", detail: "DAG and run observations and saved dependencies for releases. Prefect, Dagster and Argo are read-only; nothing is started, retried or cancelled from them.", guide: { href: "/docs/batch-providers", label: "Batch providers" } },
  { id: "ai", x: 360, y: 300, title: "AI models", sub: "Gateway or your own server", detail: "Cloud AI through the AI Gateway with prepaid, metered usage, or a customer-hosted model server in offline installations with no cloud fallback.", guide: { href: "/docs/offline-ai", label: "Offline AI" } },
];
const EDGES: Array<[NodeId, NodeId, string]> = [
  ["desktop", "service", "signed-in session"], ["cockpit", "service", "browser session"], ["agents", "service", "MCP + scoped key"],
  ["service", "github", "repo reads, governed dispatch"], ["service", "cloud", "scoped reads"], ["service", "tickets", "linked tickets, notices"],
  ["service", "batch", "run observations"], ["service", "ai", "metered model calls"],
];
const W = 740, H = 340, NW = 164, NH = 46;

export function ArchitectureMap() {
  const id = useId();
  const [selected, setSelected] = useState<NodeId>("service");
  const [hover, setHover] = useState<NodeId | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const focus = hover ?? selected;
  const node = (n: NodeId) => NODES.find((m) => m.id === n)!;
  const lit = (a: NodeId, b: NodeId) => focus === a || focus === b || focus === "service";
  const current = node(selected);
  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.min(2.2, Math.max(0.7, v.k * f)) }));
  return (
    <figure className="my-8 rounded-2xl border border-white/10 bg-[#111111] p-5" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <figcaption id={`${id}-title`} className="text-sm font-medium text-zinc-100">How V19 fits together</figcaption>
        <div className="inline-flex overflow-hidden rounded-lg border border-white/10 text-xs text-zinc-300">
          <button type="button" aria-label="Zoom out" className="px-2.5 py-1 hover:bg-white/5" onClick={() => zoom(1 / 1.2)}>−</button>
          <button type="button" aria-label="Reset view" className="border-x border-white/10 px-2.5 py-1 hover:bg-white/5" onClick={() => setView({ k: 1, x: 0, y: 0 })}>Fit</button>
          <button type="button" aria-label="Zoom in" className="px-2.5 py-1 hover:bg-white/5" onClick={() => zoom(1.2)}>+</button>
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-400">Select a part to see what it does and open its guide. Drag to pan.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full cursor-grab touch-none select-none active:cursor-grabbing" role="group" aria-label="Architecture map"
        onPointerDown={(e) => { if ((e.target as Element).closest("[data-node]")) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; e.currentTarget.setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const r = e.currentTarget.getBoundingClientRect(); const s = r.width ? W / r.width : 1; setView((v) => ({ ...v, x: d.vx + (e.clientX - d.x) * s, y: d.vy + (e.clientY - d.y) * s })); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <g transform={`translate(${view.x} ${view.y}) translate(${W / 2} ${H / 2}) scale(${view.k}) translate(${-W / 2} ${-H / 2})`}>
          {EDGES.map(([a, b, label]) => { const p = node(a), q = node(b); const on = lit(a, b);
            const x1 = p.x + (q.x > p.x ? NW / 2 : 0), y1 = p.y + (q.y > p.y + 40 ? NH / 2 : 0), x2 = q.x - (q.x > p.x ? NW / 2 : 0), y2 = q.y - (q.y > p.y + 40 ? NH / 2 : 0);
            const mx = (x1 + x2) / 2;
            return <g key={`${a}-${b}`} opacity={on ? 1 : 0.25} style={{ transition: "opacity .2s" }}>
              <path d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} fill="none" stroke={on ? "#7dd3fc" : "#52525b"} strokeWidth={on ? 1.8 : 1.2} />
              {on && <text x={mx} y={(y1 + y2) / 2 - 6} fontSize="9.5" textAnchor="middle" fill="#a1a1aa">{label}</text>}
            </g>; })}
          {NODES.map((n) => { const on = n.id === focus || EDGES.some(([a, b]) => (a === focus && b === n.id) || (b === focus && a === n.id)) || focus === "service";
            return <g key={n.id} data-node transform={`translate(${n.x - NW / 2} ${n.y - NH / 2})`} tabIndex={0} role="button" aria-pressed={selected === n.id} aria-label={`${n.title}: ${n.sub}`}
              style={{ cursor: "pointer", outline: "none", transition: "opacity .2s" }} opacity={on ? 1 : 0.45}
              onClick={() => setSelected(n.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(n.id); } }}
              onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}>
              <rect width={NW} height={NH} rx="10" fill={n.id === "service" ? "#0c2233" : "#171717"} stroke={selected === n.id ? "#7dd3fc" : "rgba(255,255,255,.14)"} strokeWidth={selected === n.id ? 1.6 : 1} />
              <text x="12" y="20" fontSize="12" fill="#f4f4f5">{n.title}</text>
              <text x="12" y="36" fontSize="9.5" fill="#a1a1aa">{n.sub}</text>
            </g>; })}
        </g>
      </svg>
      <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-4" aria-live="polite">
        <p className="text-sm font-medium text-zinc-100">{current.title}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-300">{current.detail}</p>
        <Link href={current.guide.href} className="mt-2 inline-block text-xs text-sky-300 underline underline-offset-4 hover:text-sky-200">{current.guide.label} →</Link>
      </div>
      <details className="mt-3 text-xs text-zinc-400"><summary className="cursor-pointer text-zinc-300">Text version</summary>
        <ul className="mt-2 grid gap-1">{NODES.map((n) => <li key={n.id}><strong className="text-zinc-200">{n.title}</strong> ({n.sub}): {n.detail} <Link href={n.guide.href} className="underline">{n.guide.label}</Link></li>)}</ul>
      </details>
    </figure>
  );
}
