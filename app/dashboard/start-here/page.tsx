import Link from "next/link";

export const dynamic = "force-dynamic";

const steps = [
  {
    title: "Review your workspace",
    description: "The dashboard reads tenant-scoped records. New workspaces show empty states until you add data or configure a connector.",
    href: "/dashboard",
    label: "Open dashboard",
  },
  {
    title: "Configure a supported integration",
    description: "Connectors require workspace-specific credentials and permissions. Their setup screens show whether a connection is configured and healthy.",
    href: "/dashboard/connectors",
    label: "Review connectors",
  },
  {
    title: "Set approval controls",
    description: "Use the approval queue and change records to govern work before execution. Available records are scoped to this workspace.",
    href: "/dashboard/approvals",
    label: "Open approvals",
  },
  {
    title: "Review runbooks and audit history",
    description: "Reusable runbooks, evidence, and audit events appear when your workspace has created them; TAURI does not prefill operational history.",
    href: "/dashboard/runbooks",
    label: "Open runbooks",
  },
  {
    title: "Explore the TAURI sandbox",
    description: "The sandbox demonstrates intake, playbook generation, guided steps, and validation with clearly labeled fictional data. It does not execute production changes or persist tenant records.",
    href: "/dashboard/tauri",
    label: "Open sandbox",
  },
] as const;

export default function StartHerePage() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-2 py-4">
      <header className="space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">start here</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Set up your web workspace</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
          TAURI runs in the browser. These paths use your workspace records; the separate sandbox is explicitly simulated.
        </p>
      </header>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex gap-4">
              <span className="font-mono text-xs text-violet-300">{String(index + 1).padStart(2, "0")}</span>
              <div className="space-y-3">
                <div>
                  <h2 className="font-semibold text-white">{step.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{step.description}</p>
                </div>
                <Link href={step.href} className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100">
                  {step.label}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
