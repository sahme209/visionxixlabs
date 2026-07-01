/**
 * /dashboard/flags — Phase 672.
 *
 * Feature-flag console. Groups the catalog by group (autonomy /
 * notifications / audit / ui) and shows per-flag current state,
 * override presence, catalog default, audit fields (updatedBy +
 * updatedAt + rationale).
 *
 * Write actions POST to /api/flags (already live, Phase 651-era).
 * DELETE via a separate form so operators can clear an override.
 *
 * Ships the missing page called out by Phase 670's fs guard.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, FlagIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { readFeatureFlags } from "@/lib/flags/featureFlagStore";

export const dynamic = "force-dynamic";

const GROUP_LABEL: Record<"autonomy" | "notifications" | "audit" | "ui", string> = {
  autonomy: "Autonomy",
  notifications: "Notifications",
  audit: "Audit",
  ui: "Interface",
};

export default async function FlagsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/flags");
  }
  const records = await readFeatureFlags({ organizationId: String(ctx.organizationId) });
  const grouped = new Map<string, typeof records>();
  for (const r of records) {
    const arr = grouped.get(r.spec.group) ?? [];
    arr.push(r);
    grouped.set(r.spec.group, arr);
  }
  const overrideCount = records.filter((r) => r.hasOverride).length;

  return (
    <div className="max-w-4xl mx-auto px-1 -mt-2">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Dashboard
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">feature-flags</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">{records.length} flags · {overrideCount} overridden</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <FlagIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Feature flags
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-2xl">
          Per-tenant overrides on top of the catalog defaults. Changes audit-log with rationale.
        </p>
      </header>

      {Array.from(grouped.entries()).map(([group, flags]) => (
        <section key={group} className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-3 inline-flex items-center gap-2">
            <span className="text-zinc-700">//</span>
            <span>{group}</span>
            <span className="text-zinc-700">::</span>
            <span className="text-zinc-400 tabular-nums">{flags.length}</span>
          </p>
          <h2 className="text-[18px] font-semibold text-white tracking-[-0.01em] mb-4">{GROUP_LABEL[group as keyof typeof GROUP_LABEL] ?? group}</h2>
          <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
            {flags.map((f) => (
              <li key={f.key} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1 text-[10px] font-mono uppercase tracking-wider">
                      <span className={f.enabled ? "text-emerald-300" : "text-zinc-500"}>{f.enabled ? "enabled" : "disabled"}</span>
                      {f.hasOverride && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="text-amber-300">override</span>
                        </>
                      )}
                      <span className="text-zinc-700">·</span>
                      <span className="text-zinc-500">default {f.spec.default ? "on" : "off"}</span>
                    </div>
                    <p className="text-[14px] font-medium text-white mb-1">{f.spec.label}</p>
                    <p className="text-[12.5px] text-zinc-400 leading-relaxed mb-2">{f.spec.description}</p>
                    <p className="text-[10.5px] font-mono text-zinc-500">{f.key}</p>
                    {f.rationale && (
                      <p className="text-[11.5px] text-zinc-500 mt-1 font-mono">rationale :: {f.rationale}</p>
                    )}
                    {f.updatedBy && (
                      <p className="text-[10.5px] font-mono text-zinc-600 mt-0.5">updated by {f.updatedBy}{f.updatedAt && ` · ${f.updatedAt.slice(0, 19).replace("T", " ")}`}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="mt-10 pt-6 border-t border-white/[0.06]">
        <p className="text-[11.5px] text-zinc-500 leading-relaxed font-mono">
          write via POST /api/flags · clear override via DELETE /api/flags — this page is read-only until an inline toggle form is added.
        </p>
      </footer>
    </div>
  );
}
