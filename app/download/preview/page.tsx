import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CommandLineIcon,
  EnvelopeIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Desktop preview · Early access — Axiom Agent",
  description: "Axiom desktop preview build status by platform. macOS preview now · Windows Q2 2026 · Linux Q3 2026.",
};

type Platform = "mac-arm" | "mac-intel" | "windows" | "linux";

const PLATFORM_INFO: Record<Platform, {
  label: string;
  sublabel: string;
  status: "macos_preview" | "windows_planned" | "linux_planned";
  eta: string;
  whatYouGet: string[];
  what_until_then: string[];
}> = {
  "mac-arm": {
    label: "macOS · Apple Silicon",
    sublabel: "Universal binary · macOS 13+ · M-series",
    status: "macos_preview",
    eta: "Preview available · join early-access program",
    whatYouGet: [
      "Local Terraform execution via your own AWS CLI",
      "OS Keychain credential storage — never on Axiom servers",
      "Native macOS menu-bar agent with background scanning",
      "Workstation mode option — no outbound network at all",
      "Apple-notarized + code-signed installer",
    ],
    what_until_then: [
      "Use the web platform at any time — full operational feature set",
      "CLI binary available now via brew install axiom-cli",
      "Sign up for early-access invitation; we ship in waves",
    ],
  },
  "mac-intel": {
    label: "macOS · Intel",
    sublabel: "x64 · macOS 12+",
    status: "macos_preview",
    eta: "Preview available · join early-access program",
    whatYouGet: [
      "Same feature set as Apple Silicon build",
      "Universal binary detects architecture automatically",
      "Local Terraform + OS Keychain + native notifications",
    ],
    what_until_then: [
      "Use the web platform at any time",
      "CLI binary available now via brew install axiom-cli",
    ],
  },
  windows: {
    label: "Windows",
    sublabel: "Windows 10/11 · x64 + ARM64",
    status: "windows_planned",
    eta: "Q2 2026 · MSIX installer · Microsoft Store + Winget + Enterprise MSI",
    whatYouGet: [
      "Native Windows installer with Active Directory authentication path",
      "Local Terraform / aws.exe / az.exe / kubectl integration",
      "Windows Credential Manager integration (Axiom session token only)",
      "Native system tray + toast notifications",
      "Group Policy controls for IT-managed deployment",
    ],
    what_until_then: [
      "Use the web platform — fully functional in Edge / Chrome / Firefox",
      "CLI binary available now via scoop install axiom-cli",
      "Join the early-access waitlist for Q2 2026 invitation",
    ],
  },
  linux: {
    label: "Linux",
    sublabel: "AppImage · .deb · .rpm · Snap · Flatpak",
    status: "linux_planned",
    eta: "Q3 2026 · Ansible role + Debian/RPM packages",
    whatYouGet: [
      "Distribution-agnostic AppImage + native .deb / .rpm",
      "systemd service unit for daemon-mode background scanning",
      "Linux libsecret integration for credential storage",
      "Ansible role for IT-managed enterprise deployment",
      "Air-gapped workstation-mode build with bundled local reasoning model",
    ],
    what_until_then: [
      "Use the web platform from any browser",
      "CLI binary available now via npm install -g @axiomops/cli",
      "Join the early-access waitlist for Q3 2026 invitation",
    ],
  },
};

const STATUS_COPY: Record<typeof PLATFORM_INFO[keyof typeof PLATFORM_INFO]["status"], { headline: string; pillLabel: string; pillClass: string }> = {
  macos_preview: { headline: "macOS preview build — early access", pillLabel: "Preview", pillClass: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
  windows_planned: { headline: "Windows build ships Q2 2026", pillLabel: "Q2 2026", pillClass: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
  linux_planned: { headline: "Linux build ships Q3 2026", pillLabel: "Q3 2026", pillClass: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
};

export default async function PreviewPage(props: { searchParams: Promise<{ platform?: string }> }) {
  const sp = await props.searchParams;
  const raw = sp.platform ?? "mac-arm";
  const platform: Platform = (["mac-arm", "mac-intel", "windows", "linux"] as Platform[]).includes(raw as Platform) ? (raw as Platform) : "mac-arm";
  const info = PLATFORM_INFO[platform];
  const status = STATUS_COPY[info.status];

  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-mesh opacity-30 pointer-events-none" aria-hidden />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] spotlight-orb opacity-50 pointer-events-none" aria-hidden />
      <div className="absolute top-[30%] -right-40 w-[400px] h-[400px] rounded-full bg-violet-600/[0.05] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-amber-500/[0.04] blur-[120px] pointer-events-none" aria-hidden />

      <Navigation />

      <main className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <Link href="/download" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-8">
            <ArrowLeftIcon className="h-3 w-3" />
            Back to download
          </Link>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 ${status.pillClass}`}>
                {status.pillLabel}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">{info.label}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.04em] mb-3">
              {status.headline}
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed">
              {info.sublabel} · {info.eta}
            </p>
          </div>

          {/* Honest state callout */}
          <div className="mb-10 rounded-2xl border border-blue-500/15 bg-blue-500/[0.03] p-5">
            <div className="flex items-start gap-3">
              <CpuChipIcon className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-white mb-1">Honest state</p>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  This build is in <strong>{info.status === "macos_preview" ? "preview" : "active development"}</strong>. The button you clicked doesn&apos;t ship a binary today — but the web platform is fully operational and the CLI is shipping now.
                </p>
              </div>
            </div>
          </div>

          {/* Two-column: what you get + what until then */}
          <div className="grid md:grid-cols-2 gap-4 mb-10">
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">What you get when it ships</p>
              <ul className="space-y-2">
                {info.whatYouGet.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-zinc-300 leading-snug">
                    <CheckCircleIcon className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">What you can use today</p>
              <ul className="space-y-2">
                {info.what_until_then.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-zinc-300 leading-snug">
                    <ArrowRightIcon className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-1" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Early access form */}
          <div id="waitlist" className="mb-10 rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.03] p-6 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-500/[0.08] blur-[60px] pointer-events-none" aria-hidden />
            <div className="relative">
              <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2">Early-access invitation</p>
              <h2 className="text-xl font-bold text-white mb-2">Want the build the moment it ships?</h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-5">
                Drop your work email — we ship the {info.label} build in waves to early-access teams. No spam, no upsell.
              </p>
              <form action="/contact" method="get" className="flex flex-wrap gap-2 items-stretch">
                <input
                  type="hidden"
                  name="topic"
                  value={`desktop-early-access-${platform}`}
                />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@company.com"
                  className="flex-1 min-w-0 rounded-full bg-white/[0.04] border border-white/[0.1] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
                />
                <button
                  type="submit"
                  className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold uppercase tracking-wider"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  Request invite
                </button>
              </form>
              <p className="text-[10px] text-zinc-500 mt-3">
                We use this address only for the early-access invitation. Read the <Link href="/privacy" className="text-violet-400 hover:text-violet-300">privacy policy</Link>.
              </p>
            </div>
          </div>

          {/* Self-serve alternatives */}
          <div className="mb-10">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Use Axiom now — without waiting</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link href="/dashboard" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/20 transition-all group">
                <GlobeAltIcon className="h-5 w-5 text-violet-400 mb-2" />
                <p className="text-sm font-bold text-white mb-1">Open web platform</p>
                <p className="text-xs text-zinc-500 leading-snug">Full operational feature set in any browser. No install required.</p>
              </Link>
              <Link href="/docs/desktop-install#cli" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/20 transition-all">
                <CommandLineIcon className="h-5 w-5 text-violet-400 mb-2" />
                <p className="text-sm font-bold text-white mb-1">Install the CLI</p>
                <p className="text-xs text-zinc-500 leading-snug font-mono">brew install axiom-cli</p>
              </Link>
              <Link href="/docs/security-model" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/20 transition-all">
                <ShieldCheckIcon className="h-5 w-5 text-emerald-400 mb-2" />
                <p className="text-sm font-bold text-white mb-1">Review security model</p>
                <p className="text-xs text-zinc-500 leading-snug">Understand exactly what the desktop will do before installing.</p>
              </Link>
            </div>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-zinc-500 border-t border-white/[0.06] pt-6">
            {[
              { icon: ShieldCheckIcon, label: "Code-signed + Apple-notarized" },
              { icon: LockClosedIcon, label: "OS keychain credentials" },
              { icon: CheckCircleIcon, label: "Workstation mode available" },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <span key={t.label} className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-emerald-500" />
                  {t.label}
                </span>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
