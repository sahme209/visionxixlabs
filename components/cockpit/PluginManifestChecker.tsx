"use client";
import { useState } from "react";
import { EXAMPLE_PLUGIN_MANIFEST, validatePluginManifest, type ManifestReview } from "@/lib/plugins/pluginManifest";

/** Paste a V19 plugin manifest to check it and see what a reviewer would approve. Checking grants nothing. */
export function PluginManifestChecker() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok: true; review: ManifestReview; name: string } | { ok: false; errors: string[] } | null>(null);
  function check() {
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { setResult({ ok: false, errors: ["The manifest is not valid JSON."] }); return; }
    const r = validatePluginManifest(raw);
    setResult(r.ok ? { ok: true, review: r.review, name: `${r.manifest.name} ${r.manifest.pluginVersion}` } : r);
  }
  return (
    <section aria-labelledby="plugin-manifest-heading" className="mt-10 border-t border-white/8 pt-7">
      <h2 id="plugin-manifest-heading" className="text-base font-medium">Build a plugin</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Vendors and teams describe a plugin in one JSON manifest: the hosted MCP server V19 reaches, each tool and whether it only reads, the events it wants and the API scopes it asks for. Check a manifest here before submitting it. Checking grants nothing.</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs"><button type="button" onClick={() => { setText(JSON.stringify(EXAMPLE_PLUGIN_MANIFEST, null, 2)); setResult(null); }} className="text-zinc-300 underline underline-offset-4">Load the example manifest</button><a href="/docs/plugin-manifest" className="text-zinc-300 underline underline-offset-4">Manifest reference</a></div>
      <label htmlFor="plugin-manifest-text" className="mt-4 block text-xs text-zinc-400">Plugin manifest (JSON)</label>
      <textarea id="plugin-manifest-text" value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} rows={8} spellCheck={false} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-zinc-200" placeholder='{"kind":"v19.plugin","version":1,…}' />
      <button type="button" disabled={!text.trim()} onClick={check} className="mt-3 inline-flex min-h-9 items-center rounded-full bg-white/5 px-4 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50">Check manifest</button>
      <div aria-live="polite" className="mt-3 text-sm">
        {result && !result.ok && <ul className="list-disc space-y-1 pl-5 text-amber-300">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {result && result.ok && <div className="space-y-1 text-zinc-300">
          <p className="text-zinc-100">{result.name} is a valid manifest.</p>
          <p>Reached at {result.review.host} · {result.review.readOnlyTools} read-only {result.review.readOnlyTools === 1 ? "tool" : "tools"} · {result.review.writeTools.length} {result.review.writeTools.length === 1 ? "tool that writes" : "tools that write"}</p>
          {result.review.writeTools.length > 0 && <ul className="list-disc pl-5 text-xs text-zinc-400">{result.review.writeTools.map((t) => <li key={t.name}><span className="font-mono text-zinc-300">{t.name}</span>: {t.effect} Needs a person&apos;s approval every time.</li>)}</ul>}
          <p className="text-xs text-zinc-400">Scopes: {result.review.scopes.join(", ") || "none"} · Events: {result.review.events.join(", ") || "none"}</p>
        </div>}
      </div>
    </section>
  );
}
