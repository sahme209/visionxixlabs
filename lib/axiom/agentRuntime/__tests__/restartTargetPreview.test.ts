import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ proposals: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }), redirect: () => { throw new Error("unexpected redirect"); } }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org-1", userId: "reviewer", email: "reviewer@example.test", roles: ["admin"] }) }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { groupBy: async () => [] }, environment: { findMany: async () => [] }, agentActionProposal: { findMany: mocks.proposals } } }));
import { ProposalCard } from "@/desktop/src/views/AgentChatView";
import GovernancePage from "@/app/control/governance/page";
const review = { kind: "ecs_restart_target", environmentId: "env-prod", environmentTier: "prod", roleArn: "arn:aws:iam::123456789012:role/restart", region: "us-east-1", ecsCluster: "actual-cluster", ecsService: "actual-service", targetUpdatedAt: "2026-10-16T00:00:00.000Z" };
const proposal = { id: "proposal", toolName: "trigger_aws_deploy", argsJson: { environmentId: "env-prod", _review: review }, riskLevel: "high", status: "proposed", proposedByUserId: "author", actionDigest: "digest", createdAt: new Date(), approvalExpiresAt: new Date(Date.now() + 60000) };
describe("real ECS approval target previews", () => {
  it("desktop displays bound target before expanding details and distinguishes restart", () => {
    const html = renderToStaticMarkup(createElement(ProposalCard, { proposal: { ...proposal, createdAt: proposal.createdAt.toISOString() }, deciding: false, onApprove() {}, onReject() {} }));
    for (const value of ["actual-cluster", "actual-service", "us-east-1", review.roleArn, "no source release or image promotion"]) expect(html).toContain(value);
  });
  it("desktop identifies historical proposals lacking reviewed target", () => {
    const html = renderToStaticMarkup(createElement(ProposalCard, { proposal: { ...proposal, createdAt: proposal.createdAt.toISOString(), argsJson: { environmentId: "env-prod" } }, deciding: false, onApprove() {}, onReject() {} }));
    expect(html).toContain("this historical proposal cannot execute");
  });
  it("browser queries and displays the same persisted target evidence before approval", async () => {
    mocks.proposals.mockResolvedValue([proposal]);
    const html = renderToStaticMarkup(await GovernancePage());
    expect(mocks.proposals).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ argsJson: true }) }));
    for (const value of ["actual-cluster", "actual-service", "us-east-1", review.roleArn, "no source release or artifact promotion"]) expect(html).toContain(value);
  });
  it("browser missing target evidence disables approval while keeping rejection available", async () => {
    mocks.proposals.mockResolvedValue([{ ...proposal, argsJson: { environmentId: "env-prod" } }]);
    const html = renderToStaticMarkup(await GovernancePage());
    const reject = html.match(/<button[^>]*>Reject<\/button>/)?.[0];
    const approve = html.match(/<button[^>]*>Record approval<\/button>/)?.[0];
    expect(reject).toBeDefined(); expect(reject).not.toContain('disabled=""');
    expect(approve).toContain('disabled=""'); expect(html).toContain("rejection remains available");
  });

});


describe("reviewed branch source previews", () => {
  const args = { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "reviewed", _review: { kind: "github_branch", baseBranch: "main", newBranchName: "reviewed", baseSha: "a".repeat(40) } };
  const branch = { ...proposal, toolName: "create_github_branch", argsJson: args };
  it("native shows the exact captured commit before expanding details", () => {
    const html=renderToStaticMarkup(createElement(ProposalCard,{proposal:{...branch,createdAt:branch.createdAt.toISOString()},deciding:false,onApprove(){},onReject(){}}));
    expect(html).toContain(args._review.baseSha);expect(html).toContain("Reviewed base commit");expect(html).toContain("records this exact review only");
  });
  it("native refuses a historical branch with no source binding but preserves rejection", () => {
    const html=renderToStaticMarkup(createElement(ProposalCard,{proposal:{...branch,createdAt:branch.createdAt.toISOString(),argsJson:{...args,_review:null}},deciding:false,onApprove(){},onReject(){}}));
    expect(html.match(/<button[^>]*>Record approval<\/button>/)?.[0]).toContain('disabled=""');expect(html.match(/<button[^>]*>Reject<\/button>/)?.[0]).not.toContain('disabled=""');expect(html).toContain("No bound branch source");
  });
  it("browser shows the same exact captured commit and review-only semantics", async () => {
    mocks.proposals.mockResolvedValue([branch]);const html=renderToStaticMarkup(await GovernancePage());expect(html).toContain(args._review.baseSha);expect(html).toContain("Reviewed base commit");expect(html).toContain("does not create a branch");
  });
  it("browser refuses mismatched captured branch names", async () => {
    mocks.proposals.mockResolvedValue([{...branch,argsJson:{...args,_review:{...args._review,newBranchName:'another'}}}]);const html=renderToStaticMarkup(await GovernancePage());expect(html.match(/<button[^>]*>Record approval<\/button>/)?.[0]).toContain('disabled=""');expect(html).toContain("No bound branch source");
  });
});


describe('reviewed pull-request source previews',()=>{
 const args={repositoryFullName:'fixture/repository',head:'reviewed',base:'main',title:'Reviewed change',_review:{kind:'github_pull_request',head:'reviewed',base:'main',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}};
 const pull={...proposal,toolName:'open_github_pull_request',argsJson:args};
 it('native shows both commits and explicitly does not promise to freeze branch names',()=>{const html=renderToStaticMarkup(createElement(ProposalCard,{proposal:{...pull,createdAt:pull.createdAt.toISOString()},deciding:false,onApprove(){},onReject(){}}));expect(html).toContain(args._review.headSha);expect(html).toContain(args._review.baseSha);expect(html.indexOf(args._review.headSha)).toBeLessThan(html.indexOf('Review approval details'));expect(html).toContain('does not freeze the branches');});
 it('native blocks approval for an old PR without source evidence',()=>{const html=renderToStaticMarkup(createElement(ProposalCard,{proposal:{...pull,createdAt:pull.createdAt.toISOString(),argsJson:{...args,_review:null}},deciding:false,onApprove(){},onReject(){}}));expect(html.match(/<button[^>]*>Record approval<\/button>/)?.[0]).toContain('disabled=""');expect(html.match(/<button[^>]*>Reject<\/button>/)?.[0]).not.toContain('disabled=""');});
 it('browser displays captured pair outside the collapsed metadata review',async()=>{mocks.proposals.mockResolvedValue([pull]);const html=renderToStaticMarkup(await GovernancePage());expect(html).toContain(args._review.headSha);expect(html).toContain(args._review.baseSha);expect(html.indexOf(args._review.headSha)).toBeLessThan(html.indexOf('Review pull request'));expect(html).toContain('does not freeze the branches');});
 it('browser blocks mismatched source evidence while keeping rejection',async()=>{mocks.proposals.mockResolvedValue([{...pull,argsJson:{...args,_review:{...args._review,head:'another'}}}]);const html=renderToStaticMarkup(await GovernancePage());expect(html.match(/<button[^>]*>Record approval<\/button>/)?.[0]).toContain('disabled=""');expect(html).toContain('No bound pull-request source');});
});
