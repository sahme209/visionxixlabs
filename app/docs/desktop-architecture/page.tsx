import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Desktop architecture — Axiom Documentation",
  description: "How the Axiom desktop app is built (Tauri shell, local execution runtime, OS keychain integration, workstation mode), and what it means for security and enterprise deployment.",
};

export default function DesktopArchitecturePage() {
  // The release-specific install guide is the authoritative desktop source.
  // This legacy page promised local Terraform execution and enterprise modes
  // that are not currently release-verified.
  redirect("/docs/desktop-install");

  return (
    <>
      <DocHeader
        kicker="Desktop · Architecture"
        title="Desktop architecture."
        summary="The Axiom desktop app is a Tauri shell wrapping the same operational UI as the web platform, plus a local execution runtime, OS-keychain credential bridge, and an optional workstation mode that disables all outbound telemetry."
      />

      <Callout variant="info" title="Why Tauri">
        We chose Tauri over Electron for footprint and security: a Tauri app is ~10MB instead of ~150MB, runs in the native OS WebView (no bundled Chromium), and exposes a Rust-side execution boundary that&apos;s easier to audit and harden.
      </Callout>

      <DocSection id="layers" title="The four layers" kicker="01">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>
            <strong>WebView layer (TypeScript/React)</strong> — same operational UI as the web platform (Command Center, Topology, Memory, Workflows, ReleaseOps). 90%+ component reuse.
          </li>
          <li>
            <strong>Tauri shell (Rust)</strong> — native shell process, OS integration (notifications, menu bar, tray icon, file system access), and the policy gate for which commands the WebView is allowed to invoke.
          </li>
          <li>
            <strong>Local execution runtime (Rust)</strong> — invokes <code>terraform</code> CLI and AWS CLI from local PATH using your existing profile. Captures stdout/stderr for the audit log.
          </li>
          <li>
            <strong>Sync layer (Rust)</strong> — handles bidirectional sync with the Axiom cloud platform when connected. Workstation mode disables this layer entirely.
          </li>
        </ul>
      </DocSection>

      <DocSection id="local-execution" title="Local execution model" kicker="02 · Execution">
        <p>The local execution runtime never wraps proprietary binaries — it shells out to the tools you already have:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Terraform</strong> — found via <code>which terraform</code>; uses your existing CLI and your existing state backend</li>
          <li><strong>AWS CLI</strong> — uses your existing <code>~/.aws/credentials</code> and <code>~/.aws/config</code> profiles</li>
          <li><strong>kubectl</strong> — for ArgoCD-related operations (future)</li>
          <li><strong>git</strong> — for ReleaseOps repo introspection (future)</li>
        </ul>
        <p>Every shell invocation is logged with full command, arguments (secrets redacted), exit code, and duration. The log is queryable from the local audit panel.</p>
      </DocSection>

      <DocSection id="credentials" title="Credential bridge" kicker="03 · Credentials">
        <p>Two credential paths, depending on operation:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>
            <strong>Axiom session token</strong> — for syncing with the cloud platform. Stored in OS keychain. Never written to disk in plaintext.
          </li>
          <li>
            <strong>AWS credentials</strong> — for local Terraform/CLI execution. Axiom never sees these. They live in <code>~/.aws/credentials</code> (or your SSO config) and are read directly by the CLIs we shell out to.
          </li>
        </ul>
      </DocSection>

      <DocSection id="workstation-mode" title="Workstation mode" kicker="04 · Workstation mode">
        <p>Workstation mode is for security-strict environments. When enabled:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>All outbound network from the desktop app is disabled, except direct AWS API traffic</li>
          <li>Operational memory persists locally only — no cloud sync</li>
          <li>The Axiom cloud platform marks this connection as &quot;offline&quot;; web dashboard shows last-known state only</li>
          <li>Audit logs export to local file system for SIEM ingestion</li>
          <li>Reasoning runs against a local model (downloaded once) — no cloud inference</li>
        </ul>
        <p>Workstation mode is part of the Enterprise tier. The local reasoning model is downloaded on first activation (~2GB).</p>
      </DocSection>

      <DocSection id="enterprise" title="Enterprise deployment" kicker="05">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>macOS</strong> — MDM/Jamf-managed deployment, signed enterprise pkg, configurable policy plist</li>
          <li><strong>Windows</strong> — MSI bundle with GPO policy, Active Directory authentication path</li>
          <li><strong>Linux</strong> — Ansible role + Debian/RPM packages, systemd service unit for daemon mode</li>
          <li><strong>Telemetry</strong> — opt-out at install time via policy file; workstation mode forces telemetry off</li>
          <li><strong>Update channels</strong> — pinned-version channel available for compliance-strict orgs (no auto-updates)</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What does the desktop app do at runtime?", answer: "Renders the same operational UI as the web, plus shells out to local terraform/aws CLIs for execution, plus syncs with the cloud platform unless workstation mode is enabled." },
            { question: "Why is it safer than the web?", answer: "AWS credentials never leave your machine. Execution runs locally. Audit log persists locally. Workstation mode disables all outbound network." },
            { question: "Is it safe for regulated environments?", answer: "No blanket certification is claimed. Review the current release's platform-specific signing status, the documented product controls, and your organization's deployment requirements before use." },
            { question: "What gets stored locally?", answer: "Operational memory (encrypted), audit log, session token (OS keychain), optional local reasoning model. No source code, no AWS credentials." },
            { question: "Can I revoke?", answer: "Sign out + uninstall. OS keychain entries are removed on sign-out. Audit log can be exported before removal." },
            { question: "What if the org bans local AWS CLI usage?", answer: "Set Tauri policy to disable shell execution. Desktop app falls back to cloud execution path through the Axiom platform — same as web." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/desktop-install", label: "Install the desktop app" }}
        next={{ href: "/docs/troubleshooting", label: "Troubleshooting" }}
      />
      <DocFeedback />
    </>
  );
}
