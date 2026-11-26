import type { Metadata } from "next";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid, DocFigure } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "AWS ECS rollback — V19 Documentation",
  description: "The verified rollback boundary in V19's tenant-owned AWS ECS deployment workflow.",
};

export default function RollbackPage() {
  return (
    <>
      <DocHeader
        kicker="Delivery · Recovery"
        title="Rollback is specific to the execution path."
        summary="The released automatic rollback applies to the AWS ECS workflow. V19 does not claim a universal rollback engine for every provider or resource type."
      />

      <Callout variant="safe" title="Verified ECS behavior">
        Before updating the service, the workflow captures the current task definition. If the new deployment does not reach ECS steady state, the workflow updates the service back to that captured definition and waits again.
      </Callout>

      <DocFigure src="/docs/desktop/deployments.webp" alt="The Deployments lifecycle in the V19 desktop app" caption="The lifecycle shows Verify and recovery as recorded steps; rollback availability comes from the saved release. Synthetic example records." width={1600} height={1067} />
      <DocSection id="sequence" title="The recovery sequence" kicker="01">
        <ol className="list-inside list-decimal space-y-1.5 text-zinc-400">
          <li>Resolve and record the task definition currently serving the target.</li>
          <li>Register or select the requested task definition and update the ECS service.</li>
          <li>Use ECS&apos;s own steady-state waiter as the deployment health boundary.</li>
          <li>On stabilization failure, restore the captured task definition.</li>
          <li>Wait for the restored service and preserve the workflow result as evidence.</li>
        </ol>
      </DocSection>

      <DocSection id="limits" title="Limits" kicker="02">
        <p>This path restores the ECS task definition. It does not undo database migrations, external side effects, incompatible data changes, or changes made outside the workflow. Teams must keep application-level recovery steps in their own release procedure.</p>
      </DocSection>

      <DocSection id="rollback-last-good" title="Roll back to the last good version" kicker="03">
        <p>In the desktop deploy form, after you choose a repository, V19 shows the last good version for that environment: the most recent successful deployment of a different commit than the one now running, or the last success if the latest attempt failed. Choose <em>Prepare rollback to this version</em> to fill the form with its tag or branch. A rollback is an ordinary deployment, so policy, checks, rings, change window and approvals still apply.</p>
        <p>A tag always points to the same commit. A branch may have moved since, so check readiness first: the form confirms when readiness resolves the same commit, and warns when the branch has moved. If it has, use a tag for that commit instead.</p>
        <p>After a deployment, <em>Check release health</em> reads your connected tools. When the verdict is <strong>Unhealthy</strong> and a last good version is recorded, the panel offers <em>Prepare rollback</em> to that commit. It fills the deploy form the same way; nothing is dispatched until you check readiness and deploy, and every gate still applies.</p>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid items={[
          { question: "Is rollback automatic?", answer: "For the released ECS workflow, yes—when the service fails to stabilize." },
          { question: "What is restored?", answer: "The task definition serving the ECS service before the update." },
          { question: "Does it reverse a database migration?", answer: "No. Application and data recovery remain separate responsibilities." },
          { question: "Where does recovery run?", answer: "Inside the same OIDC-authenticated tenant workflow." },
          { question: "Does approval guarantee success?", answer: "No. Approval authorizes the attempt; ECS validation determines the outcome." },
          { question: "Are other providers covered?", answer: "No universal Azure or GCP rollback path is released." },
        ]} />
      </DocSection>

      <DocFooterNav prev={{ href: "/docs/approval-workflow", label: "Approval workflow" }} next={{ href: "/docs/releaseops", label: "ReleaseOps overview" }} />
      <DocFeedback />
    </>
  );
}
