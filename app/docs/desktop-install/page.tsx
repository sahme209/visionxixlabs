import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Install the desktop app — Axiom Documentation",
  description: "Install Axiom Agent using verified release assets for macOS, Windows, and Linux.",
};

export default function DesktopInstallPage() {
  return (
    <>
      <DocHeader
        kicker="Desktop · Install"
        title="Install the desktop app."
        summary="The website explains and distributes Axiom Agent. Deployment intake, approvals, guided operations, validation, and evidence workflows live in the installed application."
      />

      <Callout variant="info" title="Use the live release manifest">
        The <Link href="/download">download page</Link> reads the public GitHub release manifest and enables only platforms with an installer asset. It shows the current release tag and the signing or notarization state supported by machine-readable release attestations. If an asset or attestation is absent, the page says so.
      </Callout>

      <DocSection id="current-state" title="What the current desktop build delivers" kicker="01">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Installed workspace</strong> — desktop navigation for releases, approvals, connectors, validation, audit evidence, and related operational views</li>
          <li><strong>Desktop authentication</strong> — browser-approved pairing returns control to the installed application</li>
          <li><strong>Repository workspace</strong> — select, clone, inspect, edit, branch, commit, push, and open pull requests with repository-scoped access</li>
          <li><strong>Native shell</strong> — tray and notification integrations are available for supported application events</li>
          <li><strong>Explicit connection state</strong> — unavailable APIs, missing credentials, and connector failures remain visible</li>
          <li><strong>Persisted app state</strong> — nonsecret preferences use the file-backed app store; session credentials use the configured native vault. Persistence, upgrade migration, and vault-denial recovery require acceptance on each supported operating system.</li>
        </ul>
      </DocSection>

      <DocSection id="requirements" title="System requirements" kicker="02">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>macOS</strong> — Apple Silicon or Intel build matching your Mac; the release currently targets macOS 12 or later</li>
          <li><strong>Windows</strong> — Windows 10 or 11 on x64 with Microsoft Edge WebView2 available</li>
          <li><strong>Linux</strong> — x64 desktop with WebKitGTK 4.1 and GTK 3 runtime dependencies; use AppImage, Debian, or RPM packaging as appropriate</li>
          <li><strong>Browser engine for Tailwind 4 source builds</strong> — Safari 16.4+, Chrome 111+, or Firefox 128+. Desktop webviews need compatible engine updates; the operating-system name alone does not establish compatibility. Qualification on the minimum supported macOS, Windows, and Linux versions remains required before publishing an updated installer.</li>
          <li><strong>Network</strong> — HTTPS access to the configured Axiom API and any integrations you enable</li>
          <li><strong>External accounts</strong> — identity-provider and connector accounts remain your organization&apos;s responsibility; permissions vary by connector</li>
        </ul>
      </DocSection>

      <DocSection id="install-macos" title="Install — macOS (Apple Silicon + Intel)" kicker="03">
        <Step number={1} title="Download the matching DMG">
          <p>Visit <Link href="/download">/download</Link>. Choose Apple Silicon or Intel. The enabled button points directly to the matching asset from the current <code>desktop-v*</code> release.</p>
        </Step>
        <Step number={2} title="Verify the release if required">
          <p>Check the download page for the selected installer&apos;s verification details. If a matching detached <code>.asc</code> signature and a release public key are published, download both and run <code>gpg --verify installer.dmg.asc installer.dmg</code> using the actual filenames. Compare the SHA-256 digest when one is published. A missing signature or digest means that check is unavailable; if your organization requires it, wait for a release that provides it.</p>
        </Step>
        <Step number={3} title="Open the DMG and install">
          <p>Mount the disk image, drag <strong>Axiom Agent</strong> to <code>/Applications</code>, and eject the image.</p>
        </Step>
        <Step number={4} title="Handle Gatekeeper according to the manifest">
          <p>Do not assume the app is signed or notarized. If the download page reports an unsigned developer build, right-click the app, choose <strong>Open</strong>, and review the warning. Organizations that forbid unsigned software should not install that asset.</p>
        </Step>
        <Step number={5} title="Complete desktop sign-in">
          <p>Choose browser sign-in in the app. Your browser approves the pairing request and the installed application polls for the scoped desktop session. A browser redirect is part of desktop authentication, not a separate web product.</p>
        </Step>
      </DocSection>

      <DocSection id="install-windows" title="Install — Windows x64" kicker="04">
        <Step number={1} title="Download MSI or EXE">
          <p>The generic Windows download prefers the MSI when it is present in the live manifest. The release page also exposes the NSIS <code>.exe</code>.</p>
        </Step>
        <Step number={2} title="Verify before running">
          <p>If the selected installer has a matching <code>.asc</code> signature and release public key, verify that signature before running it. Compare the published SHA-256 digest when available. A detached signature does not establish Windows Authenticode signing: use the download page&apos;s attestation state and your organization&apos;s installation policy.</p>
        </Step>
        <Step number={3} title="Review SmartScreen">
          <p>Unsigned builds can trigger SmartScreen. Review the publisher state and your organization&apos;s policy before choosing <strong>More info</strong> → <strong>Run anyway</strong>.</p>
        </Step>
        <Step number={4} title="Install and sign in">
          <p>Complete the installer, launch Axiom Agent, and approve the desktop pairing flow in your browser.</p>
        </Step>
      </DocSection>

      <DocSection id="install-linux" title="Install — Linux x64" kicker="05">
        <Step number={1} title="Choose a package">
          <p>The generic Linux button prefers AppImage. The release page also provides <code>.deb</code> and <code>.rpm</code> assets when available.</p>
        </Step>
        <Step number={2} title="Review available verification details">
          <p>When a matching detached <code>.asc</code> signature and release public key are published, verify the selected package before installation. Compare its published SHA-256 digest when available. Do not assume every package includes a signature; if required verification is missing, wait for an appropriate release.</p>
        </Step>
        <Step number={3} title="Install or run">
          <pre className="rounded-lg bg-black/40 border border-white/6 p-3 text-[12px] font-mono text-zinc-300 overflow-x-auto">{`chmod +x ./Axiom.Agent_*_amd64.AppImage
./Axiom.Agent_*_amd64.AppImage

sudo dpkg -i Axiom.Agent_*_amd64.deb
sudo rpm -i Axiom.Agent-*-1.x86_64.rpm`}</pre>
        </Step>
        <Step number={4} title="Sign in">
          <p>Open Axiom Agent from the desktop menu or AppImage and approve the pairing flow in your browser.</p>
        </Step>
      </DocSection>

      <DocSection id="updates" title="Updates and release notes" kicker="06">
        <p>Automatic update delivery is not configured in the current Tauri bundle. Check the <Link href="/download">download page</Link> for a newer verified tag and install it manually. Review the public <a href="https://github.com/sahme209/axiom-releases/releases" target="_blank" rel="noopener noreferrer">Axiom Agent release notes</a> before upgrading.</p>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "Is this a browser product?", answer: "No. The website provides product information, documentation, verified downloads, and an isolated sample-data sandbox. Operational workflows are delivered by the installed app." },
            { question: "Are current builds signed and notarized?", answer: "Only when the live release manifest has explicit signing attestations. Detached GPG signatures verify release origin but do not replace Apple notarization or Windows Authenticode." },
            { question: "Where is the desktop session stored?", answer: "The source configures native credential storage: macOS Keychain, Windows Credential Manager, or Linux Secret Service. Native storage errors block credential writes; legacy file-backed values are removed only after a successful native write. Actual persistence, upgrade migration, and denied-vault recovery still require acceptance on each platform; compilation alone does not verify them." },
            { question: "Can the desktop app deploy?", answer: "Execution availability depends on the installed release, a configured and verified connection, current permissions, a separately approved operation, and the required release attestations and deployment checks. A saved plan, ticket preview, or advisory review does not authorize execution. An unavailable or disabled operation remains blocked until its requirements are met." },
            { question: "Does it update automatically?", answer: "Not currently. Install newer verified releases manually." },
            { question: "Which verification details should I check?", answer: "Check the selected release and installer, its published SHA-256 digest when available, any matching detached signature and release public key, and the platform signing or notarization attestations. Missing evidence is not a passed check. Automated source tests do not establish clean installation or signature verification on your target OS." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/releaseops/readiness", label: "Readiness scoring" }}
        next={{ href: "/docs/releaseops", label: "ReleaseOps overview" }}
      />
      <DocFeedback />
    </>
  );
}
