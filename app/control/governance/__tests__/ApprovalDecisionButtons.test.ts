/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApprovalDecisionButtons } from "../ApprovalDecisionButtons";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(body: unknown, status = 200) {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetcher);
  render(createElement(ApprovalDecisionButtons, { proposalId: "proposal-local" }));
  return fetcher;
}
it("keeps failed execution visible and offers no repeat decision", async () => {
  const fetcher = setup({ ok: true, status: "failed", errorMessage: "private execution diagnostic" });
  fireEvent.click(screen.getByRole("button", { name: "Approve & execute" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("execution failed");
  expect(alert.textContent).not.toContain("private execution");
  expect(screen.queryByRole("button", { name: "Approve & execute" })).toBeNull();
  expect(screen.getByRole("button", { name: "Reload approvals" })).toBeTruthy();
  expect(fetcher).toHaveBeenCalledOnce();
});
it("distinguishes an unknown provider outcome from a confirmed failure", async () => {
  setup({ ok: true, status: "failed", errorMessage: "deployment_outcome_unknown" });
  fireEvent.click(screen.getByRole("button", { name: "Approve & execute" }));
  expect((await screen.findByRole("alert")).textContent).toContain("provider outcome is unconfirmed");
  expect(screen.getByRole("alert").textContent).toContain("reservation is retained");
});
it.each([false, true])("shows the actual completed decision for approve=%s", async (approve) => {
  setup({ ok: true, status: approve ? "executed" : "rejected" });
  fireEvent.click(screen.getByRole("button", { name: approve ? "Approve & execute" : "Reject" }));
  expect((await screen.findByRole("status")).textContent).toContain(approve ? "approved and executed" : "rejected");
  expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
});
it("does not invent success for an incomplete service response", async () => {
  const fetcher = setup({});
  fireEvent.click(screen.getByRole("button", { name: "Approve & execute" }));
  expect((await screen.findByRole("alert")).textContent).toContain("not confirmed");
  expect(screen.queryByRole("button", { name: "Approve & execute" })).toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
});
it("does not allow a blind retry after the network outcome is unknown", async () => {
  const fetcher = setup({});
  fetcher.mockRejectedValue(Error("network lost"));
  fireEvent.click(screen.getByRole("button", { name: "Reject" }));
  expect((await screen.findByRole("alert")).textContent).toContain("not confirmed");
  expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
});
it("retains role and target-bound approval restrictions", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(createElement(ApprovalDecisionButtons, { proposalId: "p", approveDisabledReason: "Target review required." }));
  expect((screen.getByRole("button", { name: "Approve & execute" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Approve & execute" }));
  expect(fetcher).not.toHaveBeenCalled();
});
it("explains a current disabled-Agent denial without exposing raw diagnostics or allowing a blind retry", async () => {
  setup({ ok: false, error: "workspace_agent_disabled" }, 409);
  fireEvent.click(screen.getByRole("button", { name: "Approve & execute" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Agent is disabled");
  expect(screen.queryByRole("button", { name: "Approve & execute" })).toBeNull();
});
it('allows an own-proposal cancellation while keeping execution approval disabled',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,status:'rejected'}));vi.stubGlobal('fetch',fetcher);
 render(createElement(ApprovalDecisionButtons,{proposalId:'own',ownProposal:true}));
 expect((screen.getByRole('button',{name:'Approve & execute'})as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Cancel proposal'}));
 await screen.findByRole('status');expect(fetcher).toHaveBeenCalledWith('/api/control/agent/actions/own/decision',expect.objectContaining({body:JSON.stringify({decision:'reject'})}));
 expect(fetcher).toHaveBeenCalledOnce();
});
it('preserves generic action uncertainty without inventing reservation evidence',async()=>{
 setup({ok:true,status:'failed',errorMessage:'action_outcome_unknown'});
 fireEvent.click(screen.getByRole('button',{name:'Approve & execute'}));
 const alert=await screen.findByRole('alert');expect(alert.textContent).toContain('provider outcome is unconfirmed');
 expect(alert.textContent).not.toContain('reservation is retained');expect(screen.queryByRole('button',{name:'Approve & execute'})).toBeNull();
});
