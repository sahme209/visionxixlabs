import type { Metadata } from "next";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Permissions model — Axiom Documentation",
  description: "The released workspace, GitHub, AI provider, approval, and AWS ECS permission boundaries in Axiom.",
};

export default function PermissionsModelPage() {
  return (
    <>
      <DocHeader
        kicker="Trust · Permissions"
        title="Each capability has its own authority boundary."
        summary="Signing in, reading a repository, proposing a write, approving it, and deploying are separate permissions. Axiom does not treat one successful connection as authority for everything else."
      />

      <Callout variant="safe" title="Fail closed">
        Desktop APIs resolve a bearer-token desktop session. GitHub tokens are tenant- and repository-scoped. AI requires both available credit and explicit workspace provider policy. Writes require an authorized approval path.
      </Callout>

      <DocSection id="roles" title="Workspace roles" kicker="01">
        <p>Workspace membership establishes the tenant boundary. Administrator-only actions—such as approving Agent writes and managing sensitive configuration—are checked again at the server route that performs the action.</p>
      </DocSection>

      <DocSection id="github" title="GitHub repository scope" kicker="02">
        <p>The GitHub App installation determines which repositories are available. For a repository action, the service mints a short-lived token scoped to the selected repository rather than reusing a broad user token.</p>
      </DocSection>

      <DocSection id="agent" title="Agent authority" kicker="03">
        <p>The decision loop may execute registered low-risk reads. Medium- and high-risk tools create proposals. The approval responder—not the model—invokes the real write after an authorized administrator approves it.</p>
      </DocSection>

      <DocSection id="aws" title="AWS ECS authority" kicker="04">
        <p>Axiom dispatches the tenant workflow; GitHub Actions OIDC assumes the environment&apos;s configured AWS role. AWS permissions therefore remain constrained by both the GitHub trust subject and the role policy.</p>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid items={[
          { question: "Does sign-in grant GitHub write?", answer: "No. GitHub installation, repository scope, role checks, and approval are separate." },
          { question: "Can the model approve itself?", answer: "No. The model only returns a decision; approval is an authenticated administrator action." },
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
