import { beforeEach, expect, it, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("@/lib/connectors/github/readWorkflowExecutionContract", () => ({ readWorkflowExecutionContract: read }));
import { verifyIntakeWorkflowSource } from "../intakeWorkflowSource";
const source = { repositoryFullName: "team/service", ref: "release/v1", path: ".github/workflows/release.yml", blobSha: "a".repeat(40) };
const intake = { repositoryUrls: ["https://github.com/team/service.git"], sourceBranch: "release/v1", workflowName: "release.yml", workflowInputs: { client: "first" }, workflowSource: source };
const signal = new AbortController().signal;
beforeEach(() => { vi.clearAllMocks(); read.mockResolvedValue({ ok: true, source, inputs: intake.workflowInputs }); });
it("preserves legacy manual intake without claiming source verification", async () => {
  expect(await verifyIntakeWorkflowSource("tenant", { ...intake, workflowSource: undefined }, signal)).toBe(true); expect(read).not.toHaveBeenCalled();
});
it("revalidates persisted observation only against its matching intake and authenticated tenant", async () => {
  expect(await verifyIntakeWorkflowSource("tenant", intake, signal)).toBe(true);
  expect(read).toHaveBeenCalledWith({ organizationId: "tenant", source, inputs: intake.workflowInputs, signal });
});
it.each([
  { workflowName: "other.yml" }, { repositoryUrls: ["https://github.com/team/other"] },
  { repositoryUrls: ["https://github.com/team/service", "https://github.com/team/other"] },
  { repositoryUrls: ["https://user:password@github.com/team/service"] }, { repositoryUrls: ["https://github.com/team/service?token=secret"] },
])("rejects detached or ambiguous intake source before provider access", async patch => {
  expect(await verifyIntakeWorkflowSource("tenant", { ...intake, ...patch }, signal)).toBe(false); expect(read).not.toHaveBeenCalled();
});
it("fails closed when the fresh server read cannot verify the observation", async () => {
  read.mockResolvedValue({ ok: false }); expect(await verifyIntakeWorkflowSource("tenant", intake, signal)).toBe(false);
});

it("verifies an explicit deployment tag independently of the PR source branch", async () => {
 const tagged = {...source,ref:"axiom-release-candidate"};
 expect(await verifyIntakeWorkflowSource("tenant", {...intake,sourceBranch:"feature/pr-source",workflowSource:tagged},signal)).toBe(true);
 expect(read).toHaveBeenCalledWith({organizationId:"tenant",source:tagged,inputs:intake.workflowInputs,signal});
});
it("does not trust a different ref unless its exact workflow source is freshly verified", async () => {
 read.mockResolvedValue({ok:false});
 expect(await verifyIntakeWorkflowSource("tenant", {...intake,sourceBranch:"feature/pr-source"},signal)).toBe(false);
});
