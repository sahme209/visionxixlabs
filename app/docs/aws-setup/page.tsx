import type { Metadata } from "next";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "AWS ECS setup — Axiom Documentation",
  description: "Configure Axiom's released AWS ECS deployment path using a tenant-owned GitHub Actions workflow and OIDC role.",
};

export default function AwsSetupPage() {
  return (
    <>
      <DocHeader
        kicker="Delivery · AWS ECS"
        title="Deploy through your workflow and your AWS role."
        summary="Axiom dispatches a workflow in the selected GitHub repository. GitHub Actions uses OIDC to assume the AWS role configured for the selected environment."
      />

      <Callout variant="safe" title="No AWS access key in Axiom">
        The released deployment path does not ask the desktop app to store an AWS access key. The tenant-owned workflow exchanges its GitHub OIDC identity for short-lived AWS credentials.
      </Callout>

      <DocSection id="prepare" title="Prepare the repository" kicker="01">
        <p>Add the supported <code>.github/workflows/axiom-deploy-aws-ecs.yml</code> workflow to the repository selected in Axiom. Limit <code>workflow_dispatch</code> inputs and GitHub environment access to the values your team intends to permit.</p>
      </DocSection>

      <DocSection id="role" title="Create the OIDC trust boundary" kicker="02">
        <p>Create an AWS role whose trust policy accepts the intended GitHub organization, repository, branch or environment. Grant only the ECS and task-definition permissions required by the workflow. Do not use a wildcard repository subject for convenience.</p>
      </DocSection>

      <DocSection id="target" title="Map an Axiom environment" kicker="03">
        <p>In the desktop app, create or select an environment and configure its AWS region, ECS cluster, ECS service, and role ARN. The selected environment becomes the deployment target; production context is treated as high risk.</p>
      </DocSection>

      <DocSection id="validate" title="Validate before production" kicker="04">
        <p>Run the workflow against a non-production ECS service first. Confirm repository scope, role trust, task-definition capture, steady-state validation, rollback behavior, and the resulting action record before enabling the production target.</p>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid items={[
          { question: "Where does deployment run?", answer: "Inside the tenant-owned GitHub Actions workflow." },
          { question: "Where are AWS credentials stored?", answer: "The released path uses GitHub Actions OIDC and short-lived role credentials." },
          { question: "Can the Agent deploy immediately?", answer: "No. Triggering a deployment is a high-risk proposal that requires administrator approval." },
          { question: "What is selected in Axiom?", answer: "Repository, branch, environment, region, cluster, service, and role-backed target." },
          { question: "What proves success?", answer: "The workflow waits for the ECS service to reach steady state." },
          { question: "What happens on failure?", answer: "The workflow restores the task definition captured before deployment." },
        ]} />
      </DocSection>

      <DocFooterNav prev={{ href: "/docs/integration-setup", label: "Integration setup" }} next={{ href: "/docs/approval-workflow", label: "Approval workflow" }} />
      <DocFeedback />
    </>
  );
}
