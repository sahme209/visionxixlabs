import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Integration boundaries — ReleaseOps Documentation",
  description: "The integrations Axiom can currently govern, their minimum access boundaries, and the controls required before a connection is treated as active.",
};

const CONNECTORS = [
  {
    name: "GitHub",
    auth: "GitHub App installation for selected repositories",
    reads: ["Selected repository metadata", "Release evidence configured for a deployment request", "A harmless read-only validation after installation"],
    notReads: ["Repository secrets or Actions secret values", "Credentials or private keys", "Write access to repositories, pull requests, workflows, or deployments"],
    notes: "An installation is not shown as validated until Axiom completes its scoped, read-only check. A workspace owner can stop Axiom from using the recorded installation; removing the GitHub App remains a GitHub-side action.",
  },
  {
    name: "Slack",
    auth: "Browser OAuth, only when an Axiom-managed Slack app is configured",
    reads: ["The minimum workspace context needed to validate the consent", "Only the scopes shown before consent"],
    notReads: ["Slack passwords", "Unrelated workspace data", "A connection status inferred only from a browser return"],
    notes: "Consent is tenant-bound, one-time, encrypted at rest, and starts as awaiting validation. Messaging is not represented as active until a live validation succeeds.",
  },
  {
    name: "Microsoft identity",
    auth: "OAuth with PKCE, only when an Axiom-managed Microsoft app is configured",
    reads: ["Basic identity needed to verify consent", "Only the consented scope shown in the Microsoft authorization flow"],
    notReads: ["Microsoft or Teams passwords", "Teams messages or files by default", "An active connection without server-side validation"],
    notes: "The PKCE verifier and returned credential are encrypted and bound to one tenant and one callback. Teams messaging is not yet a live Axiom capability.",
  },
  {
    name: "Other delivery systems",
    auth: "Not connected",
    reads: ["Nothing until Axiom publishes and validates a dedicated, least-privilege connector"],
    notReads: ["GitLab, Azure DevOps, Jenkins, Argo CD, ServiceNow, CI/CD, observability, or ticketing credentials"],
    notes: "These systems may be evaluated where they reduce release handoffs or improve evidence, but are not represented as available integrations today.",
  },
];

export default function ReleaseOpsConnectorsPage() {
  return (
    <>
      <DocHeader
        kicker="ReleaseOps · Connectors"
        title="Integration boundaries."
        summary="What Axiom can currently connect, what each connection is allowed to see, and the checks required before it is treated as active."
      />

      <Callout variant="safe" title="The model: consent is not proof">
        A browser return or stored credential never makes an integration look healthy by itself. Axiom binds consent to a tenant, expires and consumes it once, encrypts service credentials, and requires a server-side validation before marking a connection active. Browser pages never receive provider credentials.
      </Callout>

      {CONNECTORS.map((c) => (
        <DocSection key={c.name} id={c.name.toLowerCase().replace(/\s+/g, "-")} title={c.name}>
          <ul className="space-y-1.5 text-sm text-zinc-400">
            <li><strong className="text-zinc-300">Auth method:</strong> {c.auth}</li>
          </ul>
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 p-4">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-2">What Axiom reads</p>
              <ul className="text-xs text-zinc-300 space-y-1">
                {c.reads.map((r) => <li key={r}>· {r}</li>)}
              </ul>
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">What Axiom does NOT read</p>
              <ul className="text-xs text-zinc-400 space-y-1">
                {c.notReads.map((r) => <li key={r}>· {r}</li>)}
              </ul>
            </div>
          </div>
          <p className="text-xs text-zinc-500 italic mt-3">{c.notes}</p>
        </DocSection>
      ))}

      <DocSection id="rotation" title="Revocation and revalidation">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Workspace owners can revoke Axiom&apos;s recorded use of a connection from the governed connection record.</li>
          <li>Provider-side removal remains the source of truth: remove the GitHub App or revoke the OAuth grant in the provider when access must end there too.</li>
          <li>Validation timestamps distinguish a recorded consent from an active, reachable integration.</li>
          <li>Do not treat a webhook, browser success screen, or cached status as proof of a live connection.</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What does Axiom access?", answer: "Only the minimum provider facts named above, after a workspace owner starts a scoped consent flow. The initial GitHub release-evidence path is read-only." },
            { question: "Where are provider credentials handled?", answer: "On Axiom's service boundary, encrypted at rest. They are not returned to the browser or written into release evidence." },
            { question: "Is Axiom certified for regulated environments?", answer: "No certification is implied here. Regulated use needs your own risk review, agreements, identity controls, retention policy, and independently verified evidence." },
            { question: "Can access be revoked?", answer: "Yes. Stop Axiom's recorded use from the workspace and revoke the provider-side grant or App installation when access must end at the provider too." },
            { question: "Which other tools are supported?", answer: "No other delivery-system connection is claimed here until it has a dedicated consent lifecycle, least-privilege scope, validation, revocation, and audit path." },
            { question: "What happens when validation fails?", answer: "Axiom must show the connection as needing attention or awaiting validation—not as connected—and avoid treating its data as current release evidence." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/releaseops", label: "ReleaseOps overview" }}
        next={{ href: "/docs/releaseops/readiness", label: "Readiness scoring" }}
      />
      <DocFeedback />
    </>
  );
}
