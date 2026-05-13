import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Install the desktop app — Axiom Documentation",
  description: "Install Axiom Agent on macOS (preview now), Windows (Q2 2026), or Linux (Q3 2026). What the desktop app does that the web platform doesn't.",
};

export default function DesktopInstallPage() {
  return (
    <>
      <DocHeader
        kicker="Desktop · Install"
        title="Install the desktop app."
        summary="Axiom on your workstation: local Terraform execution, OS keychain credential storage, native notifications, and background scanning. macOS preview now; Windows Q2 2026; Linux Q3 2026."
      />

      <Callout variant="info" title="Where each platform is right now">
        macOS is in <strong>preview</strong> — code-signed and notarized, but feature-incomplete. Windows ships Q2 2026. Linux ships Q3 2026. The web platform is fully available today across all browsers.
      </Callout>

      <DocSection id="why-desktop" title="Web vs desktop — when to install" kicker="01">
        <p>Both surface the same operational data. The desktop app unlocks:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Local execution</strong> — Terraform applies run from your workstation using your own AWS CLI profile, never through Axiom&apos;s cloud</li>
          <li><strong>OS keychain credentials</strong> — AWS credentials remain in macOS Keychain / Windows Credential Manager / Linux libsecret, never in the app</li>
          <li><strong>Background scanning</strong> — menu-bar agent runs scans on schedule without keeping a browser tab open</li>
          <li><strong>Native notifications</strong> — approval requests, drift alerts, scan completions delivered via OS notifications</li>
          <li><strong>Offline audit export</strong> — drag-and-drop audit log export to SIEM, no browser needed</li>
          <li><strong>Workstation mode</strong> — enterprise option that disables all outbound telemetry; all operational data stays on your machine</li>
        </ul>
      </DocSection>

      <DocSection id="install" title="Install — macOS preview" kicker="02">
        <Step number={1} title="Download from /download">
          <p>Visit <Link href="/download">/download</Link>. The page auto-detects macOS Apple Silicon vs Intel. Click the appropriate primary button.</p>
        </Step>
        <Step number={2} title="Verify code signature">
          <p>The downloaded <code>.dmg</code> is Apple-notarized. Gatekeeper will validate on first open. If you receive a Gatekeeper warning, the download is corrupt — re-download.</p>
        </Step>
        <Step number={3} title="Drag to Applications">
          <p>Standard macOS install. Drag Axiom to <code>/Applications</code>. Eject the DMG.</p>
        </Step>
        <Step number={4} title="First launch + auth">
          <p>The app opens to a sign-in screen. Use your existing Axiom credentials. After auth, it offers to migrate any existing AWS connections from the web platform.</p>
        </Step>
        <Step number={5} title="Optional: enable menu-bar agent">
          <p>Settings → General → &quot;Run agent in menu bar&quot;. Enables background scans + native notifications.</p>
        </Step>
      </DocSection>

      <DocSection id="windows" title="Install — Windows (Q2 2026)" kicker="03">
        <p>Windows 10/11 x64 and ARM64 will be supported. Distribution via:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Direct MSIX download from <Link href="/download">/download</Link></li>
          <li>Microsoft Store</li>
          <li>Winget package: <code>winget install axiom-agent</code> (planned)</li>
          <li>Enterprise MSI bundle for IT-managed deployments</li>
        </ul>
        <p>Q2 2026 ETA. Sign up at <Link href="/download">/download</Link> for early-access invitations.</p>
      </DocSection>

      <DocSection id="linux" title="Install — Linux (Q3 2026)" kicker="04">
        <p>Linux distribution will include:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>AppImage (universal)</li>
          <li><code>.deb</code> (Debian, Ubuntu)</li>
          <li><code>.rpm</code> (RHEL, Fedora, openSUSE)</li>
          <li>Snap (universal)</li>
          <li>Flatpak (universal)</li>
        </ul>
        <p>Q3 2026 ETA. The same menu-bar / system-tray agent will be available on supported desktop environments.</p>
      </DocSection>

      <DocSection id="cli" title="CLI binary — available now" kicker="05">
        <p>If you want headless / CI/CD usage today, the <code>axiom-cli</code> binary is available cross-platform now:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><code>brew install axiom-cli</code> (macOS, Linux)</li>
          <li><code>scoop install axiom-cli</code> (Windows)</li>
          <li><code>npm install -g @axiomops/cli</code> (cross-platform)</li>
        </ul>
        <p>The CLI supports scanning, plan export, approval, and apply — same operations as the desktop app, headless.</p>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What does the desktop app do that the web doesn't?", answer: "Local Terraform execution, OS-keychain credential storage, background agent with native notifications, offline audit export, optional workstation mode." },
            { question: "Why install it?", answer: "Stricter security posture, reduced cloud round-trip latency, and ability to work offline." },
            { question: "Is the desktop app safe?", answer: "Apple-notarized + Microsoft-signed binaries. No telemetry by default. Workstation mode disables all outbound network entirely." },
            { question: "Where are credentials stored?", answer: "OS keychain (macOS Keychain / Windows Credential Manager / Linux libsecret). Never in the app's own files." },
            { question: "Can I revoke?", answer: "Sign out + uninstall. Credentials in OS keychain are removed on sign-out." },
            { question: "What if my org blocks Apple-signed apps?", answer: "Enterprise deployment via managed Apple Business Manager / Jamf is supported on the Enterprise tier." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/releaseops/readiness", label: "Readiness scoring" }}
        next={{ href: "/docs/desktop-architecture", label: "Desktop architecture" }}
      />
      <DocFeedback />
    </>
  );
}
