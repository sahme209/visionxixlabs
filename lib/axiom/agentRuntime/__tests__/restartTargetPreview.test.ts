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
    const approve = html.match(/<button[^>]*>Approve &amp; execute<\/button>/)?.[0];
    expect(reject).toBeDefined(); expect(reject).not.toContain('disabled=""');
    expect(approve).toContain('disabled=""'); expect(html).toContain("rejection remains available");
  });

});
