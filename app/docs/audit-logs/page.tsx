import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Audit evidence — Axiom Documentation",
 description: "Read saved decisions, attempts and outcome evidence without confusing approval with external success.",
 alternates: { canonical: "/docs/audit-logs" },
};
export default function AuditLogsPage() {
 return <>
  <DocHeader kicker="Workflow reference · Evidence" title="Read the evidence, not just the status."
   summary="A saved decision, an attempted action and an observed external result answer different questions." />
  <Callout title="Version and coverage">Coverage and available controls vary by installed version and supported workflow. This guide does not establish complete audit coverage, Governance activation or a certification. Some linked workflows describe local previews.</Callout>
  <DocSection id="record" kicker="01" title="Review the original record">
   <p>Open the saved request or task using the history and details controls available in that workflow. Keep its original identifier and version. Compare the displayed source, target, proposed change, actor, review decision and timestamps where those fields are available.</p>
   <p>Saved metadata is bounded product evidence, not complete provider history. A familiar target name, screenshot or status label alone cannot establish which exact change occurred. <Link href="/docs/execution-plans">Understand execution plans</Link> before interpreting their records.</p>
  </DocSection>
  <DocSection id="effects" kicker="02" title="Separate decisions from effects">
   <dl className="space-y-4">
    <div><dt className="font-semibold text-white">Review evidence</dt><dd>Who reviewed which exact saved proposal. Approval is not proof that execution was attempted or succeeded.</dd></div>
    <div><dt className="font-semibold text-white">Attempt evidence</dt><dd>Whether the supported path recorded a claim or submission and its known result. A completed HTTP request is not by itself an external outcome.</dd></div>
    <div><dt className="font-semibold text-white">Outcome evidence</dt><dd>The actual provider observation or readback, its target and observation time. A deployment dispatch does not prove rollback, service health or later availability.</dd></div>
   </dl>
   <p>Record which evidence is missing. An audit entry is not an independent attestation that an organization is compliant. Hash or export utilities, where available, do not establish complete coverage or independent verification.</p>
  </DocSection>
  <DocSection id="uncertain" kicker="03" title="Handle an uncertain result">
   <Callout variant="warning" title="Preserve the original attempt">A timeout does not prove that nothing happened. Do not resend an uncertain or consumed action, edit its history or treat an expired review as current permission.</Callout>
   <p>Use supported read-only history or recovery controls first. Keep the difference between refusal before a write, known failure, confirmed result and unknown outcome. Do not infer absence from a blank field or missing response.</p>
   <p>Recovery is workflow-specific. A readback may establish an external fact without restoring execution authority. Further consequential actions still need the supported current checks and genuine approvals.</p>
   <p><Link href="/docs/troubleshooting">Troubleshoot an uncertain operation</Link> for the next safe inspection step.</p>
  </DocSection>
  <DocSection id="share" kicker="04" title="Share evidence safely">
   <p>Use only the approved support or export path available to your organization. Do not publish tokens, credentials, customer source, private operation identifiers or unredacted screenshots in public URLs or issue comments. Check the target audience and access before sharing.</p>
   <p><Link href="/account/help">Account help (sign-in required)</Link> and the <Link href="/docs/security-model">security model and limitations</Link> explain adjacent boundaries; neither grants an exception to a consumed attempt.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/approval-workflow",label:"Approval workflow"}} next={{href:"/docs/troubleshooting",label:"Troubleshooting"}} />
 </>;
}
