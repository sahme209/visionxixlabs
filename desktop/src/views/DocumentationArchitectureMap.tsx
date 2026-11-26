import { useState } from "react";
import { ExternalLink } from "../components/Primitives";
import { ARCHITECTURE_EDGES, ARCHITECTURE_NODES, type NodeId } from "../../../lib/docs/architectureModel";

const WEB = "https://visionxixlabs.com";
const W = 740, H = 340, NW = 164, NH = 46;

/** The website's architecture map inside desktop Documentation: select a part, read what it does, open its guide. */
export function DocumentationArchitectureMap() {
  const [selected, setSelected] = useState<NodeId>("service");
  const [hover, setHover] = useState<NodeId | null>(null);
  const focus = hover ?? selected;
  const node = (id: NodeId) => ARCHITECTURE_NODES.find((n) => n.id === id)!;
  const near = (id: NodeId) => focus === "service" || id === focus || ARCHITECTURE_EDGES.some(([a, b]) => (a === focus && b === id) || (b === focus && a === id));
  const current = node(selected);
  return <div className="studio-arch-map">
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Architecture map">
      {ARCHITECTURE_EDGES.map(([a, b, label]) => {
        const p = node(a), q = node(b), on = focus === "service" || focus === a || focus === b;
        const x1 = p.x + (q.x > p.x ? NW / 2 : 0), y1 = p.y + (q.y > p.y + 40 ? NH / 2 : 0), x2 = q.x - (q.x > p.x ? NW / 2 : 0), y2 = q.y - (q.y > p.y + 40 ? NH / 2 : 0), mx = (x1 + x2) / 2;
        return <g key={`${a}-${b}`} className="studio-arch-edge" data-on={on || undefined}>
          <path d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} />
          {on && <text x={mx} y={(y1 + y2) / 2 - 6} textAnchor="middle">{label}</text>}
        </g>;
      })}
      {ARCHITECTURE_NODES.map((n) => <g key={n.id} className="studio-arch-node" data-on={near(n.id) || undefined} data-selected={selected === n.id || undefined}
        transform={`translate(${n.x - NW / 2} ${n.y - NH / 2})`} tabIndex={0} role="button" aria-pressed={selected === n.id} aria-label={`${n.title}: ${n.sub}`}
        onClick={() => setSelected(n.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(n.id); } }}
        onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}>
        <rect width={NW} height={NH} rx="10" />
        <text x="12" y="20" className="studio-arch-title">{n.title}</text>
        <text x="12" y="36" className="studio-arch-sub">{n.sub}</text>
      </g>)}
    </svg>
    <div className="studio-arch-detail" aria-live="polite">
      <strong>{current.title}</strong>
      <p>{current.detail}</p>
      <ExternalLink className="btn-secondary" href={WEB + current.guide.href}>{current.guide.label}</ExternalLink>
    </div>
  </div>;
}
