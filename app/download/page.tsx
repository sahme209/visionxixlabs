"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
import { useDesktopRuntime } from "@/lib/desktop/useDesktopRuntime";

type DetectedPlatform = "mac-arm" | "mac-intel" | "windows" | "linux";

interface PlatformInfo {
  id: DetectedPlatform;
  label: string;
  sublabel: string;
  href: string;
  available: boolean;
  /** Set when a real signed/unsigned download exists in the GitHub release. */
  fileName?: string;
  /** Honest one-line friction note (rendered when available === true). */
  installFriction?: string;
  digest?: string | null;
  signatureUrl?: string | null;
  sizeBytes?: number;
}

interface ManifestAsset {
  platform: "macos-arm" | "macos-intel" | "windows-x64" | "linux-x64";
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
  digest: string | null;
  signatureUrl: string | null;
  signed: boolean;
  notarized: boolean;
  installFriction: string;
}

interface ReleaseManifest {
  source: "github_release" | "none";
  tag?: string;
  publishedAt?: string;
  htmlUrl?: string;
  assets: Record<"macos-arm" | "macos-intel" | "windows-x64" | "linux-x64", ManifestAsset | null>;
  hasAnyAsset: boolean;
  allSignedAndNotarized: boolean;
  note?: string;
}

const PLATFORM_TO_MANIFEST: Record<DetectedPlatform, keyof ReleaseManifest["assets"]> = {
  "mac-arm":   "macos-arm",
  "mac-intel": "macos-intel",
  windows:     "windows-x64",
  linux:       "linux-x64",
};

// Honest platform availability — desktop binaries are in active development
// but distribution requires signing/notarization (planned for 1.0). Every
// desktop button routes to /download/preview, which explains the state and
// captures interest. Live operations are desktop-only; the website provides
// an isolated, synthetic demo instead of a browser control plane.
const PLATFORMS: Record<DetectedPlatform, PlatformInfo> = {
  "mac-arm": {
    id: "mac-arm",
    label: "macOS · Apple Silicon",
    sublabel: "Resolve the current release manifest",
    href: "/api/desktop/download?platform=mac-arm",
    available: false,
  },
  "mac-intel": {
    id: "mac-intel",
    label: "macOS · Intel",
    sublabel: "Resolve the current release manifest",
    href: "/api/desktop/download?platform=mac-intel",
    available: false,
  },
  windows: {
    id: "windows",
    label: "Windows",
    sublabel: "Resolve the current release manifest",
    href: "/api/desktop/download?platform=windows",
    available: false,
  },
  linux: {
    id: "linux",
    label: "Linux",
    sublabel: "Resolve the current release manifest",
    href: "/api/desktop/download?platform=linux",
    available: false,
  },
};

const subscribeToClientEnvironment = () => () => {};

function detectPlatform(): DetectedPlatform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "mac-arm";
}

export default function DownloadPage() {
  const primary = useSyncExternalStore<DetectedPlatform>(
    subscribeToClientEnvironment,
    detectPlatform,
    () => "mac-arm",
  );
  const mounted = useSyncExternalStore(subscribeToClientEnvironment, () => true, () => false);
  const [manifest, setManifest] = useState<ReleaseManifest | null>(null);
  const { isDesktop, status: desktopStatus } = useDesktopRuntime();

  // Fetch the live release manifest so download buttons resolve to real
  // GitHub-hosted binaries when a release exists. Falls back to preview
  // routes when no release / network failure.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/desktop/release-manifest")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (body && body.ok && body.data) setManifest(body.data as ReleaseManifest);
      })
      .catch(() => { /* preview state stays */ });
    return () => { cancelled = true; };
  }, []);

  // Compose the per-platform info — live download when manifest has an
  // asset, preview route otherwise.
  const platformsLive: Record<DetectedPlatform, PlatformInfo> = {
    ...PLATFORMS,
    ...Object.fromEntries(
      (["mac-arm", "mac-intel", "windows", "linux"] as const).map((id) => {
        const base = PLATFORMS[id];
        const key = PLATFORM_TO_MANIFEST[id];
        const asset = manifest?.assets[key] ?? null;
        if (!asset) return [id, base];
        return [id, {
          ...base,
          href: asset.downloadUrl,
          sublabel: asset.signed && asset.notarized ? "Signed + notarized" : asset.signed ? "Signed · not notarized" : "Developer build · unsigned",
          available: true,
          fileName: asset.fileName,
          installFriction: asset.installFriction,
          digest: asset.digest,
          signatureUrl: asset.signatureUrl,
          sizeBytes: asset.sizeBytes,
        }] as const;
      }),
    ),
  } as Record<DetectedPlatform, PlatformInfo>;

  const primaryPlatform = platformsLive[primary];

  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      {/* Cinematic background layers */}
      <div className="absolute inset-0 bg-grid-mesh opacity-30 pointer-events-none" aria-hidden />
      <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] spotlight-orb opacity-60 pointer-events-none" aria-hidden />
      <div className="hidden md:block ambient-drift absolute top-[20%] -right-40 w-[500px] h-[500px] rounded-full bg-brand-violet/[0.07] blur-[140px] pointer-events-none" aria-hidden />
      <div className="hidden md:block ambient-drift absolute top-[40%] -left-40 w-[480px] h-[460px] rounded-full bg-brand-coral/[0.06] blur-[140px] pointer-events-none" style={{ animationDelay: "-8s" }} aria-hidden />
      <div className="hidden md:block ambient-drift absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-cyan-500/[0.05] blur-[120px] pointer-events-none" style={{ animationDelay: "-14s" }} aria-hidden />

      <Navigation />

      {/* Hero ───────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-12 px-4 sm:px-6 sm:pt-32 sm:pb-20 lg:px-8 overflow-hidden">
        <div className="hidden md:block hero-beam-vertical pointer-events-none" aria-hidden />
        <div className="hidden md:block hero-beam-flare pointer-events-none" aria-hidden />
        <div className="hidden md:block hero-beam-converge pointer-events-none" aria-hidden />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Floating app icon with glow */}
          <Reveal direction="up" blur>
            <div className="relative inline-flex items-center justify-center mb-6 sm:mb-10">
              <div className="hidden sm:block absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/30 via-blue-500/20 to-fuchsia-500/30 blur-[40px] scale-150 animate-pulse" aria-hidden />
              <div className="hidden sm:block absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-600/40 to-fuchsia-600/40 blur-[20px] scale-110" aria-hidden />
              <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#1e1e24] via-[#1a1a20] to-[#0f0f12] border border-white/[0.08] flex items-center justify-center shadow-2xl shadow-violet-900/40">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.04] via-transparent to-transparent" aria-hidden />
                <Image
                  src="/vision-xix-logo.png"
                  alt="Axiom Agent"
                  width={52}
                  height={52}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl drop-shadow-2xl relative z-10"
                  priority
                />
              </div>
            </div>
          </Reveal>

          {/* Build badge — derived from the live release manifest. */}
          <Reveal direction="up" delay={0.05}>
            {isDesktop && desktopStatus.available ? (
              <span className="badge-shimmer badge-shimmer-border inline-flex max-w-full items-center justify-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] sm:text-xs leading-5 font-medium mb-5 sm:mb-8 backdrop-blur-sm cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Desktop runtime detected {desktopStatus.version ? `· v${desktopStatus.version}` : ""}
                {desktopStatus.platform ? ` · ${desktopStatus.platform}` : ""}
              </span>
            ) : manifest?.hasAnyAsset ? (
              <span className="badge-shimmer badge-shimmer-border inline-flex max-w-full items-center justify-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] sm:text-xs leading-5 font-medium mb-5 sm:mb-8 backdrop-blur-sm cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Released {manifest.tag ? `· ${manifest.tag.replace("desktop-v", "v")}` : ""}
              </span>
            ) : (
              <span className="badge-shimmer badge-shimmer-border inline-flex max-w-full items-center justify-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] sm:text-xs leading-5 font-medium mb-5 sm:mb-8 backdrop-blur-sm cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                No verified installer is currently available
              </span>
            )}
          </Reveal>

          {/* Headline */}
          <Reveal direction="up" blur delay={0.08}>
            <h1 className="text-[2.35rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-5 sm:mb-6 leading-[1.02] tracking-[-0.045em]">
              Govern every deployment.<br />
              <span className="text-gradient">From request to closure.</span>
            </h1>
          </Reveal>

          {/* Subhead with progressive dimming */}
          <Reveal direction="up" delay={0.12}>
            <p className="text-dim-paragraph text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 sm:mb-12 leading-7 sm:leading-relaxed">
              Run the complete Axiom workspace on macOS, Windows, or Linux. <span className="dim-1">The website is an isolated product demo;</span> <span className="dim-2">live cloud operations stay in the downloadable app.</span>
            </p>
          </Reveal>

          {/* Primary CTAs — desktop is the product; web is the safe demo. */}
          <Reveal direction="up" delay={0.16}>
            <div className="flex flex-col items-center gap-4 mb-10">
              <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <Link
                  href={mounted ? primaryPlatform.href : "/download/preview"}
                  className={`group inline-flex min-h-12 items-center justify-center gap-2 px-5 sm:px-7 py-3.5 sm:py-4 rounded-xl sm:rounded-full text-sm font-semibold border transition-colors ${
                    mounted && primaryPlatform.available
                      ? "bg-white text-zinc-950 border-white hover:bg-zinc-100"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 hover:border-amber-500/50"
                  }`}
                  {...(mounted && primaryPlatform.available && primaryPlatform.fileName ? { download: primaryPlatform.fileName } : {})}
                >
                  {mounted && primaryPlatform.available ? <ArrowDownTrayIcon className="h-4 w-4" /> : <CloudArrowDownIcon className="h-4 w-4 text-amber-300" />}
                  {mounted && primaryPlatform.available
                    ? `Download for ${primaryPlatform.label}`
                    : `Check current release for ${mounted ? primaryPlatform.label : "desktop"}`}
                </Link>
                <Link
                  href="/demo"
                  className="group inline-flex min-h-12 items-center justify-center gap-2 px-5 sm:px-7 py-3.5 rounded-xl sm:rounded-full text-sm font-semibold border border-white/[0.12] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06] hover:border-white/[0.2] transition-colors"
                >
                  <BoltIcon className="h-4 w-4 text-amber-300" />
                  Explore the isolated demo
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
              <span className="max-w-full break-words text-xs text-zinc-500 font-mono">
                {manifest?.hasAnyAsset
                  ? `Latest desktop release: ${manifest.tag ?? "—"} · ${manifest.allSignedAndNotarized ? "signed + notarized" : "developer build · per-platform friction notes below"}`
                  : "Web: isolated demo only · Desktop developer builds publish via CI on `desktop-v*` tags — signed binaries when platform certificates are configured"}
              </span>
              {mounted && primaryPlatform.available && primaryPlatform.installFriction && (
                <span className="text-[11px] text-amber-200/80 font-mono">{primaryPlatform.installFriction}</span>
              )}
            </div>
          </Reveal>

          {/* Doc link */}
          <Reveal direction="up" delay={0.18}>
            <p className="text-center text-xs text-zinc-500 mb-6">
              First time? Read the{" "}
              <Link href="/docs/desktop-install" className="text-violet-300 hover:text-violet-200 underline underline-offset-4">install guide</Link>
              {" "}or the{" "}
              <Link href="/docs/desktop-architecture" className="text-violet-300 hover:text-violet-200 underline underline-offset-4">architecture overview</Link>.
            </p>
          </Reveal>

          {/* Platform availability table — live download when manifest has an
              asset, preview route + honest label otherwise. */}
          <Reveal direction="up" delay={0.2}>
            <div className="mt-2 grid sm:grid-cols-2 md:grid-cols-4 gap-2 max-w-3xl mx-auto">
              {(["mac-arm", "mac-intel", "windows", "linux"] as DetectedPlatform[]).map((id) => {
                const p = platformsLive[id];
                const isLive = p.available;
                const downloadAttrs = isLive && p.fileName ? { download: p.fileName } : {};
                return (
                  <Link
                    key={id}
                    href={p.href}
                    {...downloadAttrs}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      isLive
                        ? "border-emerald-500/15 bg-emerald-500/[0.03] hover:border-emerald-500/30"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-amber-500/25"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-semibold text-white">{p.label}</p>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${
                          isLive
                            ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                            : "text-amber-300 bg-amber-500/10 border-amber-500/20"
                        }`}
                      >
                        {isLive ? "Download" : "Check"}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{p.sublabel}</p>
                    {p.installFriction && (
                      <p className="text-[9.5px] text-amber-200/70 mt-1 font-mono leading-snug">{p.installFriction}</p>
                    )}
                    {p.sizeBytes ? (
                      <p className="mt-1 text-[9.5px] font-mono text-zinc-500">
                        {(p.sizeBytes / 1_048_576).toFixed(1)} MB
                      </p>
                    ) : null}
                    {p.digest ? (
                      <p className="mt-1 break-all text-[9px] font-mono text-zinc-600" title={p.digest}>
                        SHA-256 {p.digest.replace(/^sha256:/, "").slice(0, 12)}…
                      </p>
                    ) : null}
                    {p.signatureUrl ? (
                      <p className="mt-1 text-[9.5px] font-mono text-violet-300">Detached signature published</p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
            {manifest?.htmlUrl ? (
              <p className="mt-4 text-center text-[11px] text-zinc-500">
                Verify full SHA-256 digests and download detached signatures on the{" "}
                <a href={manifest.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:text-violet-200 underline underline-offset-4">
                  public release record
                </a>.
              </p>
            ) : null}
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
                The desktop application provides the installed review and operations workspace: intake, approvals, plans, supported adapters, validation, and evidence <span className="dim-1">— while the website remains documentation, distribution, and an isolated demo.</span>
              </p>
            </div>
          </Reveal>

          <Stagger delay={0.1} interval={0.08} className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: CommandLineIcon,
                title: "Local Terraform Review.",
                desc: "Inspect generated Terraform and CLI artifacts on your workstation. Local apply remains disabled until the approval and credential-custody architecture is fully verified.",
                visual: (
                  <div className="mt-5 rounded-lg bg-black/40 border border-white/[0.04] p-3 font-mono text-[10px] text-zinc-500 leading-relaxed">
                    <span className="text-zinc-600">$</span> <span className="text-white">terraform plan</span> <span className="text-violet-400"># sample preview</span><br />
                    <span className="text-emerald-400">✓</span> Artifact ready for human review<br />
                    <span className="text-amber-400">!</span> Apply disabled by desktop safety contract<br />
                    <span className="text-zinc-400">→</span> Record approval or return for revision
                  </div>
                ),
              },
              {
                icon: LockClosedIcon,
                title: "Workstation Session Controls.",
                desc: "Desktop authentication uses a browser approval handoff and scoped bearer session. OS-keychain-backed persistence is not yet shipped; re-authenticate or clear local app data on shared machines.",
                visual: (
                  <div className="mt-5 space-y-2">
                    {[
                      { label: "Desktop sign-in", status: "Browser approval", color: "text-emerald-400" },
                      { label: "Session storage", status: "App data · keychain pending", color: "text-amber-400" },
                      { label: "Cloud credentials", status: "Connector-dependent", color: "text-zinc-300" },
                      { label: "Code signing", status: "See release manifest", color: "text-amber-400" },
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
                title: "Native Desktop Shell.",
                desc: "Use the tray, workspace navigation, and server-sent event views to monitor supported operations while the app is running. Connector failures remain visible.",
                visual: (
                  <div className="mt-5 flex items-center justify-between rounded-lg bg-black/40 border border-white/[0.04] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] text-zinc-400 font-medium">Axiom · Sample workspace</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">Example status</span>
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
                        <p className="text-[10px] text-zinc-400 leading-snug">Sample approval is ready for review · no notification sent</p>
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
                Security status.{" "}
                <span className="text-zinc-500">Clearly stated.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-2xl leading-relaxed">
                The Axiom desktop agent is designed for security-first organizations. <span className="dim-1">Code-signing + notarization pipeline ready for 1.0 — current developer builds run unsigned.</span>
              </p>
            </div>
          </Reveal>

          <Stagger delay={0.1} interval={0.06} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ShieldCheckIcon, label: "Signing and notarization reported from release attestations—not inferred from filenames" },
              { icon: LockClosedIcon, label: "Browser-approved desktop sessions · OS keychain persistence remains pending" },
              { icon: CubeTransparentIcon, label: "Review workstation · local apply disabled by the current safety contract" },
              { icon: DocumentCheckIcon, label: "Persisted audit evidence and exports where the selected workflow supports them" },
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
                status: "Manifest verified",
                statusColor: "text-amber-400",
                statusBg: "bg-amber-500/10 border-amber-500/20",
                detail: "Apple Silicon and Intel targets · installer and signing state shown in the live availability table above",
                dot: "bg-amber-400",
              },
              {
                platform: "Windows",
                status: "Manifest verified",
                statusColor: "text-amber-400",
                statusBg: "bg-amber-500/10 border-amber-500/20",
                detail: "x64 CI target · .msi/.exe buttons appear only when those assets exist in the current release",
                dot: "bg-amber-400",
              },
              {
                platform: "Linux",
                status: "Manifest verified",
                statusColor: "text-amber-400",
                statusBg: "bg-amber-500/10 border-amber-500/20",
                detail: "x64 CI target · AppImage, .deb, and .rpm availability comes from the current release manifest",
                dot: "bg-amber-400",
              },
              {
                platform: "Updates",
                status: "Manual today",
                statusColor: "text-zinc-300",
                statusBg: "bg-white/[0.04] border-white/[0.10]",
                detail: "Automatic update delivery is not configured in the current desktop bundle; install a newer verified release manually",
                dot: "bg-zinc-400",
              },
            ].map((row) => (
              <div
                key={row.platform}
                className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className={`w-2 h-2 rounded-full ${row.dot}`} />
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
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-20 pointer-events-none" aria-hidden />
        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-amber-500/[0.06] blur-[120px] pointer-events-none" aria-hidden />

        <div className="max-w-3xl mx-auto text-center relative">
          <Reveal direction="up" blur>
            <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-[-0.04em]">
              Your operations workspace.<br />
              <span className="text-gradient">Installed.</span>
            </h2>
            <p className="text-dim-paragraph text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Install the platform-specific release shown above. <span className="dim-1">Desktop authentication may open your browser for secure approval.</span> <span className="dim-2">Connector accounts and permissions are configured after first launch.</span>
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
              <a
                href={mounted ? primaryPlatform.href : "/download/preview"}
                {...(mounted && primaryPlatform.available && primaryPlatform.fileName ? { download: primaryPlatform.fileName } : {})}
                className="btn-amber-shimmer group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-semibold uppercase tracking-wide"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {mounted && primaryPlatform.available ? `Download for ${primaryPlatform.label}` : "Check current platform release"}
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/[0.12] text-zinc-300 rounded-full text-sm font-semibold hover:bg-white/5 hover:border-white/20 transition-colors"
              >
                <GlobeAltIcon className="h-4 w-4" />
                Explore sample-data sandbox
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
              {["Manifest-backed downloads", "Signing state shown", "Manual updates documented"].map((item) => (
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
