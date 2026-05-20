"use client";

/**
 * /dashboard/compliance-packet — download a deterministic evidence bundle.
 *
 * Operators pick a window, optionally tag it with a note, and download
 * a hash-stamped JSON document for auditors. Axiom never applies
 * changes; the packet evidences what was decided.
 */

import { useState } from "react";
import { ArrowDownTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

const WINDOW_OPTIONS = [
  { hours: 24,  label: "Last 24h" },
  { hours: 168, label: "Last 7 days" },
  { hours: 720, label: "Last 30 days" },
];

export default function CompliancePacketPage() {
  const [windowHours, setWindowHours] = useState(168);
  const [note, setNote] = useState("");

  const href = `/api/compliance/evidence-packet?windowHours=${windowHours}${
    note.trim() ? `&note=${encodeURIComponent(note.trim())}` : ""
  }`;

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <DocumentTextIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              Compliance packet · approval_only_no_execution
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          One file. <span className="text-gradient">Auditor-ready.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Bundles your tenant&apos;s bus messages, method proposals, and platform status into a hash-stamped
          JSON document. Same inputs always yield the same hash — auditors verify the packet by rebuilding it.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 max-w-2xl">
        <div className="mb-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Window</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {WINDOW_OPTIONS.map((o) => (
              <button
                key={o.hours}
                onClick={() => setWindowHours(o.hours)}
                className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition ${
                  windowHours === o.hours
                    ? "bg-indigo-500/15 text-indigo-200 border-indigo-500/30"
                    : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Auditor note (optional)</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder='e.g. "SOC2 Q2 control AC-2 evidence"'
            className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] font-mono text-zinc-200 focus:border-indigo-400/60 focus:outline-none"
          />
        </div>

        <a
          href={href}
          className="inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/20"
        >
          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
          Download evidence packet
        </a>

        <p className="mt-4 text-[11px] text-zinc-500 leading-relaxed">
          The packet contains the canonical bus history, every proposal in the window, the public status
          snapshot, and a sha256 integrity hash over the sorted-key JSON body. Approval-only-no-execution.
        </p>
      </div>
    </div>
  );
}
