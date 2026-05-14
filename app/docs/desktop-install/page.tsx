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
        Every desktop platform (macOS Apple Silicon + Intel, Windows x64, Linux x64) builds and runs end-to-end today. Binaries publish via CI on every <code>desktop-v*</code> tag. Signing + notarization activate automatically when Apple Developer + Windows EV cert secrets are configured — until then, builds are honestly labelled <strong>developer build · unsigned</strong> with a one-time install-friction step per OS (see below). The web platform is fully available now.
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

      <DocSection id="install-macos" title="Install — macOS (Apple Silicon + Intel)" kicker="02">
        <Step number={1} title="Download from /download">
          <p>Visit <Link href="/download">/download</Link>. The page auto-detects Apple Silicon vs Intel and links to the matching <code>.dmg</code> from the latest <code>desktop-v*</code> GitHub release.</p>
        </Step>
        <Step number={2} title="Open the .dmg + drag to Applications">
          <p>Mount the disk image. Drag <strong>Axiom Agent</strong> to <code>/Applications</code>. Eject the DMG.</p>
        </Step>
        <Step number={3} title="First launch — handle Gatekeeper honestly">
          <p>When Apple Developer ID signing + notarization secrets are configured, double-click runs the app cleanly. <strong>Until then</strong>: right-click the app in <code>/Applications</code> → <strong>Open</strong> → <strong>Open</strong> again at the prompt. macOS records the one-time exception and won&apos;t prompt again.</p>
        </Step>
        <Step number={4} title="Sign in to your workspace">
          <p>The app opens to a sign-in screen. Use your existing Axiom credentials. After auth, it pairs the workstation and starts receiving HMAC-signed handoffs.</p>
        </Step>
      </DocSection>

      <DocSection id="install-windows" title="Install — Windows x64" kicker="03">
        <Step number={1} title="Download the .msi">
          <p>The <code>desktop-v*</code> GitHub release contains a Windows MSI installer.</p>
        </Step>
        <Step number={2} title="SmartScreen first-run dialog (unsigned builds)">
          <p>When the EV code-signing certificate is configured in CI, the installer runs cleanly. <strong>Until then</strong>: when Windows SmartScreen warns, click <strong>More info</strong> → <strong>Run anyway</strong>. The MSI is published from a verified CI pipeline and only carries developer-mode binaries.</p>
        </Step>
        <Step number={3} title="Standard MSI install">
          <p>Walk through the installer. The app installs to <code>%LocalAppData%\Programs\Axiom Agent</code> and pins to the Start menu.</p>
        </Step>
        <Step number={4} title="Sign in">
          <p>Same Axiom credentials as the web. The desktop pairs your workstation on first sign-in.</p>
        </Step>
      </DocSection>

      <DocSection id="install-linux" title="Install — Linux x64" kicker="04">
        <Step number={1} title="Pick a packaging format">
          <p>Each release ships an <code>.AppImage</code>, a <code>.deb</code>, and a <code>.rpm</code>. AppImage works on every distribution; <code>.deb</code> covers Debian/Ubuntu; <code>.rpm</code> covers RHEL/Fedora.</p>
        </Step>
        <Step number={2} title="AppImage — chmod + run">
          <p>Linux doesn&apos;t require signing for end-user run. Make the AppImage executable and double-click:</p>
          <pre className="rounded-lg bg-black/40 border border-white/[0.06] p-3 text-[12px] font-mono text-zinc-300 overflow-x-auto">{`chmod +x ./Axiom-Agent-*.AppImage
./Axiom-Agent-*.AppImage`}</pre>
        </Step>
        <Step number={3} title=".deb — sudo dpkg -i">
          <pre className="rounded-lg bg-black/40 border border-white/[0.06] p-3 text-[12px] font-mono text-zinc-300 overflow-x-auto">{`sudo dpkg -i axiom-agent_*_amd64.deb`}</pre>
        </Step>
        <Step number={4} title=".rpm — sudo rpm -i">
          <pre className="rounded-lg bg-black/40 border border-white/[0.06] p-3 text-[12px] font-mono text-zinc-300 overflow-x-auto">{`sudo rpm -i axiom-agent-*.x86_64.rpm`}</pre>
        </Step>
        <Step number={5} title="Sign in">
          <p>Launch <code>axiom-agent</code> (or open from the application menu). Use your Axiom credentials to pair the workstation.</p>
        </Step>
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
            { question: "Is the desktop app safe?", answer: "Binaries publish from a public CI pipeline you can inspect. Signing + notarization activate the moment Apple Developer + Windows EV cert secrets are configured. The HMAC handoff signer + local-apply block are enforced on every build, signed or unsigned." },
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
