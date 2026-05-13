"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowDownTrayIcon,
  CommandLineIcon,
  LockClosedIcon,
  CpuChipIcon,
  BellAlertIcon,
  BoltIcon,
  ShieldCheckIcon,
  CloudArrowDownIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  CubeTransparentIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

type DetectedPlatform = "mac-arm" | "mac-intel" | "windows" | "linux" | "web";

interface PlatformInfo {
  id: DetectedPlatform;
  label: string;
  sublabel: string;
  href: string;
  available: boolean;
}

const PLATFORMS: Record<DetectedPlatform, PlatformInfo> = {
  "mac-arm": {
    id: "mac-arm",
    label: "Download for macOS (Apple Silicon)",
    sublabel: "macOS 13+ · M-series",
    href: "/api/desktop/download?platform=mac-arm",
    available: true,
  },
  "mac-intel": {
    id: "mac-intel",
    label: "Download for macOS (Intel)",
    sublabel: "macOS 12+ · x64",
    href: "/api/desktop/download?platform=mac-intel",
    available: true,
  },
  windows: {
    id: "windows",
    label: "Download for Windows",
    sublabel: "Windows 10/11 · x64",
    href: "/api/desktop/download?platform=windows",
    available: false,
  },
  linux: {
    id: "linux",
    label: "Download for Linux",
    sublabel: "AppImage · deb · rpm",
    href: "/api/desktop/download?platform=linux",
    available: false,
  },
  web: {
    id: "web",
    label: "Open Web Application",
    sublabel: "No install required",
    href: "/dashboard",
    available: true,
  },
};

export default function DownloadPage() {
  const [primary, setPrimary] = useState<DetectedPlatform>("mac-arm");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) {
      setPrimary("mac-arm");
    } else if (ua.includes("win")) {
      setPrimary("windows");
    } else if (ua.includes("linux")) {
      setPrimary("linux");
    } else {
      setPrimary("web");
    }
  }, []);

  const primaryPlatform = PLATFORMS[primary];

  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      {/* Cinematic background layers */}
      <div className="absolute inset-0 bg-grid-mesh opacity-30 pointer-events-none" aria-hidden />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] spotlight-orb opacity-60 pointer-events-none" aria-hidden />
      <div className="absolute top-[20%] -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/[0.05] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute top-[40%] -left-40 w-[500px] h-[500px] rounded-full bg-blue-600/[0.04] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-amber-500/[0.05] blur-[120px] pointer-events-none" aria-hidden />

      <Navigation />

      {/* Hero ───────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="hero-beam-vertical pointer-events-none" aria-hidden />
        <div className="hero-beam-flare pointer-events-none" aria-hidden />
        <div className="hero-beam-converge pointer-events-none" aria-hidden />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Floating app icon with glow */}
          <Reveal direction="up" blur>
            <div className="relative inline-flex items-center justify-center mb-10">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/30 via-blue-500/20 to-fuchsia-500/30 blur-[40px] scale-150 animate-pulse" aria-hidden />
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-600/40 to-fuchsia-600/40 blur-[20px] scale-110" aria-hidden />
              <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-[#1e1e24] via-[#1a1a20] to-[#0f0f12] border border-white/[0.08] flex items-center justify-center shadow-2xl shadow-violet-900/40">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.04] via-transparent to-transparent" aria-hidden />
                <Image
                  src="/vision-xix-logo.png"
                  alt="Axiom Agent"
                  width={64}
                  height={64}
                  className="rounded-xl drop-shadow-2xl relative z-10"
                  priority
                />
              </div>
            </div>
          </Reveal>

          {/* Build badge */}
          <Reveal direction="up" delay={0.05}>
            <span className="badge-shimmer badge-shimmer-border inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-xs font-medium mb-8 backdrop-blur-sm cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Preview Build · 0.9.2 · Code-signed
            </span>
          </Reveal>

          {/* Headline */}
          <Reveal direction="up" blur delay={0.08}>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.05] tracking-[-0.04em]">
              Autonomous cloud operations.<br />
              <span className="text-gradient">Anywhere.</span>
            </h1>
          </Reveal>

          {/* Subhead with progressive dimming */}
          <Reveal direction="up" delay={0.12}>
            <p className="text-dim-paragraph text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              Run Axiom Agent on macOS, Windows, Linux, <span className="dim-1">or directly in the browser.</span> <span className="dim-2">Operate your cloud from any workstation.</span>
            </p>
          </Reveal>

          {/* Primary CTA */}
          <Reveal direction="up" delay={0.16}>
            <div className="flex flex-col items-center gap-3 mb-10">
              {primaryPlatform.available ? (
                <a
                  href={primaryPlatform.href}
                  className="btn-amber-shimmer group inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold tracking-wide uppercase relative"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  {mounted ? primaryPlatform.label : "Download Axiom Agent"}
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <a
                    href={PLATFORMS["mac-arm"].href}
                    className="btn-amber-shimmer group inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold tracking-wide uppercase relative"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Download for macOS (Apple Silicon)
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </a>
                  <span className="text-xs text-zinc-500">
                    {primaryPlatform.label.replace("Download for ", "")} preview rolling out — currently macOS only.
                  </span>
                </div>
              )}
              <span className="text-xs text-zinc-500 font-mono">
                {mounted ? primaryPlatform.sublabel : "macOS · Windows · Linux · Web"} · 18.4 MB · SHA256 verified
              </span>
            </div>
          </Reveal>

          {/* Secondary platform links */}
          <Reveal direction="up" delay={0.2}>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
              {(["mac-arm", "mac-intel", "windows", "linux", "web"] as DetectedPlatform[])
                .filter((id) => id !== primary)
                .map((id, i, arr) => {
                  const p = PLATFORMS[id];
                  const label = p.label.replace("Download for ", "").replace("Open ", "");
                  return (
                    <span key={id} className="flex items-center gap-6">
                      {p.available ? (
                        <a href={p.href} className="text-zinc-400 hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white/60 transition-colors">
                          {label}
                        </a>
                      ) : (
                        <span className="text-zinc-600 inline-flex items-center gap-1.5">
                          {label}
                          <span className="text-[10px] text-amber-400/70 font-semibold uppercase tracking-wider">Soon</span>
                        </span>
                      )}
                      {i < arr.length - 1 && <span className="text-zinc-700">|</span>}
                    </span>
                  );
                })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* What you get on desktop ────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-16">
              <p className="text-sm font-semibold text-violet-400 mb-4 tracking-wide uppercase">
                Desktop Capabilities
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-5">
                A command center{" "}
                <span className="text-zinc-500">that lives on your machine.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-2xl leading-relaxed">
                The desktop application unlocks local execution, secure workstation mode, and continuous background monitoring <span className="dim-1">— without sending your infrastructure data through a browser.</span>
              </p>
            </div>
          </Reveal>

          <Stagger delay={0.1} interval={0.08} className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: CommandLineIcon,
                title: "Local Terraform Execution.",
                desc: "Run Terraform plans and applies locally with full visibility. Generated IaC executes in your environment with native AWS/Azure/GCP CLI authentication.",
                visual: (
                  <div className="mt-5 rounded-lg bg-black/40 border border-white/[0.04] p-3 font-mono text-[10px] text-zinc-500 leading-relaxed">
                    <span className="text-zinc-600">$</span> <span className="text-white">axiom plan apply</span> <span className="text-violet-400">--phase 1</span><br />
                    <span className="text-emerald-400">✓</span> 14 changes verified · 0 destroy<br />
                    <span className="text-amber-400">⏵</span> Pre-rollback snapshot captured<br />
                    <span className="text-emerald-400">✓</span> Applied in 47s · $4.2k/mo saved
                  </div>
                ),
              },
              {
                icon: LockClosedIcon,
                title: "Secure Workstation Mode.",
                desc: "Your AWS credentials never leave your machine. Axiom uses local IAM role assumption, AWS SSO profiles, and encrypted credential storage in the OS keychain.",
                visual: (
                  <div className="mt-5 space-y-2">
                    {[
                      { label: "Credentials", status: "OS Keychain", color: "text-emerald-400" },
                      { label: "Telemetry", status: "Disabled by default", color: "text-emerald-400" },
                      { label: "Network", status: "Direct to AWS", color: "text-emerald-400" },
                      { label: "Code signing", status: "Apple notarized", color: "text-emerald-400" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">{row.label}</span>
                        <span className={`${row.color} font-medium`}>{row.status}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                icon: CpuChipIcon,
                title: "Background Operational Agent.",
                desc: "Continuous scanning runs in the background — surfaces drift, cost regressions, and new findings the moment they appear. Native menu-bar status indicator.",
                visual: (
                  <div className="mt-5 flex items-center justify-between rounded-lg bg-black/40 border border-white/[0.04] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] text-zinc-400 font-medium">Axiom · Watching prod</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">Last scan · 2m ago</span>
                  </div>
                ),
              },
              {
                icon: BellAlertIcon,
                title: "Native Notifications.",
                desc: "Native macOS, Windows, and Linux notifications for scan completions, approval requests, drift alerts, and execution outcomes. No browser tabs needed.",
                visual: (
                  <div className="mt-5 rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-3 backdrop-blur-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <BoltIcon className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-white mb-0.5">Axiom Agent</p>
                        <p className="text-[10px] text-zinc-400 leading-snug">3 critical findings detected on prod-us-east-1 · Review now</p>
                      </div>
                    </div>
                  </div>
                ),
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="huly-feature-card group">
                  <div className="p-7">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5 group-hover:bg-white/[0.06] transition-colors">
                      <Icon className="h-5 w-5 text-zinc-400 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{feature.desc}</p>
                    {feature.visual}
                  </div>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* Built for enterprise ─────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12">
              <p className="text-sm font-semibold text-emerald-400 mb-4 tracking-wide uppercase">
                Built for enterprise
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-5">
                Zero telemetry.{" "}
                <span className="text-zinc-500">Zero compromise.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-2xl leading-relaxed">
                The Axiom desktop agent is designed for security-first organizations. <span className="dim-1">Code-signed, notarized, and built with a minimal native footprint.</span>
              </p>
            </div>
          </Reveal>

          <Stagger delay={0.1} interval={0.06} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ShieldCheckIcon, label: "Apple notarized · code-signed binaries" },
              { icon: LockClosedIcon, label: "Credentials in OS keychain, never in the app" },
              { icon: CubeTransparentIcon, label: "Open source local executor · auditable" },
              { icon: DocumentCheckIcon, label: "Full local audit log · exportable to SIEM" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                    <Icon className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{item.label}</p>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* Platform roadmap ─────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12">
              <p className="text-sm font-semibold text-amber-400 mb-4 tracking-wide uppercase">
                Platform Roadmap
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-5">
                Every platform.{" "}
                <span className="text-zinc-500">Every workstation.</span>
              </h2>
            </div>
          </Reveal>

          <Stagger delay={0.1} interval={0.06} className="space-y-3">
            {[
              {
                platform: "macOS",
                status: "Available",
                statusColor: "text-emerald-400",
                statusBg: "bg-emerald-500/10 border-emerald-500/20",
                detail: "Universal binary · Apple Silicon and Intel · macOS 12+",
                dot: "bg-emerald-400",
              },
              {
                platform: "Web Application",
                status: "Available",
                statusColor: "text-emerald-400",
                statusBg: "bg-emerald-500/10 border-emerald-500/20",
                detail: "Full operational dashboard · Approval workflows · Live scans",
                dot: "bg-emerald-400",
              },
              {
                platform: "Windows",
                status: "Q2 2026",
                statusColor: "text-amber-400",
                statusBg: "bg-amber-500/10 border-amber-500/20",
                detail: "Windows 10/11 · x64 and ARM64 · MSIX installer · code-signed",
                dot: "bg-amber-400",
              },
              {
                platform: "Linux",
                status: "Q3 2026",
                statusColor: "text-amber-400",
                statusBg: "bg-amber-500/10 border-amber-500/20",
                detail: "AppImage · .deb · .rpm · Snap · Flatpak",
                dot: "bg-amber-400",
              },
              {
                platform: "CLI Binary",
                status: "Available",
                statusColor: "text-emerald-400",
                statusBg: "bg-emerald-500/10 border-emerald-500/20",
                detail: "axiom-cli · cross-platform · CI/CD pipeline-ready · npm + brew + scoop",
                dot: "bg-emerald-400",
              },
            ].map((row) => (
              <div
                key={row.platform}
                className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className={`w-2 h-2 rounded-full ${row.dot} ${row.status !== "Available" ? "animate-pulse" : ""}`} />
                  <div>
                    <p className="text-base font-semibold text-white">{row.platform}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{row.detail}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold uppercase tracking-wider ${row.statusColor} ${row.statusBg} border rounded-full px-3 py-1`}>
                  {row.status}
                </span>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Final CTA ────────────────────────────────────────────────── */}
      <section className="py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-20 pointer-events-none" aria-hidden />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-amber-500/[0.06] blur-[120px] pointer-events-none" aria-hidden />

        <div className="max-w-3xl mx-auto text-center relative">
          <Reveal direction="up" blur>
            <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-[-0.04em]">
              Your cloud, in your terminal.<br />
              <span className="text-gradient">Today.</span>
            </h2>
            <p className="text-dim-paragraph text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Install in under 30 seconds. <span className="dim-1">No account required for read-only mode.</span> <span className="dim-2">Free tier includes 1 cloud account.</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href={PLATFORMS["mac-arm"].href}
                className="btn-amber-shimmer group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-semibold uppercase tracking-wide"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download Axiom Agent
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/[0.12] text-zinc-300 rounded-full text-sm font-semibold hover:bg-white/5 hover:border-white/20 transition-colors"
              >
                <GlobeAltIcon className="h-4 w-4" />
                Open Web App
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
              {["Free forever tier", "Read-only by default", "No credit card"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
