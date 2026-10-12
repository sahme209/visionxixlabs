import type { Metadata } from "next";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "AWS ECS rollback — Axiom Documentation",
  description: "The verified rollback boundary in Axiom's tenant-owned AWS ECS deployment workflow.",
};

export default function RollbackPage() {
  return (
    <>
      <DocHeader
        kicker="Delivery · Recovery"
        title="Rollback is specific to the execution path."
        summary="The released automatic rollback applies to the AWS ECS workflow. Axiom does not claim a universal rollback engine for every provider or resource type."
      />

      <Callout variant="safe" title="Verified ECS behavior">
        Before updating the service, the workflow captures the current task definition. If the new deployment does not reach ECS steady state, the workflow updates the service back to that captured definition and waits again.
      </Callout>

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
