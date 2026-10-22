export default function ControlLoading() {
 return <div role="status" aria-live="polite" aria-label="Loading workspace" className="max-w-4xl animate-pulse"><div aria-hidden className="h-6 w-48 rounded bg-white/10"/><div aria-hidden className="mt-4 h-3 w-2/3 rounded bg-white/5"/><div aria-hidden className="mt-8 grid gap-4 sm:grid-cols-3">{[0,1,2].map(item=><div key={item} className="h-28 rounded-xl border border-white/10 bg-white/[0.025]"/>)}</div><span className="sr-only">Loading workspace…</span></div>;
}
