"use client";

/**
 * CommandPalette — global ⌘K (or Ctrl+K) overlay.
 *
 * Press ⌘K anywhere on the site → opens a frosted-glass modal with a
 * search input and a typed list of every navigable surface. Type to
 * fuzzy-filter, ↑↓ to move, Enter to navigate. Esc closes.
 *
 * Mounted in app/layout.tsx so it's available globally.
 *
 * Apple/Linear/Vercel/Cron-grade kbd navigator. Coral accent on the
 * active row + result count, surface-frost material, mono-label
 * category headers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
  CloudIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  PlayCircleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  category: "Product" | "Resources" | "Company" | "Connect" | "External";
  icon: typeof CommandLineIcon;
  external?: boolean;
  keywords?: readonly string[];
}

const COMMANDS: readonly CommandItem[] = [
  // Product
  { id: "home",       label: "Home",              href: "/",                       category: "Product",   icon: SparklesIcon,      hint: "The landing page" },
  { id: "axiom",      label: "Axiom Agent",       href: "/axiom",                  category: "Product",   icon: RocketLaunchIcon,  hint: "Autonomous cloud operations" },
  { id: "releaseops", label: "Axiom ReleaseOps",  href: "/axiom/releaseops",       category: "Product",   icon: ShieldCheckIcon,   hint: "Deployment governance + monitoring" },
  { id: "demo",       label: "Try the demo",      href: "/demo",                   category: "Product",   icon: PlayCircleIcon,    hint: "Scripted walkthrough, no signup" },
  { id: "operator",   label: "Download Axiom Agent", href: "/download", category: "Product", icon: CloudIcon, hint: "Install the desktop command center", keywords: ["start", "signup", "onboard", "download"] },
  { id: "plans",      label: "Pricing",           href: "/plans",                  category: "Product",   icon: DocumentTextIcon,  hint: "Custom pricing based on cloud usage", keywords: ["pricing", "cost"] },
  { id: "integrations", label: "Integrations",    href: "/integrations",           category: "Product",   icon: CommandLineIcon,   hint: "Every connector we ship" },
  { id: "download",   label: "Download desktop",  href: "/download",               category: "Product",   icon: ArrowDownTrayIcon, hint: "macOS, Windows, Linux" },

  // Resources
  { id: "docs",       label: "Documentation",     href: "/docs",                   category: "Resources", icon: BookOpenIcon,      hint: "Self-serve guides for the platform" },
  { id: "blog",       label: "Blog",              href: "/blog",                   category: "Resources", icon: DocumentTextIcon,  hint: "Product notes + deep dives" },
  { id: "changelog",  label: "Changelog",         href: "/changelog",              category: "Resources", icon: RocketLaunchIcon,  hint: "Phase-by-phase shipping log", keywords: ["releases", "updates"] },
  { id: "insights",   label: "Insights",          href: "/insights",               category: "Resources", icon: BookOpenIcon,      hint: "Field notes from production" },
  { id: "casestudies", label: "Case studies",     href: "/case-studies",           category: "Resources", icon: DocumentTextIcon,  hint: "Representative engagements" },
  { id: "design",     label: "Design system",     href: "/design",                 category: "Resources", icon: SparklesIcon,      hint: "Tokens, materials, primitives" },

  // Company
  { id: "manifesto",  label: "Manifesto",         href: "/manifesto",              category: "Company",   icon: SparklesIcon,      hint: "Seven things we believe" },
  { id: "principles", label: "Design principles", href: "/principles",             category: "Company",   icon: SparklesIcon,      hint: "How we make visual decisions" },
  { id: "handbook",   label: "Engineering handbook", href: "/handbook",            category: "Company",   icon: CodeBracketIcon,   hint: "How we build it" },
  { id: "team",       label: "Team",              href: "/team",                   category: "Company",   icon: SparklesIcon,      hint: "How a small team ships carefully" },
  { id: "trust",      label: "Trust",             href: "/trust",                  category: "Company",   icon: ShieldCheckIcon,   hint: "Safety contract" },
  { id: "security",   label: "Security",          href: "/security",               category: "Company",   icon: ShieldCheckIcon,   hint: "Trust center" },
  { id: "press",      label: "Press & Media",     href: "/press",                  category: "Company",   icon: DocumentTextIcon },
  { id: "contact",    label: "Contact",           href: "/contact",                category: "Company",   icon: DocumentTextIcon,  hint: "One operator, one form" },
  { id: "status",     label: "System status",     href: "/status",                 category: "Company",   icon: ShieldCheckIcon,   hint: "Live uptime" },

  // External
  { id: "linkedin",   label: "LinkedIn",          href: "https://www.linkedin.com/company/vision-xix-labs/", category: "External", icon: ArrowUpRightIcon, external: true },
  { id: "github",     label: "GitHub · Axiom repo", href: "https://github.com/sahme209/axiom-releases",     category: "External", icon: ArrowUpRightIcon, external: true },
  { id: "x",          label: "X (Twitter)",       href: "https://x.com/VisionXIXLabs",                      category: "External", icon: ArrowUpRightIcon, external: true },
];

/* Cheap fuzzy match — checks all characters of the query appear, in
   order, as a (possibly non-contiguous) sub-sequence of the haystack.
   Returns a score (higher = better; based on position of first match
   and how clustered the matches are). */
function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact substring is best.
  const idx = t.indexOf(q);
  if (idx >= 0) return 1000 - idx;

  // Subsequence match — accumulate score, penalize gaps.
  let ti = 0, score = 0, lastIdx = -1;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    if (lastIdx >= 0) score -= (found - lastIdx - 1); // gap penalty
    score += 10;
    lastIdx = found;
    ti = found + 1;
  }
  return score;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      if (cmdKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus the input when palette opens
  useEffect(() => {
    if (open) {
      // Defer to next tick so the modal mounts first.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setActiveIdx(0);
    }
  }, [open]);

  // Search-scored, sorted results
  const results = useMemo(() => {
    if (!query.trim()) {
      // No query → group by category, return everything.
      return COMMANDS.map((c) => ({ cmd: c, score: 1 }));
    }
    return COMMANDS
      .map((cmd) => {
        const fields = [cmd.label, cmd.hint ?? "", cmd.category, ...(cmd.keywords ?? [])].join(" ");
        return { cmd, score: fuzzyScore(query, fields) };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query]);

  // Clamp activeIdx into the new results length whenever it changes.
  useEffect(() => {
    if (activeIdx >= results.length) setActiveIdx(Math.max(0, results.length - 1));
  }, [results.length, activeIdx]);

  // Per-section grouping (only when no query — Apple Spotlight style)
  const grouped = useMemo(() => {
    if (query.trim()) return null;
    const out: Record<string, CommandItem[]> = {};
    for (const r of results) {
      (out[r.cmd.category] ??= []).push(r.cmd);
    }
    return out;
  }, [query, results]);

  const onSelect = useCallback((cmd: CommandItem) => {
    setOpen(false);
    if (cmd.external) {
      window.open(cmd.href, "_blank", "noopener,noreferrer");
    } else {
      router.push(cmd.href);
    }
  }, [router]);

  // ↑↓ Enter handling on the input
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIdx]?.cmd;
      if (target) onSelect(target);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="surface-frost relative w-full max-w-xl rounded-2xl overflow-hidden shadow-[0_40px_100px_-30px_rgba(0,0,0,0.6)]">
        {/* Search row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <MagnifyingGlassIcon className="h-4 w-4 text-brand-coral/85" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search the site… type, then ↵"
            className="flex-1 bg-transparent text-[14.5px] text-white placeholder:text-zinc-500 outline-none border-0 focus:ring-0"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 border border-white/[0.10] rounded px-1.5 py-0.5 tabular-nums">
            {results.length} / {COMMANDS.length}
          </span>
          <kbd className="text-[10px] font-mono text-zinc-500 border border-white/[0.10] rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[13px] text-zinc-500 mb-2">No matches.</p>
              <p className="text-[11.5px] text-zinc-600">Try “demo”, “pricing”, “handbook”, or “status”.</p>
            </div>
          ) : grouped ? (
            // No query — grouped Spotlight-style
            (["Product", "Resources", "Company", "External"] as const).map((cat) => {
              const items = grouped[cat];
              if (!items || items.length === 0) return null;
              return (
                <div key={cat} className="mb-2">
                  <p className="mono-label px-4 py-1.5 text-[9.5px] text-zinc-500">{cat}</p>
                  {items.map((cmd) => {
                    const idx = results.findIndex((r) => r.cmd.id === cmd.id);
                    const active = idx === activeIdx;
                    return <Row key={cmd.id} cmd={cmd} active={active} onSelect={onSelect} onHover={() => setActiveIdx(idx)} />;
                  })}
                </div>
              );
            })
          ) : (
            // Query active — flat list ranked by score
            results.map((r, idx) => (
              <Row
                key={r.cmd.id}
                cmd={r.cmd}
                active={idx === activeIdx}
                onSelect={onSelect}
                onHover={() => setActiveIdx(idx)}
              />
            ))
          )}
        </div>

        {/* Footer — keyboard hints */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <kbd className="border border-white/[0.10] rounded px-1.5 py-0.5">↑</kbd>
            <kbd className="border border-white/[0.10] rounded px-1.5 py-0.5">↓</kbd>
            <span>move</span>
            <kbd className="border border-white/[0.10] rounded px-1.5 py-0.5 ml-2">↵</kbd>
            <span>open</span>
          </div>
          <span>
            ⌘K from anywhere
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  cmd, active, onSelect, onHover,
}: {
  cmd: CommandItem;
  active: boolean;
  onSelect: (cmd: CommandItem) => void;
  onHover: () => void;
}) {
  const Icon = cmd.icon;
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={() => onSelect(cmd)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        active
          ? "bg-brand-coral/[0.08] text-white"
          : "text-zinc-300 hover:bg-white/[0.03]"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand-coral" : "text-zinc-400"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[13.5px] font-medium truncate ${active ? "text-white" : "text-zinc-100"}`}>
          {cmd.label}
        </p>
        {cmd.hint && <p className="text-[11.5px] text-zinc-500 truncate">{cmd.hint}</p>}
      </div>
      {cmd.external ? (
        <ArrowUpRightIcon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-brand-coral" : "text-zinc-600"}`} />
      ) : (
        <ArrowRightIcon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-brand-coral" : "text-zinc-600"}`} />
      )}
    </button>
  );
}
