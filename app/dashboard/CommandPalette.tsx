"use client";

/**
 * Cmd+K command palette — the keyboard-first jumpbar nobody expects.
 *
 * Three sections:
 *   - Navigate    pre-baked entries to every surface
 *   - Actions     trigger a scan, mark approvals, etc.
 *   - Live search hits /api/findings/export.csv?q= as a quick text
 *                 probe (returns 200 for any match, so we treat
 *                 success as 'has matches' without parsing the CSV)
 *
 * Opens on Cmd+K / Ctrl+K. Closes on Escape or outside click. Arrow
 * keys navigate; Enter activates. Calm-rule styled.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlassIcon,
  CloudIcon,
  EyeIcon,
  LockClosedIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ClockIcon,
  BoltIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";

interface Entry {
  id: string;
  label: string;
  hint?: string;
  icon: typeof CloudIcon;
  onActivate: () => void | Promise<void>;
  section: "Navigate" | "Actions";
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
    // Return focus to whatever triggered the palette (the header chip,
    // or wherever Cmd+K was pressed) instead of dropping it to <body> —
    // same rule Navigation.tsx's mobile menu follows on Escape-close.
    previouslyFocusedRef.current?.focus();
  }, []);

  const triggerScan = useCallback(async () => {
    setScanning(true);
    try {
      await fetch("/api/scan/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      router.refresh();
    } catch {
      // Silent — the dashboard's RunScanButton remains the proper UI.
    } finally {
      setScanning(false);
      close();
    }
  }, [router, close]);

  // Build entries. Memo'd implicitly by being recomputed each render
  // (the list is small enough that filtering downstream is cheap).
  const ENTRIES: Entry[] = [
    { id: "nav-dashboard",   label: "Dashboard",          section: "Navigate", icon: ChartBarIcon,  onActivate: () => { router.push("/dashboard"); close(); } },
    { id: "nav-briefing",    label: "Daily briefing",     section: "Navigate", icon: SparklesIcon,  onActivate: () => { router.push("/dashboard/briefing"); close(); } },
    { id: "nav-findings",    label: "Findings",           section: "Navigate", icon: EyeIcon,       onActivate: () => { router.push("/dashboard/findings"); close(); } },
    { id: "nav-scans",       label: "Scans",              section: "Navigate", icon: ClockIcon,     onActivate: () => { router.push("/dashboard/scans"); close(); } },
    { id: "nav-approvals",   label: "Approvals",          section: "Navigate", icon: LockClosedIcon,onActivate: () => { router.push("/dashboard/approvals"); close(); } },
    { id: "nav-rec",         label: "Recommendations",    section: "Navigate", icon: BoltIcon,      onActivate: () => { router.push("/dashboard/recommendations"); close(); } },
    { id: "nav-cost",        label: "Cost analysis",      section: "Navigate", icon: ChartBarIcon,  onActivate: () => { router.push("/dashboard/cost-analysis"); close(); } },
    { id: "nav-audit",       label: "Audit",              section: "Navigate", icon: EyeIcon,       onActivate: () => { router.push("/dashboard/audit"); close(); } },
    { id: "nav-integrations",label: "Integrations",       section: "Navigate", icon: CloudIcon,     onActivate: () => { router.push("/dashboard/integrations"); close(); } },
    { id: "nav-settings",    label: "Settings",           section: "Navigate", icon: Cog6ToothIcon, onActivate: () => { router.push("/dashboard/settings"); close(); } },
    { id: "nav-notifs",      label: "Notification settings", section: "Navigate", icon: Cog6ToothIcon, onActivate: () => { router.push("/dashboard/settings/notifications"); close(); } },
    { id: "nav-help",        label: "Help & quick reference", section: "Navigate", icon: SparklesIcon, onActivate: () => { router.push("/dashboard/help"); close(); } },
    { id: "nav-connect",     label: "Connect a cloud",    section: "Navigate", icon: CloudIcon,     onActivate: () => { router.push("/dashboard/connect-cloud"); close(); } },
    { id: "act-scan",        label: scanning ? "Scanning…" : "Trigger a scan now",  section: "Actions",  icon: SparklesIcon,  onActivate: triggerScan },
    { id: "act-diag",        label: "Open connection diagnostic (new tab)", section: "Actions", icon: EyeIcon, onActivate: () => { window.open("/api/admin/diag/connect-flow", "_blank"); close(); } },
    { id: "act-signout",     label: "Sign out",           section: "Actions",  icon: ArrowRightOnRectangleIcon, onActivate: () => { signOut({ callbackUrl: "/" }); } },
  ];

  // Filter by query.
  const filtered = ENTRIES.filter((e) =>
    e.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  // Findings deep-search — when query is 3+ chars, offer a direct nav
  // to the filtered findings page.
  const searchEntry: Entry | null = query.trim().length >= 3
    ? {
        id: "search-findings",
        label: `Search findings for "${query.trim()}"`,
        icon: MagnifyingGlassIcon,
        section: "Actions",
        onActivate: () => {
          router.push(`/dashboard/findings?q=${encodeURIComponent(query.trim())}`);
          close();
        },
      }
    : null;

  const items = searchEntry ? [searchEntry, ...filtered] : filtered;

  // Group for rendering.
  const byNav = items.filter((e) => e.section === "Navigate");
  const byAct = items.filter((e) => e.section === "Actions");
  const ordered = [...byAct, ...byNav];

  // Keyboard handling.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
          return !v;
        });
        return;
      }
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(ordered.length - 1, c + 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const target = ordered[cursor];
        if (target) void target.onActivate();
        return;
      }
      // Minimal focus trap — the dialog has exactly one tabbable element
      // (the search input) plus the command buttons; keep Tab from
      // escaping to the page behind the backdrop, same rule as
      // Navigation.tsx's mobile menu.
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    function onOpenEvent() {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    // Allow the header chip + any external surface to open the palette
    // via a CustomEvent. Keeps the imperative DOM coupling tiny — the
    // chip stays a plain <button>, no React context plumbing.
    document.addEventListener("axiom:open-palette", onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("axiom:open-palette", onOpenEvent);
    };
  }, [open, ordered, cursor, close]);

  // Auto-focus input when opened.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setCursor(0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-label="Command palette"
        className="relative w-full max-w-xl mx-4 rounded-2xl border border-white/[0.08] bg-[#0c0c0e] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
          <MagnifyingGlassIcon className="h-4 w-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="command-palette-listbox"
            aria-activedescendant={ordered[cursor] ? `command-palette-option-${ordered[cursor].id}` : undefined}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            placeholder="Jump to a surface, run an action, search findings…"
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-zinc-600 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-zinc-600 border border-white/[0.08] rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {ordered.length === 0 ? "No matches." : `${ordered.length} result${ordered.length === 1 ? "" : "s"}.`}
        </p>

        <div id="command-palette-listbox" role="listbox" aria-label="Commands" className="max-h-[60vh] overflow-y-auto py-1">
          {ordered.length === 0 ? (
            <p className="text-[12px] text-zinc-500 px-4 py-6 text-center">No matches.</p>
          ) : (
            <>
              {byAct.length > 0 && (
                <>
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-600 px-4 py-2">Actions</p>
                  <ul>
                    {byAct.map((entry) => {
                      const idx = ordered.indexOf(entry);
                      const active = idx === cursor;
                      const Icon = entry.icon;
                      return (
                        <li key={entry.id} id={`command-palette-option-${entry.id}`} role="option" aria-selected={active}>
                          <button
                            type="button"
                            onMouseEnter={() => setCursor(idx)}
                            onClick={() => void entry.onActivate()}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-left ${active ? "bg-white/[0.04]" : ""}`}
                          >
                            <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
                            <span className="text-[13px] text-zinc-200">{entry.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              {byNav.length > 0 && (
                <>
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-600 px-4 py-2">Navigate</p>
                  <ul>
                    {byNav.map((entry) => {
                      const idx = ordered.indexOf(entry);
                      const active = idx === cursor;
                      const Icon = entry.icon;
                      return (
                        <li key={entry.id} id={`command-palette-option-${entry.id}`} role="option" aria-selected={active}>
                          <button
                            type="button"
                            onMouseEnter={() => setCursor(idx)}
                            onClick={() => void entry.onActivate()}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-left ${active ? "bg-white/[0.04]" : ""}`}
                          >
                            <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
                            <span className="text-[13px] text-zinc-200">{entry.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        <div className="border-t border-white/[0.04] px-4 py-2 flex items-center gap-3 text-[10px] font-mono text-zinc-600">
          <span>
            <kbd className="border border-white/[0.08] rounded px-1 py-px">↑</kbd>{" "}
            <kbd className="border border-white/[0.08] rounded px-1 py-px">↓</kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="border border-white/[0.08] rounded px-1 py-px">↵</kbd> activate
          </span>
          <span className="ml-auto">
            <kbd className="border border-white/[0.08] rounded px-1 py-px">⌘</kbd>{" "}
            <kbd className="border border-white/[0.08] rounded px-1 py-px">K</kbd>{" "}
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}
