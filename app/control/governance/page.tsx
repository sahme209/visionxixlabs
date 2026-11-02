import { redirect } from "next/navigation";

import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { pullRequestProposalReview } from "@/lib/cockpit/pullRequestProposalReview";
import { fileProposalReview } from "@/lib/cockpit/fileProposalReview";
import { ProposalFileDiff } from "@/components/cockpit/ProposalFileDiff";
import { ApprovalDecisionButtons } from "./ApprovalDecisionButtons";

export default async function GovernancePage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/governance");
  if (!context.roles.length) return <p role="alert" className="text-sm text-zinc-300">A current workspace membership is required. Refresh to verify access.</p>;
  const organizationId = String(context.organizationId);
  const [members, environments, proposals] = await Promise.all([
    prisma.orgMembership.groupBy({ by: ["role"], where: { organizationId, acceptedAt: { not: null } }, _count: { _all: true } }),
    prisma.environment.findMany({ where: { organizationId }, select: { id: true, name: true, slug: true, tier: true, approvalPolicyId: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
    prisma.agentActionProposal.findMany({ where: { organizationId, status: "proposed" }, select: { id: true, toolName: true, argsJson: true, riskLevel: true, createdAt: true, approvalExpiresAt: true, actionDigest: true, proposedByUserId: true }, orderBy: { createdAt: "asc" }, take: 20 }),
  ]);
  const canDecide = canDecideApprovals({ email: context.email, roles: context.roles });
  const reviewTime = new Date();
  const unavailable = proposals.filter(p => !p.actionDigest || p.approvalExpiresAt && p.approvalExpiresAt <= reviewTime).length;
  const own = proposals.filter(p => p.proposedByUserId === String(context.userId)).length;

  return (
    <div className="w-full min-w-0">

      <h1 className="text-2xl font-medium">Governance</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Review pending Agent actions, workspace roles, and environment policies.</p>

      <section aria-label="Governance next step" className="mt-6 rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Your next step</p>
        <h2 className="mt-1 text-sm font-medium">{proposals.length ? "Review each exact pending action" : "No pending Agent decisions"}</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-400">{canDecide ? "Inspect the target, content and current review below before deciding. Each action needs its own independent decision." : "An authorized independent reviewer handles the decisions below. You can inspect workspace roles and environment policies."}</p>
        {unavailable > 0 && <p role="status" className="mt-3 text-xs leading-5 text-amber-300">{unavailable} displayed {unavailable === 1 ? "proposal has" : "proposals have"} expired or lack an integrity binding. Request a fresh proposal; an old approval cannot restore it.</p>}
        {own > 0 && <p className="mt-2 text-xs leading-5 text-zinc-400">{own} displayed {own === 1 ? "proposal is" : "proposals are"} yours and must be decided by a different authorized reviewer.</p>}
        <details className="mt-3 text-xs leading-5 text-zinc-400"><summary className="cursor-pointer py-1">After a decision</summary><p className="mt-2">Approval can execute the exact Agent action shown below. Check its saved result before treating it as complete. If the outcome is uncertain, inspect its history before preparing another action; approval alone is not proof of success.</p><p className="mt-2">This inbox shows up to 20 pending Agent actions. Release, ticket and connected-app reviews remain in their exact workflows; this is not a complete approval or outcome history.</p></details>
      </section>

      <section className="mt-10 border-t border-white/[0.08] py-7">
        <h2 className="text-base font-medium">Pending approvals</h2>
        {proposals.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No Agent actions currently await approval.</p>
        ) : (
          <div className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {proposals.map((proposal) => {
              const args = proposal.argsJson && typeof proposal.argsJson === "object" && !Array.isArray(proposal.argsJson) ? proposal.argsJson as Record<string, unknown> : {};
              const review = args._review && typeof args._review === "object" && !Array.isArray(args._review) ? args._review as Record<string, unknown> : null;
              const isFileWrite = proposal.toolName === "commit_github_file" || proposal.toolName === "commit_github_files";
              const fileReview = fileProposalReview(proposal.toolName, args);
              const isPullRequest = proposal.toolName === "open_github_pull_request";
              const pullReview = isPullRequest ? pullRequestProposalReview(args) : null;
              return (
              <div key={proposal.id} className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                <div className={isFileWrite || isPullRequest ? "min-w-0 md:col-span-3" : "min-w-0"}><p className="text-sm text-zinc-200">{proposal.toolName.replaceAll("_", " ")}</p><p className="mt-1 font-mono text-[11px] text-zinc-600">{proposal.id}</p>
                  {isFileWrite && (fileReview ? <details className="mt-3 min-w-0 text-xs text-zinc-400">
                    <summary className="cursor-pointer text-zinc-200">Review file changes</summary>
                    <p className="mt-3 break-all">Repository: {fileReview.repository} · Branch: {fileReview.branch}</p>
                    <p className="mt-2 text-zinc-300">{fileReview.message}</p>
                    <p className="mt-2">Approval records your decision only. The requester must execute this exact proposal separately. Tests have not been run by this review screen.</p>
                    <div className="mt-4 space-y-5">{fileReview.files.map(file => <section key={file.path} className="min-w-0">
                      <h3 className="mb-2 break-all font-mono text-zinc-200">{file.path}</h3>
                      <p className="mb-2 break-all text-[10px] text-zinc-500">Reviewed base: {file.baseSha ?? "New file"}</p>
                      <ProposalFileDiff before={file.before} after={file.after} label={`Proposed diff for ${file.path}`} />
                    </section>)}</div>
                  </details> : <p role="alert" className="mt-3 text-amber-300">File review is unavailable. Request a new proposal before approval.</p>)}
                  {isPullRequest && (pullReview ? <details className="mt-3 min-w-0 text-xs text-zinc-400">
                    <summary className="cursor-pointer text-zinc-200">Review pull request</summary>
                    <p className="mt-3 break-all">Repository: {pullReview.repository}</p>
                    <p className="mt-1 break-all">Head: {pullReview.head}</p><p className="mt-1 break-all">Base: {pullReview.base}</p>
                    <p className="mt-2 break-words text-zinc-200">{pullReview.title}</p>
                    <p className="mt-2 whitespace-pre-wrap break-words">{pullReview.body || "No description provided."}</p>
                    <p className="mt-2">Approval records your decision only; it does not open, merge or deploy this pull request. The requester must execute separately after current access and source checks. Branch contents can change; inspect the current changes on GitHub before approving.</p>
                  </details> : <p role="alert" className="mt-3 text-amber-300">Pull request review is unavailable. Request a new proposal before approval.</p>)}
                  {proposal.toolName === "trigger_aws_deploy" && <div className="mt-3 space-y-1 break-all text-xs text-zinc-400">
                    <p className="text-amber-300">Restart existing task definition only; no source release or artifact promotion.</p>
                    <p>Repository: {typeof args.repositoryFullName === "string" ? args.repositoryFullName : "Unavailable"} · Workflow ref: {typeof args.sourceRef === "string" ? args.sourceRef : "main"}</p>
                    {review?.kind === "ecs_restart_target" ? [["Environment", review.environmentId], ["Tier", review.environmentTier], ["Role", review.roleArn], ["Region", review.region], ["Cluster", review.ecsCluster], ["Service", review.ecsService], ["Target revision", review.targetUpdatedAt]].map(([label, value]) => <p key={String(label)}>{String(label)}: {typeof value === "string" ? value : "Unavailable"}</p>) : <p>No target review is bound. Request a new proposal.</p>}
                  </div>}
                </div>
                <div className="text-left sm:text-right"><p className="text-xs uppercase tracking-[0.12em] text-[#ff783d]">{proposal.riskLevel} risk</p><time className="mt-1 block text-xs text-zinc-600">{proposal.createdAt.toLocaleString()}</time></div>
                <ApprovalDecisionButtons proposalId={proposal.id} ownProposal={proposal.proposedByUserId === String(context.userId)} approveDisabledReason={isPullRequest && !pullReview ? "Pull request review is unavailable. Request a new proposal before approval." : isFileWrite && !fileReview ? "File review is unavailable. Request a new proposal before approval." : proposal.toolName === "trigger_aws_deploy" && review?.kind !== "ecs_restart_target" ? "No bound target review. Request a new proposal before approval; rejection remains available." : undefined} disabledReason={!canDecide ? "An authorized approver role is required." : !proposal.actionDigest ? "This legacy proposal has no integrity binding and cannot be decided in the browser." : proposal.approvalExpiresAt && proposal.approvalExpiresAt <= new Date() ? "This proposal has expired." : undefined} />
              </div>
            ); })}
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-zinc-600">Approvals are bound to the exact action, expire after 24 hours, require a separate authorized reviewer, and are claimed once before backend execution.</p>
      </section>

      <section className="border-t border-white/[0.08] py-7">
        <h2 className="text-base font-medium">Organization roles</h2>
        {members.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No accepted organization memberships were found.</p> : (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{members.map((entry) => <div key={entry.role} className="rounded-xl border border-white/[0.08] bg-[#171717] p-4"><dt className="text-xs capitalize text-zinc-500">{entry.role.replaceAll("_", " ")}</dt><dd className="mt-2 text-xl tabular-nums">{entry._count._all}</dd></div>)}</dl>
        )}
      </section>

      <section className="border-t border-white/[0.08] py-7">
        <h2 className="text-base font-medium">Environment policy posture</h2>
        {environments.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No environments are configured. Environment creation remains in its current verified flow during migration.</p> : (
          <div className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">{environments.map((environment) => <div key={environment.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm">{environment.name}</p><p className="mt-1 font-mono text-[11px] text-zinc-600">{environment.slug}</p></div><div className="text-right"><p className="text-xs uppercase tracking-[0.12em] text-zinc-400">{environment.tier}</p><p className="mt-1 text-xs text-zinc-600">{environment.approvalPolicyId ? "Approval policy assigned" : "No approval policy assigned"}</p></div></div>)}</div>
        )}
      </section>
    </div>
  );
}
