"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  CommandLineIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { PipeFlow } from "@/components/marketing/pipeKit/PipeFlow";
import { DESKTOP_SETUP_STAGES } from "@/lib/marketing/desktopSetupFlowModel";
import {formatDesktopInstallerSize} from "@/lib/desktop/downloadSize";

type PlatformId = "mac-arm" | "mac-intel" | "windows" | "linux";
type PlatformDetection = PlatformId | "choose";

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
  previousReleases?: Array<{ tag: string; htmlUrl: string; publishedAt: string }>;
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

const resolverHref: Record<PlatformId, string> = {
  "mac-arm": "/api/desktop/download?platform=mac-arm",
  "mac-intel": "/api/desktop/download?platform=mac-intel",
  windows: "/api/desktop/download?platform=windows",
  linux: "/api/desktop/download?platform=linux",
};

const subscribe = () => () => undefined;

function detectPlatform(): PlatformDetection {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("win")) return "windows";
  if (userAgent.includes("linux")) return "linux";
  // Browser platform strings are not reliable CPU architecture evidence.
  // Keep both Mac installers explicit instead of guessing from "MacIntel".
  return "choose";
}

export function DownloadContent({ cockpit = false }: { cockpit?: boolean }) {
  const detectedPlatform = useSyncExternalStore<PlatformDetection>(subscribe, detectPlatform, () => "choose");
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
        if (body?.ok !== true || !body.data || typeof body.data !== "object"
          || !body.data.assets || typeof body.data.assets !== "object" || Array.isArray(body.data.assets)) {
          throw new Error("Release manifest unavailable");
        }
        if (!cancelled) setManifest(body.data as ReleaseManifest);
      })
      .catch(() => {
        if (!cancelled) setManifestError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const detectedAsset = detectedPlatform === "choose" ? null : manifest?.assets[platformKey[detectedPlatform]] ?? null;
  const downloadReady = Boolean(manifest?.runtimeReady === true && detectedAsset);
  const primaryHref = detectedPlatform === "choose" ? "#downloads" : downloadReady && detectedAsset
    ? detectedAsset.downloadUrl
    : resolverHref[detectedPlatform];

  const releaseStatus = useMemo(() => {
    if (manifestError) return "Release status unavailable";
    if (!manifest) return "Checking the latest release…";
    if (manifest.runtimeReady !== true) return manifest.runtimeMessage ?? "Desktop sign-in is temporarily unavailable.";
    return manifest.tag ? `Latest desktop installer · ${manifest.tag.replace("desktop-v", "v")}` : "Latest desktop installer";
  }, [manifest, manifestError]);

  return (
    <div className={cockpit ? "text-zinc-100" : "min-h-screen bg-[#101010] text-zinc-100"}>
      {!cockpit && <Navigation />}

      <main className={cockpit ? "max-w-5xl" : undefined}>
        <section className={cockpit ? "mb-6" : "mx-auto max-w-[1280px] px-5 pb-10 pt-24 sm:px-8 sm:pb-14 lg:pt-28 lg:px-10"}>
          <div className={cockpit ? "max-w-3xl" : "grid gap-6 border-b border-white/[0.07] pb-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16"}>
            <div>
            {!cockpit && <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-orange-300">Axiom Agent for desktop</p>}
            <h1 className={cockpit ? "text-white" : "mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.05] tracking-[-0.05em] text-white"}>
              {cockpit ? "Desktop & provider setup" : <>Work where<br />engineering happens.</>}
            </h1>
            </div>
            <div className={cockpit ? undefined : "lg:pb-2"}>
            <p className={cockpit ? "mt-3 max-w-2xl text-sm leading-6 text-zinc-400" : "max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg"}>
              A focused desktop workspace for governed engineering operations, approvals, execution, and evidence.
            </p>
            <div className={cockpit ? "mt-4 flex flex-wrap items-center gap-2" : "mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"}>
              <a
                href={primaryHref}
                download={downloadReady && detectedAsset ? detectedAsset.fileName : undefined}
                className={cockpit ? "inline-flex h-8 items-center gap-2 rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-900 hover:bg-white" : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl sm:rounded-full bg-[#f2f2ed] px-6 text-sm font-semibold text-[#11120f] transition hover:bg-white"}
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {detectedPlatform === "choose" ? "Choose your installer" : `Download for ${platformLabel[detectedPlatform]}`}
              </a>
              <Link href={cockpit ? "/control/integrations" : "/demo"} className={cockpit ? "inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/5" : "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/12 px-6 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.04]"}>
                {cockpit ? "Back to integrations" : "Explore the web demo"} <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-zinc-400">{releaseStatus}{detectedAsset ? ` · ${(formatDesktopInstallerSize(detectedAsset.sizeBytes)??"Size unavailable")}` : ""}</p>
            </div>
          </div>
        </section>

        {cockpit && <section aria-label="Provider setup requirements" className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.015] p-5">
          <h2 className="text-sm font-medium text-zinc-100">Connect a provider securely</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-5 text-zinc-400">
            <li>Sign in to Axiom Agent using the same account and workspace as this cockpit.</li>
            <li>Review the provider capabilities available in your installed release. A download does not create a cloud connection.</li>
            <li>Complete only the supported authorization flow with your administrator. Provider consent, scopes, credentials, and backend validation are required before a connection becomes active.</li>
          </ol>
          <p className="mt-3 text-xs leading-5 text-zinc-500">Cloud enrollment is not available from this web page. Azure, AWS, and Google Cloud remain setup-required until their supported flow is configured and validated. Source-code capabilities may differ from published installers.</p>
        </section>}
        <section id="downloads" className={cockpit ? "mb-6 scroll-mt-6" : "mx-auto max-w-[1280px] px-5 pb-16 sm:px-8 lg:px-10"}>
          <div className={cockpit ? "mb-3" : "mb-6 border-t border-white/[0.08] pt-8"}>
            <h2 className={cockpit ? "text-sm font-medium text-zinc-100" : "text-2xl font-medium tracking-[-0.035em] text-zinc-100 sm:text-3xl"}>{cockpit ? "Desktop installers" : "Use Axiom on your workstation."}</h2>
            <p className={cockpit ? "mt-1 text-xs text-zinc-500" : "mt-2 text-base text-zinc-400"}>One governed workspace across macOS, Windows, and Linux. Sizes are per-platform installer downloads; installed size may differ.</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <DownloadCard
              title="macOS"
              copy="Installers for Apple Silicon and Intel Macs. Review signing details in the release record."
              icon={ComputerDesktopIcon}
              assets={[
                { id: "mac-arm", asset: manifest?.assets["macos-arm"] ?? null },
                { id: "mac-intel", asset: manifest?.assets["macos-intel"] ?? null },
              ]}
              compact={cockpit}
              runtimeReady={manifest?.runtimeReady === true}
            />
            <DownloadCard
              title="Windows"
              copy="The Axiom desktop workspace for Windows engineering teams."
              icon={CommandLineIcon}
              assets={[{ id: "windows", asset: manifest?.assets["windows-x64"] ?? null }]}
              compact={cockpit}
              runtimeReady={manifest?.runtimeReady === true}
            />
            <DownloadCard
              title="Linux"
              copy="A portable AppImage for Linux workstations and engineering environments."
              icon={GlobeAltIcon}
              assets={[{ id: "linux", asset: manifest?.assets["linux-x64"] ?? null }]}
              compact={cockpit}
              runtimeReady={manifest?.runtimeReady === true}
            />
          </div>
        </section>

        {!cockpit && <section aria-labelledby="installation-help" className="mx-auto max-w-[1280px] px-5 pb-12 sm:px-8 lg:px-10">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-5 sm:p-8">
            <h2 id="installation-help" className="text-2xl font-medium tracking-[-0.035em] text-white">Installation and help</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Downloading does not connect a provider or authorize actions. Supported capabilities and support options vary by installed version and current access. Review the installation guide, then follow the supported authorization and approval workflow for your workspace.</p>
            <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
              <Link href="/docs/desktop-install" className="text-zinc-200 underline underline-offset-4 hover:text-white">Desktop installation guide</Link>
              <Link href="/docs/troubleshooting" className="text-zinc-200 underline underline-offset-4 hover:text-white">Troubleshooting</Link>
              <Link href="/docs/approval-workflow" className="text-zinc-200 underline underline-offset-4 hover:text-white">Approval workflow</Link>
            </div>
            <p className="mt-5 text-sm leading-6 text-zinc-400">Need more help? <Link href="/account/help" className="text-zinc-200 underline underline-offset-4 hover:text-white">Account help (account required)</Link> provides an account-context support entry. You can also <Link href="/contact" className="text-zinc-200 underline underline-offset-4 hover:text-white">Contact us</Link> through the public contact page.</p>
            <p className="mt-3 text-xs leading-5 text-zinc-500"><Link href="/support" className="text-zinc-300 underline underline-offset-4 hover:text-white">Founding Supporters</Link> is a separate way to support Axiom’s development.</p>
          </div>
        </section>}

        {manifest?.previousReleases?.length ? (
          <section aria-labelledby="previous-releases" className={cockpit ? "mb-6" : "mx-auto max-w-[1280px] px-5 pb-12 sm:px-8 lg:px-10"}>
            <h2 id="previous-releases" className={cockpit ? "text-sm font-medium text-zinc-100" : "text-xl font-medium text-zinc-100"}>Previous desktop releases</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">The newest published installer appears above. Older releases remain available with their original checksums and signing details; local development builds are not published downloads.</p>
            <ul className="mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {manifest.previousReleases.map(release => (
                <li key={release.tag}>
                  <a href={release.htmlUrl} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm text-zinc-200 hover:text-white">
                    <span>{release.tag.replace("desktop-v", "v")}</span>
                    <span className="inline-flex items-center gap-2 text-zinc-400">Release and downloads <ArrowRightIcon aria-hidden="true" className="h-4 w-4" /></span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={cockpit ? "rounded-xl border border-white/[0.08] bg-white/[0.015]" : "border-y border-white/[0.07] bg-[#131313]"}>
          <div className={cockpit ? "grid gap-4 p-5" : "mx-auto grid max-w-[1280px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto] md:items-center lg:px-10"}>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-orange-300">Release integrity</p>
              <h2 className={cockpit ? "mt-2 text-sm font-medium text-zinc-100" : "mt-4 text-2xl font-medium tracking-[-0.035em] text-white sm:text-3xl"}>Every download resolves from the live release manifest.</h2>
              <p className={cockpit ? "mt-2 max-w-2xl text-xs leading-5 text-zinc-500" : "mt-4 max-w-2xl leading-7 text-zinc-400"}>Review checksums and detached signatures in the release record where provided. Installer signing and notarization labels report the current manifest; they do not replace local verification.</p>
            </div>
            <div className="space-y-3 text-sm text-zinc-400">
              <p className="flex items-center gap-3"><ShieldCheckIcon className="h-5 w-5 text-zinc-400" /> Review signing and notarization per installer</p>
              <p className="flex items-center gap-3"><ShieldCheckIcon className="h-5 w-5 text-orange-300" /> Review published SHA-256 digests</p>
              {manifest?.htmlUrl ? <a href={manifest.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-zinc-200 hover:text-white">View release record <ArrowRightIcon className="h-4 w-4" /></a> : null}
            </div>
          </div>
        </section>
        {!cockpit && (
          <section aria-labelledby="desktop-setup-flow" className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-10">
            <h2 id="desktop-setup-flow" className="text-2xl font-medium tracking-[-0.03em] text-white sm:text-3xl">From download to your first governed action</h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-zinc-400">Five steps, each handing something specific to the next. Installing connects nothing; sign-in happens in your browser.</p>
            <div className="mt-8"><PipeFlow stages={DESKTOP_SETUP_STAGES} label="From download to your first governed action" /></div>
          </section>
        )}
      </main>

      {!cockpit && <Footer />}
    </div>
  );
}

function DownloadCard({
  title,
  copy,
  icon: Icon,
  assets,
  runtimeReady,
  compact = false,
}: {
  title: string;
  copy: string;
  icon: typeof ComputerDesktopIcon;
  assets: Array<{ id: PlatformId; asset: ManifestAsset | null }>;
  runtimeReady: boolean;
  compact?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#151515]">
      <div className={compact ? "flex items-center justify-between border-b border-white/[0.07] px-4 py-3" : "flex items-center justify-between border-b border-white/[0.07] px-5 py-4"}>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">Desktop installer</span>
        <Icon aria-hidden="true" className="h-5 w-5 text-zinc-400" />
      </div>
      <div className={compact ? "p-4" : "p-5"}>
        <h3 className={compact ? "text-sm font-medium text-zinc-100" : "text-xl font-medium text-white"}>{title}</h3>
        <p className={compact ? "mt-2 min-h-12 text-xs leading-5 text-zinc-500" : "mt-2 min-h-12 text-sm leading-6 text-zinc-400"}>{copy}</p>
        <div className={compact ? "mt-4 flex flex-col gap-2" : "mt-6 flex flex-col gap-2"}>
          {assets.map(({ id, asset }) => {
            const available = runtimeReady && Boolean(asset);
            return (
              <div key={id}>
              <a
                href={available && asset ? asset.downloadUrl : resolverHref[id]}
                download={available && asset ? asset.fileName : undefined}
                className={compact ? "inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-2 text-xs font-medium text-zinc-900 hover:bg-white" : "inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-lg bg-[#efefea] px-4 text-sm font-medium text-[#11120f] transition hover:bg-white"}
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download for {platformLabel[id]}
              </a>
              {asset&&<p className="mt-2 break-all text-[11px] leading-5 text-zinc-400" title={Number.isSafeInteger(asset.sizeBytes)&&asset.sizeBytes>0?`${asset.sizeBytes.toLocaleString('en-US')} bytes`:undefined}>{formatDesktopInstallerSize(asset.sizeBytes)??'Size unavailable'} download · {asset.fileName}</p>}
              {asset ? <p className="mt-2 text-[11px] leading-5 text-zinc-400">{platformLabel[id]} · {asset.signed === true
                ? ((id === "mac-arm" || id === "mac-intel")
                  ? (asset.notarized === true ? "Manifest reports signed and notarized" : "Manifest reports signed; notarization not confirmed")
                  : "Manifest reports signed")
                : "Signing not confirmed"}</p> : null}
              {asset?.installFriction ? <p className="mt-1 text-[11px] leading-5 text-zinc-400">{asset.installFriction}</p> : null}
              {id === "windows" && <p className="mt-3 text-xs leading-5 text-zinc-400">Windows trusted signing remains unresolved; SmartScreen warnings may appear. A manifest signing report does not establish Windows trust or reputation. Follow your organization’s software policy when deciding whether to install.</p>}
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

