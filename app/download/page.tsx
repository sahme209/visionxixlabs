"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CommandLineIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

type PlatformId = "mac-arm" | "mac-intel" | "windows" | "linux";
type ManifestPlatform = "macos-arm" | "macos-intel" | "windows-x64" | "linux-x64";

interface ManifestAsset {
  platform: ManifestPlatform;
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
  tag?: string;
  htmlUrl?: string;
  assets: Record<ManifestPlatform, ManifestAsset | null>;
  hasAnyAsset: boolean;
  runtimeReady: boolean;
  runtimeMessage?: string;
}

const platformKey: Record<PlatformId, ManifestPlatform> = {
  "mac-arm": "macos-arm",
  "mac-intel": "macos-intel",
  windows: "windows-x64",
  linux: "linux-x64",
};

const platformLabel: Record<PlatformId, string> = {
  "mac-arm": "macOS for Apple Silicon",
  "mac-intel": "macOS for Intel",
  windows: "Windows",
  linux: "Linux",
};

const subscribe = () => () => undefined;

function detectPlatform(): PlatformId {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("win")) return "windows";
  if (userAgent.includes("linux")) return "linux";
  const platform = navigator.platform?.toLowerCase() ?? "";
  return platform.includes("intel") ? "mac-intel" : "mac-arm";
}

function formatSize(bytes: number) {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export default function DownloadPage() {
  const detectedPlatform = useSyncExternalStore<PlatformId>(subscribe, detectPlatform, () => "mac-arm");
  const [manifest, setManifest] = useState<ReleaseManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/desktop/release-manifest")
      .then(async (response) => {
        if (!response.ok) throw new Error("Release manifest unavailable");
        return response.json();
      })
      .then((body) => {
        if (!cancelled && body?.ok && body.data) setManifest(body.data as ReleaseManifest);
      })
      .catch(() => {
        if (!cancelled) setManifestError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const detectedAsset = manifest?.assets[platformKey[detectedPlatform]] ?? null;
  const downloadReady = Boolean(manifest?.runtimeReady && detectedAsset);
  const primaryHref = downloadReady && detectedAsset
    ? detectedAsset.downloadUrl
    : `/api/desktop/download?platform=${detectedPlatform}`;

  const releaseStatus = useMemo(() => {
    if (manifestError) return "Release status unavailable";
    if (!manifest) return "Checking the latest release…";
    if (!manifest.runtimeReady) return manifest.runtimeMessage ?? "Desktop sign-in is temporarily unavailable.";
    return manifest.tag ? `Latest release · ${manifest.tag.replace("desktop-v", "v")}` : "Latest release";
  }, [manifest, manifestError]);

  return (
    <div className="min-h-screen bg-[#0d0e0c] text-zinc-100">
      <Navigation />

      <main>
        <section className="mx-auto max-w-[1400px] px-5 pb-14 pt-32 sm:px-8 sm:pb-20 sm:pt-40 lg:px-12">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-orange-300">Axiom Agent for desktop</p>
            <h1 className="mt-6 text-[clamp(3.4rem,7vw,7.4rem)] font-medium leading-[0.9] tracking-[-0.065em] text-white">
              Work where<br />engineering happens.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400 sm:text-xl">
              A focused desktop workspace for governed engineering operations, approvals, execution, and evidence.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={primaryHref}
                download={downloadReady && detectedAsset ? detectedAsset.fileName : undefined}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f2f2ed] px-6 text-sm font-semibold text-[#11120f] transition hover:bg-white"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download for {platformLabel[detectedPlatform]}
              </a>
              <Link href="/demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 px-6 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.04]">
                Explore the web demo <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-zinc-600">{releaseStatus}{detectedAsset ? ` · ${formatSize(detectedAsset.sizeBytes)}` : ""}</p>
          </div>
        </section>

        <section id="downloads" className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8 lg:px-12">
          <div className="mb-8 border-t border-white/[0.08] pt-10">
            <h2 className="text-3xl font-medium tracking-[-0.04em] text-zinc-100 sm:text-4xl">Use Axiom on your workstation.</h2>
            <p className="mt-2 text-lg text-zinc-500">One governed workspace across macOS, Windows, and Linux.</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <DownloadCard
              title="macOS"
              copy="Signed and notarized builds for Apple Silicon and Intel Macs."
              icon={ComputerDesktopIcon}
              image="/images/axiom-intake-landscape-v1.png"
              assets={[
                { id: "mac-arm", asset: manifest?.assets["macos-arm"] ?? null },
                { id: "mac-intel", asset: manifest?.assets["macos-intel"] ?? null },
              ]}
              runtimeReady={manifest?.runtimeReady === true}
            />
            <DownloadCard
              title="Windows"
              copy="The Axiom desktop workspace for Windows engineering teams."
              icon={CommandLineIcon}
              image="/images/axiom-validation-landscape-v1.png"
              assets={[{ id: "windows", asset: manifest?.assets["windows-x64"] ?? null }]}
              runtimeReady={manifest?.runtimeReady === true}
            />
            <DownloadCard
              title="Linux"
              copy="A portable AppImage for Linux workstations and engineering environments."
              icon={GlobeAltIcon}
              image="/images/axiom-history-landscape-v1.png"
              assets={[{ id: "linux", asset: manifest?.assets["linux-x64"] ?? null }]}
              runtimeReady={manifest?.runtimeReady === true}
            />
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-[#10110f]">
          <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1fr_auto] md:items-center lg:px-12">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-orange-300">Release integrity</p>
              <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em] text-white sm:text-4xl">Every download resolves from the live release manifest.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-zinc-500">Checksums and detached signatures are published with each available installer. Platform signing status is stated directly—never inferred.</p>
            </div>
            <div className="space-y-3 text-sm text-zinc-400">
              <p className="flex items-center gap-3"><CheckCircleIcon className="h-5 w-5 text-emerald-400" /> macOS signed and notarized</p>
              <p className="flex items-center gap-3"><ShieldCheckIcon className="h-5 w-5 text-orange-300" /> SHA-256 digest per artifact</p>
              {manifest?.htmlUrl ? <a href={manifest.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-zinc-200 hover:text-white">View release record <ArrowRightIcon className="h-4 w-4" /></a> : null}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function DownloadCard({
  title,
  copy,
  icon: Icon,
  image,
  assets,
  runtimeReady,
}: {
  title: string;
  copy: string;
  icon: typeof ComputerDesktopIcon;
  image: string;
  assets: Array<{ id: PlatformId; asset: ManifestAsset | null }>;
  runtimeReady: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171814]">
      <div className="relative aspect-[1.24/1] overflow-hidden border-b border-white/[0.07] bg-[#20211d] p-5">
        <Image src={image} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover opacity-55" />
        <div className="absolute inset-5 overflow-hidden rounded-xl border border-white/10 bg-[#0d0e0c]/90 shadow-2xl shadow-black/50 backdrop-blur-sm">
          <div className="flex h-10 items-center gap-2 border-b border-white/[0.08] px-4">
            <span className="h-2 w-2 rounded-full bg-zinc-600" /><span className="h-2 w-2 rounded-full bg-zinc-700" /><span className="h-2 w-2 rounded-full bg-zinc-800" />
            <span className="ml-auto text-[10px] tracking-wide text-zinc-600">AXIOM AGENT</span>
          </div>
          <div className="p-5 font-mono text-[11px] leading-6 text-zinc-500">
            <p className="text-zinc-300">Governed execution workspace</p>
            <p className="mt-3"><span className="text-emerald-400">●</span> Context verified</p>
            <p><span className="text-orange-300">◆</span> Approval required</p>
            <p><span className="text-zinc-300">✓</span> Evidence retained</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <Icon className="h-5 w-5 text-zinc-400" />
        <h3 className="mt-5 text-xl font-medium text-white">{title}</h3>
        <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-500">{copy}</p>
        <div className="mt-6 flex flex-col gap-2">
          {assets.map(({ id, asset }) => {
            const available = runtimeReady && Boolean(asset);
            return (
              <a
                key={id}
                href={available && asset ? asset.downloadUrl : `/api/desktop/download?platform=${id}`}
                download={available && asset ? asset.fileName : undefined}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#efefea] px-4 text-sm font-medium text-[#11120f] transition hover:bg-white"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download for {platformLabel[id]}
              </a>
            );
          })}
        </div>
        {assets[0]?.asset ? <p className="mt-4 text-[11px] leading-5 text-zinc-600">{assets[0].asset.installFriction}</p> : null}
      </div>
    </article>
  );
}
