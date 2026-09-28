import Link from "next/link";
import {
  ArrowRightIcon,
  FingerPrintIcon,
  KeyIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

const CONTROLS = [
  {
    icon: KeyIcon,
    title: "Authentication and credentials",
    body: "The desktop flow uses a browser approval handoff and a scoped application session. Source uses the operating-system credential vault for session persistence; the exact packaged keychain journey remains unverified. Provider credentials remain connector-specific, and no privileged shared secret belongs in a distributed installer.",
    status: "Implemented with documented gap",
  },
  {
    icon: UserGroupIcon,
    title: "Permissions and approval separation",
    body: "The domain model separates review, approval, merge, workflow dispatch, environment approval, and change management. UI visibility alone is not treated as authorization; each consequential service path still requires server-side enforcement and release verification.",
    status: "Implemented in product model · verification ongoing",
  },
  {
    icon: LockClosedIcon,
    title: "Secret handling",
    body: "Contact and operational text passes through secret-redaction utilities before durable storage or notification. Live connector credential custody, revocation, and recovery are verified provider by provider—not inferred from a generic security claim.",
    status: "Application controls implemented",
  },
  {
    icon: FingerPrintIcon,
    title: "Audit attribution and evidence",
    body: "Audit and evidence models record actors, actions, timestamps, rationale, and outcomes where the selected workflow is wired. Export availability and retention vary by workflow and are not evidence of an external certification.",
    status: "Implemented in supported workflows",
  },
] as const;

const LIMITATIONS = [
  "Current desktop-v0.1.7 installers are developer builds; the release manifest does not attest code signing or macOS notarization.",
  "AWS live validation requires broker configuration and customer IAM setup. Current inventory and security analysis are preview-grade.",
  "Azure and GCP live SDK validation and provider-specific execution are not released.",
  "Local Terraform apply is disabled; generated artifacts remain review-only.",
  "No independent SOC 2, ISO 27001, HIPAA, or other certification is claimed on this site.",
  "Backup/restore, retention, tenant isolation, and permission paths require deployment-specific verification before production use.",
] as const;

export default function SecurityPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#09090b] text-white">
      <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute -top-40 right-0 h-[480px] w-[480px] rounded-full bg-brand-violet/[0.08] blur-[130px] pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute top-1/4 left-1/4 h-[340px] w-[420px] rounded-full bg-brand-coral/[0.06] blur-[120px] pointer-events-none" aria-hidden />
      <Navigation />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 md:px-10 md:pt-36">
        <header className="max-w-3xl">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 inline-flex items-center gap-3">
            <span className="text-brand-coral/90">Security</span>
            <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
            Product controls and current limits
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] md:text-6xl">
            Inspect the control. <span className="text-zinc-500">Then verify the path.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-zinc-400 md:text-lg">
            Security claims below describe controls visible in the current code and release process. They do not represent an independent certification, a guarantee about every deployment, or a substitute for customer configuration and review.
          </p>
        </header>

        <section className="mt-12 grid gap-4 md:grid-cols-2" aria-label="Implemented security controls">
          {CONTROLS.map((control) => {
            const Icon = control.icon;
            return (
              <article key={control.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07]">
                  <Icon className="h-5 w-5 text-emerald-300" />
                </div>
                <h2 className="mt-5 text-lg font-semibold">{control.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{control.body}</p>
                <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.16em] text-amber-200">{control.status}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-12 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6 md:p-8">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-amber-300" />
            <h2 className="text-xl font-semibold">Current limitations</h2>
          </div>
          <ul className="mt-5 grid gap-3 text-sm leading-relaxed text-zinc-300 md:grid-cols-2">
            {LIMITATIONS.map((item) => <li key={item} className="flex gap-2"><span className="text-amber-300">—</span><span>{item}</span></li>)}
          </ul>
        </section>

        <section className="mt-12 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <div>
            <h2 className="text-xl font-semibold">Need a control explained?</h2>
            <p className="mt-2 text-sm text-zinc-400">Use the verified support address or review the detailed security documentation.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/docs/security-model" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.05]">Security model</Link>
            <a href="mailto:support@visionxixlabs.com" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950">Contact support <ArrowRightIcon className="h-4 w-4" /></a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
