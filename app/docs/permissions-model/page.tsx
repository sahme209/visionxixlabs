import type { Metadata } from "next";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid } from "@/components/docs/DocPrimitives";
import { PipeFlow } from "@/components/marketing/pipeKit/PipeFlow";
import { PERMISSIONS_FLOW_STAGES } from "@/lib/marketing/permissionsFlowModel";

export const metadata: Metadata = {
  title: "Permissions model — Axiom Documentation",
  description: "Workspace, GitHub, AI provider, approval, and AWS ECS permission boundaries in Axiom.",
};

export default function PermissionsModelPage() {
  return (
    <>
      <DocHeader
        kicker="Trust · Permissions"
        title="Each capability has its own authority boundary."
        summary="Signing in, reading a repository, proposing a write, approving it, and deploying are separate permissions. Axiom does not treat one successful connection as authority for everything else."
      />

      <Callout title="Preview workflow reference">
        Separate requester execution is a local preview and is not production-activated. Your installed version may not include an Execute control. Check the controls and release guidance for your installed version; approval status alone does not prove that an action ran.
      </Callout>

      <Callout variant="safe" title="Fail closed">
        Desktop APIs resolve a bearer-token desktop session. GitHub tokens are tenant- and repository-scoped. AI requires both available credit and explicit workspace provider policy. Write permissions and approval requirements depend on the supported workflow. Review the action’s required capabilities and approval state before execution.
      </Callout>

      <section aria-labelledby="permissions-flow" className="my-10">
        <h2 id="permissions-flow" className="text-xl font-medium text-zinc-100">The boundaries a request crosses</h2>
        <p className="mt-2 text-[15px] leading-7 text-zinc-400">Each stage is its own permission. Passing one never grants the next.</p>
        <div className="mt-6"><PipeFlow stages={PERMISSIONS_FLOW_STAGES} label="The boundaries a request crosses" /></div>
      </section>

      <DocSection id="roles" title="Workspace roles" kicker="01">
        <p>Workspace membership establishes the tenant boundary. Each supported action checks its required capability at the server; approval authority is distinct from permission to execute.</p>
      </DocSection>

      <DocSection id="github" title="GitHub repository scope" kicker="02">
        <p>The GitHub App installation determines which repositories are available. For a repository action, the service mints a short-lived token scoped to the selected repository rather than reusing a broad user token.</p>
      </DocSection>

      <DocSection id="agent" title="Agent authority" kicker="03">
        <p>The decision loop may execute registered low-risk reads. Medium- and high-risk tools create proposals. In the separate-execution preview, an authorized independent reviewer records the decision, then the original requester uses Execute when the action is supported and current checks pass. An approval record is not evidence that a provider action ran.</p>
      </DocSection>

      <DocSection id="aws" title="AWS ECS authority" kicker="04">
        <p>Axiom dispatches the tenant workflow; GitHub Actions OIDC assumes the environment&apos;s configured AWS role. AWS permissions therefore remain constrained by both the GitHub trust subject and the role policy.</p>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid items={[
          { question: "Does sign-in grant GitHub write?", answer: "No. GitHub installation, repository scope, role checks, and approval are separate." },
          { question: "Can the model approve itself?", answer: "No. The model may recommend a decision; an authorized independent human reviewer must record approval." },
          { question: "Is AI on by default?", answer: "No. Workspace provider policy is opt-in and fails closed." },
          { question: "Does Axiom store an AWS access key?", answer: "Not for the released ECS path. The tenant workflow uses OIDC." },
          { question: "Can risk be lowered by context?", answer: "No. Context can only escalate a tool's baseline risk." },
          { question: "Are identity providers active after configuration?", answer: "No. They remain pending until a real identity flow is implemented and verified." },
        ]} />
      </DocSection>

      <DocFooterNav prev={{ href: "/docs/security-model", label: "Security model" }} next={{ href: "/docs/approval-workflow", label: "Approval workflow" }} />
      <DocFeedback />
    </>
  );
}
