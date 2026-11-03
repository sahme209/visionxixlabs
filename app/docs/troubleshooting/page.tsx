import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocHeader, DocSection } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Troubleshooting — Axiom Documentation",
  description: "Find installation, connection, review, and safe help guidance for Axiom.",
};

export default function TroubleshootingPage() {
  return (
    <>
      <DocHeader
        kicker="Docs · Help"
        title="Troubleshooting"
        summary="Start with the visible problem. Installation, connection readiness, approval, and execution are separate checks."
      />

      <Callout variant="warning" title="Unknown result or consumed operation? Stop here first.">
        Do not resend the action, create a replacement to repeat it, or assume a timeout means failure.
        Read the original saved operation and available outcome evidence. An unconfirmed or unknown result is not confirmed success or confirmed failure.
        If uncertainty remains, use the safe help guidance below.
      </Callout>

      <DocSection id="installation" title="Install or sign in" kicker="01">
        <p>Check the selected release and installer on the download page. Choose the package for your operating system and architecture, then follow the installation guide. Desktop sign-in uses browser-approved pairing; return to the installed app to continue.</p>
        <p>Availability and verification depend on the selected release. This guide does not establish signing, platform acceptance, or a successful clean installation. Follow your organization’s software policy and platform protections.</p>
        <p><Link href="/download">Check downloads</Link> · <Link href="/docs/desktop-install">Install and sign in</Link></p>
      </DocSection>

      <DocSection id="connections" title="A connection is not ready" kicker="02">
        <p>Start from Connect in the installed app’s Integrations area, not a callback URL. Setup required needs the service operator; awaiting validation means consent alone is incomplete. Revalidate a failed or stale connection before relying on it for evidence, where that control is available in your installed version and surface.</p>
        <p>Validated read access does not establish authority for every write. Installing the app does not make a connection ready, and workspace users cannot supply missing production registration or secrets in the desktop app.</p>
        <p><Link href="/docs/integration-setup#states">Understand connection states</Link> · <Link href="/docs/integration-setup">Operator setup</Link></p>
      </DocSection>

      <DocSection id="reviews" title="A review is stale, expired, or unavailable" kicker="03">
        <p>Check the current proposal, target, permissions, and installed-version guidance. Approval is a review record; it does not prove execution or success. An expired or changed review cannot be treated as current authority.</p>
        <p>Use the normal proposal and independent-review process for current details only after checking whether an original operation already exists. Do not reuse expired approval or work around disabled controls, missing authority, baseline restrictions, or unavailable evidence.</p>
        <p>For the registered Agent proposal workflow described in the approval guide, separate requester execution remains a local preview and is not production-activated. Your installed version may not include an Execute control. Recovery controls depend on the installed version and surface; this article does not enable them or grant execution authority. Approval permission and execution permission remain separate.</p>
        <p><Link href="/docs/approval-workflow">Approval and execution boundaries</Link> · <Link href="/docs/releaseops/readiness">Readiness guidance</Link></p>
      </DocSection>

      <DocSection id="original-operation" title="The original operation is uncertain or consumed" kicker="04">
        <p>Read the original saved operation and available outcome evidence using the controls supported by your installed version. Saved metadata is bounded evidence, not complete provider history. A consumed operation cannot be repeated through a replacement request, and waiting for a lease does not restore permission.</p>
        <p>Any provider reconciliation must be read-only and authorized; no automatic reconciliation service is implied. If the result remains uncertain, seek help with a sanitized summary.</p>
        <p><Link href="/docs/approval-workflow#execution">Execution and recovery</Link> · <Link href="/docs/audit-logs">Audit evidence guide</Link></p>
      </DocSection>

      <DocSection id="safe-help" title="Get help safely" kicker="05">
        <p><Link href="/account/help">Account help (sign-in required)</Link> · <Link href="/status">Service status</Link> · <Link href="/contact">Contact</Link></p>
        <p>Share your app version, operating system, affected task, approximate time, visible status, and a sanitized error summary. Omit passwords, tokens, client secrets, authorization codes, callback state, tenant secrets, and sensitive repository or customer content.</p>
        <p>Keep original operation IDs private and share them only through an approved support channel; do not put them in public posts or URLs. Review what you share yourself; this guide does not promise automatic redaction or a response time.</p>
        <p><Link href="/support">Founding Supporters</Link> funds development; it is separate from technical support.</p>
      </DocSection>
    </>
  );
}
