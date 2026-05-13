import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "ReleaseOps overview — Axiom Documentation",
  description: "What Axiom ReleaseOps is, how it fits inside the Axiom platform, and why it sits above existing CI/CD systems rather than replacing them.",
};

export default function ReleaseOpsDocOverviewPage() {
  return (
    <>
      <DocHeader
        kicker="ReleaseOps"
        title="ReleaseOps overview."
        summary="ReleaseOps is the AI-native deployment governance and release intelligence layer of the Axiom platform. It coordinates above GitHub, GitLab, Azure DevOps, Jenkins, Terraform, Kubernetes, and ServiceNow — it does not replace any of them."
      />

      <Callout variant="safe" title="The principle">
        Above. Never instead. ReleaseOps adds operational intelligence to the release ecosystem you already have. Every release still ships through your existing pipelines; ReleaseOps adds the governance layer on top.
      </Callout>

      <DocSection id="what" title="What ReleaseOps is" kicker="01">
        <p>An operational intelligence + deployment governance layer that:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Ingests release telemetry from connected CI/CD systems (read-only)</li>
          <li>Builds an operational release graph: services, pipelines, environments, approvals, dependencies</li>
          <li>Scores every service on 9 release-readiness dimensions</li>
          <li>Surfaces operational risk before it becomes an incident</li>
          <li>Optionally orchestrates approval-gated deployments through your existing pipelines</li>
          <li>Records every release, approval, deployment, and rollback in the same audit fabric as the cloud ops side</li>
        </ul>
      </DocSection>

      <DocSection id="positioning" title="How it positions vs. existing tools" kicker="02 · Above. Never instead.">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>GitHub Actions / GitLab CI / Azure DevOps / Jenkins</strong> — execute. ReleaseOps ingests their telemetry and scores the operational maturity of each pipeline.</li>
          <li><strong>Terraform / OpenTofu</strong> — declare infrastructure. ReleaseOps governs the plans surfaced in CI, classifies risk before merge, blocks drift-amplifying changes at the gate.</li>
          <li><strong>Kubernetes / ArgoCD</strong> — orchestrate runtime. ReleaseOps tracks ArgoCD application sync state as a release event and correlates with cloud topology.</li>
          <li><strong>ServiceNow / change management</strong> — track approvals. ReleaseOps auto-creates Change Requests with risk justification and rollback strategy attached.</li>
          <li><strong>PagerDuty / Slack / status pages</strong> — communicate. ReleaseOps can orchestrate release-event communication through these systems.</li>
        </ul>
      </DocSection>

      <DocSection id="fits-in" title="How ReleaseOps fits inside Axiom" kicker="03 · Platform integration">
        <p>ReleaseOps shares core platform infrastructure with cloud ops:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Same reasoning engine</strong> — the 12-step cognitive loop applies to releases as well as cloud findings</li>
          <li><strong>Same operational memory</strong> — release outcomes feed the same confidence-calibration system</li>
          <li><strong>Same topology graph</strong> — releases overlay onto the live infrastructure topology, showing what each deploy targets</li>
          <li><strong>Same approval center</strong> — release approvals route through the same gate model as cloud ops approvals</li>
          <li><strong>Same audit fabric</strong> — every release event lives in <code>AxiomAuditEvent</code> alongside cloud audit events</li>
        </ul>
      </DocSection>

      <DocSection id="capabilities" title="What ReleaseOps delivers" kicker="04 · Capabilities">
        <p>12 operational capabilities, all live in the ReleaseOps Command Center at <Link href="/dashboard/releaseops" className="text-violet-300 hover:text-violet-200">/dashboard/releaseops</Link>:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Deployment ecosystem mapping</li>
          <li>Release readiness scoring (composite + 9 dimensions per service)</li>
          <li>Operational risk analysis (per release)</li>
          <li>Approval orchestration</li>
          <li>Drift detection (pipeline + runtime config)</li>
          <li>Terraform governance</li>
          <li>Rollback readiness tracking</li>
          <li>Deployment dependency visibility</li>
          <li>Release communication orchestration</li>
          <li>Executive operational visibility</li>
          <li>Audit intelligence</li>
          <li>Operational memory for releases</li>
        </ul>
      </DocSection>

      <DocSection id="next" title="Next steps" kicker="05">
        <ul className="space-y-2">
          <li>
            <Link href="/docs/releaseops/connectors" className="text-violet-300 hover:text-violet-200 font-medium">→ CI/CD connectors</Link>
            <span className="text-zinc-500"> · what each connector reads and how to authorize</span>
          </li>
          <li>
            <Link href="/docs/releaseops/readiness" className="text-violet-300 hover:text-violet-200 font-medium">→ Readiness scoring</Link>
            <span className="text-zinc-500"> · the 9 dimensions, how scores are computed, and how to improve them</span>
          </li>
          <li>
            <Link href="/axiom/releaseops" className="text-violet-300 hover:text-violet-200 font-medium">→ Marketing page</Link>
            <span className="text-zinc-500"> · the full ReleaseOps story for stakeholders</span>
          </li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What is ReleaseOps?", answer: "An operational intelligence and deployment governance layer that runs above your existing CI/CD systems." },
            { question: "Why is it needed?", answer: "Modern release surfaces are fragmented across many systems. ReleaseOps adds the operational intelligence layer those systems don't ship with." },
            { question: "Is it safe?", answer: "Yes — observation-only by default. Orchestration is opt-in and always goes through your existing pipelines, never bypassing them." },
            { question: "What is stored?", answer: "Release telemetry, readiness scores, approval events, audit trail. Never source code, never secrets, never credentials." },
            { question: "What happens after we connect?", answer: "ReleaseOps starts mapping your release graph and scoring services. First full readiness report typically available within 24 hours." },
            { question: "How is it different from a CI/CD tool?", answer: "It doesn't execute deployments — it governs and reasons about them. The operational intelligence above your pipelines." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/rollback", label: "Rollback strategy" }}
        next={{ href: "/docs/releaseops/connectors", label: "CI/CD connectors" }}
      />
      <DocFeedback />
    </>
  );
}
