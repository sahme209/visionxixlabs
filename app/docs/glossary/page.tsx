import type { Metadata } from "next";
import { DocHeader, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Glossary — Axiom Documentation",
  description: "Definitions for terms used throughout Axiom Agent — operational, AI, cloud, and ReleaseOps vocabulary.",
};

const GLOSSARY: { term: string; def: string }[] = [
  { term: "Action proposal", def: "A persisted request for an agent tool call. Low-risk reads can complete inline; medium- and high-risk writes wait for an explicit administrator decision." },
  { term: "Approval gate", def: "The server-side boundary that prevents a proposed write from executing until an authorized workspace administrator approves it." },
  { term: "Audit record", def: "The stored record of a tool call, including the requested action, risk, status, actor, and outcome. Audit evidence is not an independent compliance certification." },
  { term: "Conversation", def: "A workspace-scoped Agent thread whose messages preserve the context for a sequence of governed requests." },
  { term: "Deployment target", def: "The configuration that maps an Axiom environment to an AWS region, ECS cluster, ECS service, and OIDC role." },
  { term: "Environment", def: "A named workspace tier such as development, test, or production. Targeting production raises the risk of write actions; it never lowers it." },
  { term: "GitHub App installation", def: "The GitHub authorization boundary used to discover repositories and mint a short-lived token scoped to one selected repository." },
  { term: "Governed AI call", def: "An AI request allowed only after the workspace passes both the AI-credit check and provider-policy check. Both checks fail closed." },
  { term: "OIDC", def: "The short-lived identity exchange used by the tenant's GitHub Actions workflow to assume its configured AWS role without storing an AWS access key in Axiom." },
  { term: "Provider policy", def: "Workspace configuration that determines whether AI is enabled and which configured providers and models may be used." },
  { term: "Repository scope", def: "The rule that GitHub credentials are minted for one selected repository rather than exposing a broad organization token to an action." },
  { term: "Rollback", def: "For the released ECS workflow, restoration of the task definition captured before deployment when the new service does not reach steady state." },
  { term: "SCIM lifecycle preview", def: "A safe preview of proposed identity lifecycle effects. It does not perform live provisioning or prove that enterprise sign-in is active." },
  { term: "Steady state", def: "The ECS service condition the deployment workflow waits for before reporting success. Failure triggers the workflow's rollback path." },
  { term: "Workflow dispatch", def: "The GitHub API action that starts the tenant-owned Axiom ECS deployment workflow with the selected environment and target configuration." },
];

export default function GlossaryPage() {
  return (
    <>
      <DocHeader
        kicker="Reference · Glossary"
        title="Glossary."
        summary="Definitions for vocabulary used across the Axiom platform — operational, AI, cloud, and ReleaseOps terms."
      />

      <dl className="grid sm:grid-cols-2 gap-3">
        {GLOSSARY.map((entry) => (
          <div key={entry.term} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <dt className="text-sm font-bold text-white mb-1">{entry.term}</dt>
            <dd className="text-xs text-zinc-400 leading-relaxed">{entry.def}</dd>
          </div>
        ))}
      </dl>

      <DocFooterNav
        prev={{ href: "/docs/faq", label: "FAQ" }}
      />
      <DocFeedback />
    </>
  );
}
