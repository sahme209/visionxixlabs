/** @vitest-environment jsdom */
import {createElement} from "react";
import {act, cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";

const m = vi.hoisted(() => ({config: {apiBase: "https://desktop-fixture.example.invalid"}, revision: 0, list: vi.fn(), deploymentHistory: vi.fn(), providerHistory: vi.fn(), workflowEvidence: vi.fn(), simulationApprovalHistory: vi.fn(), providerApprovalHistory: vi.fn()}));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({
  desktopClient: {get config() {return m.config;}, getContextRevision: () => m.revision, releaseOperationPlans: m.list, deploymentExecutionHistory: m.deploymentHistory, providerMergeHistory: m.providerHistory, releaseWorkflowEvidence: m.workflowEvidence, simulationApprovalHistory: m.simulationApprovalHistory, providerApprovalHistory: m.providerApprovalHistory},
}));
import {SelectedReleaseOperationEvidence} from "../../../desktop/src/components/SelectedReleaseOperationEvidence";
import {ReleaseActivityTimeline} from "../../../desktop/src/components/ReleaseActivityTimeline";
import {AgentPlanContextView} from "../../../desktop/src/views/AgentPlanContextView";

const plan={kind:'merge_pull_request',organizationId:'org',requestId:'release',requestVersion:3,intakeDigest:'d'.repeat(64),connectionId:'connection',connectionRevision:'2026-10-26T10:00:00.000Z',window:{startUtc:'2026-10-26T10:00:00.000Z',endUtc:'2030-01-01T00:00:00.000Z'},method:'squash',pullRequest:{repositoryFullName:'team/service',number:42,url:'https://github.com/team/service/pull/42',headRef:'release/demo',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40)}};
const digest='c'.repeat(64),id='release_plan_'+'f'.repeat(64);
const row={id,version:0,requestId:'release',requestVersion:3,planDigest:digest,plan,status:'pending_review',createdAt:'2026-10-26T10:00:00.000Z',deadlineAt:'2030-01-01T00:00:00.000Z',executionAvailable:false,canReview:true,canCancel:true,history:[{sequence:0,type:'created',at:'2026-10-26T10:00:00.000Z',actorKind:'creator'}]};
const reply = {ok: true, data: {enabled: true, canManage: true, plans: [row], truncated: false}};
const release = {id: "release", version: 3};
const show = (onReturn = vi.fn()) => render(createElement(AgentPlanContextView, {release, workspaceId: "org", ownerConfig: m.config, revision: m.revision, onReturn, onClose: vi.fn()}));
beforeEach(() => {m.list.mockReset().mockResolvedValue(reply);m.config = {apiBase: "https://desktop-fixture.example.invalid"};m.revision = 0;});
afterEach(cleanup);

it("reads only the exact release version and reports source context without granting approval or execution", async () => {
  const onReturn = vi.fn();
  show(onReturn);
  expect(await screen.findByRole("heading", {name: "Merge pull request #42"})).toBeTruthy();
  expect(screen.getByText("Pending independent review")).toBeTruthy();
  const details = screen.getByRole("region", {name: "Selected operation plan"});
  expect(Array.from(details.querySelectorAll("time"), time => time.dateTime)).toEqual([plan.window.startUtc, plan.window.endUtc]);
  expect(within(details).getByText(plan.pullRequest.headSha)).toBeTruthy();
  expect(within(details).getByText(plan.pullRequest.baseSha)).toBeTruthy();
  expect(screen.queryByRole("button", {name: /approve|execute|merge/i})).toBeNull();
  expect(m.list).toHaveBeenCalledExactlyOnceWith("release", 3, expect.any(AbortSignal));
  fireEvent.click(screen.getByRole("button", {name: "Open exact release"}));
  expect(onReturn).toHaveBeenCalledOnce();
});

it("shows dated review history only for the selected exact plan", async () => {
  const at = "2026-10-27T11:00:00.000Z";
  const reviewed = {...row, version: 1, status: "reviewed", canReview: false,
    history: [...row.history, {sequence: 1, type: "reviewed", at, actorKind: "independent_reviewer"}]};
  const second = {...reviewed, id: "release_plan_" + "e".repeat(64), history: row.history};
  m.list.mockResolvedValue({...reply, data: {...reply.data, plans: [reviewed, second]}});
  show();

  const history = within(await screen.findByRole("region", {name: "Recorded plan review"}));
  const [, review] = within(history.getByRole("list")).getAllByRole("listitem");
  expect(within(review).getByText("Independent plan review recorded")).toBeTruthy();
  expect(review.querySelector("time")?.dateTime).toBe(at);
  expect(review.textContent).toContain("independent reviewer");
  expect(history.getByRole("heading", {name: "Review only"})).toBeTruthy();

  fireEvent.change(screen.getByRole("combobox", {name: "Saved plan"}), {target: {value: second.id}});
  expect(history.queryByText("Independent plan review recorded")).toBeNull();
  expect(history.getByRole("status").textContent).toBe("Plan history could not be verified.");
  const selected = within(screen.getByRole("complementary", {name: "Saved release plan context"}));
  expect(selected.getByText("History unverified")).toBeTruthy();
  expect(selected.queryByText("Independent review recorded")).toBeNull();
  expect(m.list).toHaveBeenCalledOnce();
});

it("binds Agent evidence to the exact reviewed plan and clears it when a different plan is selected", async () => {
  const at = "2026-10-27T11:00:00.000Z";
  const reviewed = {...row, version: 1, status: "reviewed", canReview: false,
    history: [...row.history, {sequence: 1, type: "reviewed", at, actorKind: "independent_reviewer"}]};
  const alternate = {...row, id: "release_plan_" + "e".repeat(64), planDigest: "1".repeat(64)};
  m.list.mockResolvedValue({...reply, data: {...reply.data, plans: [reviewed, alternate]}});
  let finish!: (value: unknown) => void;
  m.providerApprovalHistory.mockReset().mockReturnValue(new Promise(resolve => {finish = resolve;}));
  m.simulationApprovalHistory.mockReset();
  show();
  const evidence = within(await screen.findByRole("region", {name: "Evidence"}));
  const approvals = within(screen.getByRole("region", {name: "Recorded approvals"}));
  expect(m.providerApprovalHistory).not.toHaveBeenCalled();
  expect(approvals.getByRole("button", {name: "Load simulation approval history"})).toBeTruthy();
  expect(evidence.queryByRole("button", {name: "Load provider approval history"})).toBeNull();
  fireEvent.click(evidence.getByText("Saved plan evidence"));
  expect(await evidence.findByText(digest)).toBeTruthy();
  expect(evidence.getByText(plan.intakeDigest)).toBeTruthy();
  expect(m.simulationApprovalHistory).not.toHaveBeenCalled();
  fireEvent.click(approvals.getByRole("button", {name: "Load provider approval history"}));
  expect(m.providerApprovalHistory).toHaveBeenCalledExactlyOnceWith("release", 3, reviewed.id, digest, expect.any(AbortSignal));
  const signal = m.providerApprovalHistory.mock.calls[0][4] as AbortSignal;
  fireEvent.change(screen.getByRole("combobox", {name: "Saved plan"}), {target: {value: alternate.id}});
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ok: true, data: {events: [{type: "consumed", at}]}}));
  expect(screen.queryByRole("region", {name: "Recorded approvals"})).toBeNull();
  expect(screen.queryByRole("list", {name: "Recorded provider approval events"})).toBeNull();
  const nextEvidence = within(screen.getByRole("region", {name: "Evidence"}));
  fireEvent.click(nextEvidence.getByText("Saved plan evidence"));
  expect(await nextEvidence.findByText(alternate.planDigest)).toBeTruthy();
  expect(nextEvidence.queryByRole("button", {name: "Load provider approval history"})).toBeNull();
});

it("rejects a workspace or release-version mismatch", async () => {
  m.list.mockResolvedValue({...reply, data: {...reply.data, plans: [{...row, plan: {...plan, organizationId: "foreign"}}]}});
  show();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("team/service")).toBeNull();
});

it("discards a delayed plan when the desktop credential context changes", async () => {
  let complete!: (result: typeof reply) => void;
  m.list.mockReturnValue(new Promise(resolve => {complete = resolve;}));
  show();
  m.config = {apiBase: "https://desktop-fixture.example.invalid"};
  m.revision++;
  await act(async () => complete(reply));
  expect(screen.queryByText("team/service")).toBeNull();
});

it("requires explicit selection when refresh replaces the selected plan version", async () => {
  show();
  await screen.findByRole("heading", {name: "Merge pull request #42"});
  let complete!: (value: typeof reply) => void;
  m.list.mockImplementationOnce(() => new Promise(resolve => {complete = resolve;}));
  const refresh = screen.getByRole<HTMLButtonElement>("button", {name: "Refresh plans"});
  refresh.focus();
  fireEvent.click(refresh);
  expect(refresh.disabled).toBe(false);
  expect(refresh.getAttribute("aria-disabled")).toBe("true");
  const review = within(screen.getByRole("region", {name: "Recorded plan review"}));
  expect(review.getByText("No plan selected.")).toBeTruthy();
  expect(review.queryByRole("list")).toBeNull();
  fireEvent.click(refresh);
  expect(m.list).toHaveBeenCalledTimes(2);
  await act(async () => complete({...reply, data: {...reply.data, plans: [{...row, version: 1}]}}));
  expect(document.activeElement).toBe(refresh);
  expect(await screen.findByText(/selected plan version is no longer available/)).toBeTruthy();
  expect(screen.queryByRole("heading", {name: "Merge pull request #42"})).toBeNull();
  fireEvent.change(screen.getByRole("combobox", {name: "Saved plan"}), {target: {value: row.id}});
  expect(screen.getByRole("heading", {name: "Merge pull request #42"})).toBeTruthy();
});

it("does not send a read using a replaced owner", () => {
  render(createElement(AgentPlanContextView, {release, workspaceId: "org", ownerConfig: {apiBase: "https://desktop-fixture.example.invalid"}, revision: m.revision, onReturn: vi.fn(), onClose: vi.fn()}));
  expect(m.list).not.toHaveBeenCalled();
});

function showTimeline() {
  return render(createElement(ReleaseActivityTimeline, {requestId: release.id, version: release.version, workspaceId: "org"}));
}

it("loads and orders dated events for only the selected release version", async () => {
  const reviewedAt = "2026-10-27T11:00:00.000Z";
  const reviewed = {...row, version: 1, status: "reviewed", canReview: false,
    history: [...row.history, {sequence: 1, type: "reviewed", at: reviewedAt, actorKind: "independent_reviewer"}]};
  const earlier = {...row, id: "release_plan_" + "e".repeat(64), requestVersion: 2, status: "stale", canReview: false,
    plan: {...plan, requestVersion: 2, pullRequest: {...plan.pullRequest, number: 41, url: "https://github.com/team/service/pull/41"}}};
  m.list.mockResolvedValue({...reply, data: {...reply.data, plans: [earlier, reviewed], truncated: true}});
  showTimeline();
  expect(m.list).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Load activity"}));
  await screen.findByText("Independent plan review recorded");
  const entries = screen.getAllByRole("listitem");
  expect(entries).toHaveLength(2);
  expect(entries[0].querySelector("time")?.dateTime).toBe(reviewedAt);
  expect(entries[1].textContent).toContain("Merge plan saved");
  expect(screen.queryByText("Pull request #41")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("latest loaded plans");
  expect(m.list).toHaveBeenCalledExactlyOnceWith("release", 3, expect.any(AbortSignal));
});

it("clears prior activity when a refresh cannot verify the workspace", async () => {
  showTimeline();
  fireEvent.click(screen.getByRole("button", {name: "Load activity"}));
  await screen.findByText("Merge plan saved");
  m.list.mockResolvedValue({...reply, data: {...reply.data, plans: [{...row, plan: {...plan, organizationId: "foreign"}}]}});
  fireEvent.click(screen.getByRole("button", {name: "Refresh activity"}));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Merge plan saved")).toBeNull();
});

it("cancels activity when the selected release panel leaves", async () => {
  let complete!: (result: typeof reply) => void;
  m.list.mockReturnValue(new Promise(resolve => {complete = resolve;}));
  const view = showTimeline();
  fireEvent.click(screen.getByRole("button", {name: "Load activity"}));
  const signal = m.list.mock.calls[0][2] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => complete(reply));
});

it("shows operation history only for an explicitly selected current release plan", async () => {
  const previous = {...row, id: "release_plan_" + "a".repeat(64), requestVersion: 2, status: "stale", canReview: false,
    plan: {...plan, requestVersion: 2}};
  const current = {...row, version: 1, status: "reviewed", canReview: false};
  m.list.mockResolvedValue({...reply, data: {...reply.data, plans: [previous, current]}});
  m.deploymentHistory.mockResolvedValue({ok: true, data: {events: [{type: "accepted", at: "2026-10-27T11:00:00.000Z"}]}});
  m.providerHistory.mockReset();
  const onDeploymentEvent = vi.fn();
  render(createElement(SelectedReleaseOperationEvidence, {requestId: "release", version: 3, workspaceId: "org", onWorkflowEvidence: vi.fn(), onDeploymentEvent}));

  fireEvent.click(screen.getByRole("button", {name: "Load evidence plans"}));
  const picker = await screen.findByRole("combobox", {name: "Evidence plan"});
  expect(within(picker).getAllByRole("option")).toHaveLength(2);
  expect(m.deploymentHistory).not.toHaveBeenCalled();
  fireEvent.change(picker, {target: {value: current.id}});
  fireEvent.click(screen.getByRole("button", {name: "Load selected deployment execution history"}));
  expect(await screen.findByText(/Workflow request acknowledged/)).toBeTruthy();
  expect(m.deploymentHistory).toHaveBeenCalledExactlyOnceWith("release", 3, current.id, current.planDigest, expect.any(AbortSignal));
  expect(m.providerHistory).not.toHaveBeenCalled();
  expect(onDeploymentEvent).toHaveBeenLastCalledWith({type: "accepted", at: "2026-10-27T11:00:00.000Z", pullRequest: 42});

  fireEvent.change(picker, {target: {value: ""}});
  expect(screen.queryByText(/Workflow request acknowledged/)).toBeNull();
  expect(onDeploymentEvent).toHaveBeenLastCalledWith(undefined);
});

it("focuses the exact-plan heading on entry and preserves native select Escape", async () => {
  const close = vi.fn();
  render(createElement(AgentPlanContextView, {release, workspaceId: "org", ownerConfig: m.config,
    revision: m.revision, onReturn: vi.fn(), onClose: close}));
  const heading = screen.getByRole("heading", {name: "Saved release plans"});
  expect(document.activeElement).toBe(heading);
  const selector = await screen.findByRole("combobox", {name: "Saved plan"});
  expect(screen.getByRole("heading", {name: "Merge pull request #42", level: 2})).toBe(heading);
  expect(screen.queryByRole("heading", {name: "Saved release plans"})).toBeNull();
  expect(document.activeElement).toBe(heading);
  expect(fireEvent.keyDown(selector, {key: "Escape"})).toBe(true);
  expect(fireEvent.keyDown(heading, {key: "Escape", isComposing: true})).toBe(true);
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(heading, {key: "Escape"});
  expect(close).toHaveBeenCalledOnce();
});

it("reads separate approval histories only for the selected reviewed plan and aborts a replaced read", async () => {
  const current = {...row, version: 1, status: "reviewed", canReview: false};
  m.list.mockResolvedValue({...reply, data: {...reply.data, plans: [current]}});
  const at = "2026-10-27T11:00:00.000Z";
  let complete!: (value: unknown) => void;
  m.simulationApprovalHistory.mockReset().mockResolvedValue({ok: true, data: {events: [{type: "approved", at}]}});
  m.providerApprovalHistory.mockReset().mockImplementation(() => new Promise(resolve => {complete = resolve;}));
  render(createElement(SelectedReleaseOperationEvidence, {requestId: "release", version: 3, workspaceId: "org", onWorkflowEvidence: vi.fn()}));
  fireEvent.click(screen.getByRole("button", {name: "Load evidence plans"}));
  const picker = await screen.findByRole("combobox", {name: "Evidence plan"});
  expect(m.simulationApprovalHistory).not.toHaveBeenCalled();
  expect(m.providerApprovalHistory).not.toHaveBeenCalled();
  fireEvent.change(picker, {target: {value: current.id}});
  const approvals = within(screen.getByRole("region", {name: "Approval history"}));
  const execution = within(screen.getByRole("region", {name: "Execution records"}));
  expect(execution.getByRole("button", {name: "Load selected provider merge history"})).toBeTruthy();
  expect(approvals.queryByRole("button", {name: "Load selected provider merge history"})).toBeNull();
  fireEvent.click(approvals.getByRole("button", {name: "Load selected simulation approval history"}));
  const history = await approvals.findByRole("list", {name: "Recorded selected simulation approval events"});
  expect(within(history).getByText(/Simulation approval recorded/)).toBeTruthy();
  expect(history.querySelector("time")?.dateTime).toBe(at);
  expect(m.simulationApprovalHistory).toHaveBeenCalledExactlyOnceWith("release", 3, current.id, current.planDigest, expect.any(AbortSignal));
  expect(screen.getByText("Application validation outcomes and rollback verification are unavailable for this plan.")).toBeTruthy();

  const provider = approvals.getByRole("button", {name: "Load selected provider approval history"});
  provider.focus();
  fireEvent.click(provider);
  expect(provider.getAttribute("aria-disabled")).toBe("true");
  expect(document.activeElement).toBe(provider);
  fireEvent.click(provider);
  expect(m.providerApprovalHistory).toHaveBeenCalledExactlyOnceWith("release", 3, current.id, current.planDigest, expect.any(AbortSignal));
  const signal = m.providerApprovalHistory.mock.calls[0][4] as AbortSignal;
  fireEvent.change(picker, {target: {value: ""}});
  expect(signal.aborted).toBe(true);
  await act(async () => complete({ok: true, data: {events: [{type: "consumed", at}]}}));
  expect(screen.queryByRole("list", {name: /Recorded selected .* approval events/})).toBeNull();
});

it.each(["history-unavailable", "workflow-unavailable", "matched", "foreign", "ambiguous", "same-commit", "wrong-release", "wrong-plan", "wrong-digest", "truncated", "unaccepted", "no-receipt", "receipt-without-event", "wrong-run", "wrong-attempt", "wrong-workflow", "wrong-ref", "wrong-source", "wrong-connection", "wrong-connection-revision", "observation-before-dispatch", "failed", "queued", "in-progress", "failed-without-acceptance"] as const)("only projects a verified workflow observation with %s evidence", async kind => {
  const onWorkflowEvidence = vi.fn();
  const onOpenLogs = vi.fn();
  const sourceCommit = "1".repeat(40);
  const acceptedAt = "2026-11-17T10:27:00.000Z";
  const receipt = {repositoryFullName: plan.pullRequest.repositoryFullName, workflowPath: ".github/workflows/deploy.yml",
    headSha: sourceCommit, ref: "release", runId: "12345", runAttempt: 1};
  const binding = {organizationId: kind === "foreign" ? "other" : "org", releaseVersion: 3,
    releaseId: kind === "wrong-release" ? "other-release" : "release",
    planId: kind === "wrong-plan" ? "other-plan" : id,
    planDigest: kind === "wrong-digest" ? "1".repeat(64) : digest, intakeDigest: plan.intakeDigest, repositoryFullName: plan.pullRequest.repositoryFullName,
    workflowPath: kind === "wrong-workflow" ? ".github/workflows/other.yml" : receipt.workflowPath,
    connectionId: kind === "wrong-connection" ? "other-connection" : plan.connectionId,
    connectionRevision: kind === "wrong-connection-revision" ? "2026-10-27T10:00:00.000Z" : plan.connectionRevision,
    dispatchedRef: kind === "wrong-ref" ? "other" : receipt.ref,
    sourceCommit: kind === "wrong-source" ? "2".repeat(40) : sourceCommit,
    runId: kind === "wrong-run" ? "12346" : receipt.runId,
    runAttempt: kind === "wrong-attempt" ? 2 : receipt.runAttempt};
  const evidence = {state: "observed", observation: {
    status: kind === "queued" ? "queued" : kind === "in-progress" ? "in_progress" : "completed",
    conclusion: kind === "queued" || kind === "in-progress" ? null : kind.startsWith("failed") ? "failure" : "success",
    observedAt: kind === "observation-before-dispatch" ? "2026-11-17T10:26:59.999Z" : "2026-11-17T10:28:00.000Z",
  }, binding};
  const accepted = kind !== "unaccepted" && kind !== "failed-without-acceptance";
  m.deploymentHistory.mockResolvedValue({ok: true, data: {
    events: [{type: accepted && kind !== "receipt-without-event" ? "accepted" : "prepared", at: acceptedAt}],
    receipt: accepted && kind !== "no-receipt" ? receipt : undefined,
  }});
  if (kind === "history-unavailable") m.deploymentHistory.mockResolvedValue({ok: false, error: "service_unavailable"});
  m.workflowEvidence.mockResolvedValue(kind === "workflow-unavailable" ? {ok: false, error: "service_unavailable"} : {ok: true, data: {truncated: kind === "truncated",
    evidence: kind === "ambiguous" || kind === "same-commit"
      ? [evidence, {...evidence, binding: {...binding, runAttempt: 3, sourceCommit: kind === "same-commit" ? sourceCommit : "2".repeat(40)}}]
      : [evidence]}});
  const onWorkflowGap = vi.fn();
  render(createElement(SelectedReleaseOperationEvidence, {requestId: "release", version: 3, workspaceId: "org", onWorkflowEvidence, onWorkflowGap, onOpenLogs}));
  fireEvent.click(screen.getByRole("button", {name: "Load evidence plans"}));
  fireEvent.change(await screen.findByRole("combobox", {name: "Evidence plan"}), {target: {value: id}});
  fireEvent.click(screen.getByRole("button", {name: "Read recorded workflow commit"}));
  const expected = {
    matched: "Recorded workflow commit shown in Overview.",
    failed: "The workflow was last recorded as failed. A successful workflow commit is unavailable.",
    queued: "The workflow was last recorded as queued. A successful workflow commit is unavailable.",
    "in-progress": "The workflow was last recorded as in progress. A successful workflow commit is unavailable.",
  } as const;
  const mismatched = ["wrong-run", "wrong-attempt", "wrong-workflow", "wrong-ref", "wrong-source", "wrong-connection", "wrong-connection-revision", "observation-before-dispatch"].includes(kind);
  await screen.findByText(kind === "matched" || kind === "failed" || kind === "queued" || kind === "in-progress"
    ? expected[kind] : mismatched ? "The recorded workflow evidence does not match the accepted dispatch."
      : kind.endsWith("-unavailable") ? "Workflow evidence is unavailable."
      : kind === "truncated" ? "Workflow evidence was incomplete, so one exact attempt cannot be confirmed for this plan."
      : kind === "no-receipt" ? "The dispatch was acknowledged, but its workflow run receipt is not recorded, so the exact attempt cannot be verified."
      : ["unaccepted", "receipt-without-event", "failed-without-acceptance"].includes(kind) ? "No acknowledged workflow dispatch is recorded for this plan, so there is no attempt to verify."
      : ["ambiguous", "same-commit"].includes(kind) ? "More than one workflow observation matches this plan, so the exact attempt cannot be determined."
      : ["foreign", "wrong-release", "wrong-plan", "wrong-digest"].includes(kind) ? "No workflow observation is recorded for this exact release version and plan."
      : "A single completed workflow commit could not be verified for this release and plan.");
  expect(m.workflowEvidence).toHaveBeenLastCalledWith("release", id, digest, expect.any(AbortSignal));
  const recordedRun = kind === "matched" || kind === "failed" || kind === "queued" || kind === "in-progress";
  const shown = screen.getByRole("region", {name: "Execution records"}).querySelector("p[role=status]")?.textContent;
  expect(onWorkflowGap).toHaveBeenLastCalledWith(recordedRun ? undefined : shown);
  const run = {repository: binding.repositoryFullName, id: binding.runId, attempt: binding.runAttempt,
    acceptedAt, observedAt: evidence.observation.observedAt};
  const projections = {
    matched: {state: "success", commit: sourceCommit, run},
    failed: {state: "failure", run},
    queued: {state: "queued", run},
    "in-progress": {state: "in_progress", run},
  } as const;
  expect(onWorkflowEvidence).toHaveBeenLastCalledWith(kind === "matched" || kind === "failed" || kind === "queued" || kind === "in-progress"
    ? projections[kind] : undefined);
  const logs = screen.queryByRole("button", {name: "Open recorded workflow logs"});
  if (kind === "matched" || kind === "failed" || kind === "queued" || kind === "in-progress") {
    expect(logs).toBeTruthy();
    fireEvent.click(logs!);
    expect(onOpenLogs).toHaveBeenCalledOnce();
    expect(m.workflowEvidence).toHaveBeenCalledTimes(1);
    expect(m.deploymentHistory).toHaveBeenCalledTimes(1);
  } else {
    expect(logs).toBeNull();
    expect(onOpenLogs).not.toHaveBeenCalled();
  }
  fireEvent.change(screen.getByRole("combobox", {name: "Evidence plan"}), {target: {value: ""}});
  expect(screen.queryByRole("button", {name: "Open recorded workflow logs"})).toBeNull();
  expect(onWorkflowEvidence).toHaveBeenLastCalledWith(undefined);
});

it.each(["same", "different digest", "different revision", "missing"] as const)(
  "revalidates the selected saved plan after a failed refresh with %s evidence",
  async outcome => {
    m.deploymentHistory.mockReset();
    const onWorkflowEvidence = vi.fn();
    const onProviderDecision = vi.fn();
    const onDeploymentEvent = vi.fn();
    const current = {...row, version: 1, status: "reviewed", canReview: false};
    const alternate = {...current, id: "release_plan_" + "e".repeat(64), planDigest: "1".repeat(64)};
    const asList = (plans: typeof current[]) => ({...reply, data: {...reply.data, plans}});
    m.list.mockResolvedValueOnce(asList([current, alternate]));
    let finishPlans!: (value: unknown) => void;
    m.list.mockImplementationOnce(() => new Promise(resolve => { finishPlans = resolve; }));
    const refreshed = outcome === "missing" ? [alternate] : [alternate, {
      ...current,
      planDigest: outcome === "different digest" ? "2".repeat(64) : current.planDigest,
      ...(outcome === "different revision" ? {version: 2, status: "stale"} : {}),
    }];
    m.list.mockResolvedValueOnce(asList(refreshed));
    let finishHistory!: (value: unknown) => void;
    m.deploymentHistory.mockImplementationOnce(() => new Promise(resolve => { finishHistory = resolve; }));
    m.workflowEvidence.mockResolvedValueOnce({ok: false});

    render(createElement(SelectedReleaseOperationEvidence, {
      requestId: "release", version: 3, workspaceId: "org", onWorkflowEvidence, onProviderDecision, onDeploymentEvent,
    }));
    fireEvent.click(screen.getByRole("button", {name: "Load evidence plans"}));
    fireEvent.change(await screen.findByRole("combobox", {name: "Evidence plan"}), {target: {value: current.id}});
    fireEvent.click(screen.getByRole("button", {name: "Read recorded workflow commit"}));
    const signal = m.deploymentHistory.mock.calls[0][4] as AbortSignal;

    const refresh = screen.getByRole("button", {name: "Refresh evidence plans"});
    refresh.focus();
    fireEvent.click(refresh);
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole("combobox", {name: "Evidence plan"})).toBeNull();
    await act(async () => {
      finishHistory({ok: true, data: {events: []}});
      finishPlans({ok: false});
    });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Read recorded workflow commit"})).toBeNull();
    expect(onWorkflowEvidence).toHaveBeenLastCalledWith(undefined);
    expect(onProviderDecision).toHaveBeenLastCalledWith(undefined);
    expect(onDeploymentEvent).toHaveBeenLastCalledWith(undefined);
    expect(document.activeElement).toBe(refresh);

    fireEvent.click(refresh);
    const picker = await screen.findByRole<HTMLSelectElement>("combobox", {name: "Evidence plan"});
    expect(picker.value).toBe(outcome === "same" ? current.id : "");
    expect(m.deploymentHistory).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(refresh);
  },
);

it("projects only the last saved provider decision and clears it before refresh or plan changes", async () => {
  const current = {...row, version: 1, status: "reviewed", canReview: false};
  m.list.mockResolvedValue({...reply, data: {...reply.data, plans: [current]}});
  const approval = {type: "approved", at: "2026-10-27T11:00:00.000Z"};
  const revoked = {type: "revoked", at: "2026-10-27T11:15:00.000Z"};
  m.providerApprovalHistory.mockResolvedValueOnce({ok: true, data: {events: [approval, revoked]}});
  const onProviderDecision = vi.fn();
  render(createElement(SelectedReleaseOperationEvidence, {
    requestId: "release", version: 3, workspaceId: "org", onWorkflowEvidence: vi.fn(), onProviderDecision,
  }));
  fireEvent.click(screen.getByRole("button", {name: "Load evidence plans"}));
  const picker = await screen.findByRole("combobox", {name: "Evidence plan"});
  fireEvent.change(picker, {target: {value: current.id}});
  expect(onProviderDecision).toHaveBeenLastCalledWith(undefined);
  fireEvent.click(screen.getByRole("button", {name: "Load selected provider approval history"}));
  expect(await screen.findByText("Provider approval revoked")).toBeTruthy();
  expect(onProviderDecision).toHaveBeenLastCalledWith({...revoked, pullRequest: 42});
  expect(m.providerApprovalHistory).toHaveBeenCalledExactlyOnceWith("release", 3, current.id, current.planDigest, expect.any(AbortSignal));

  let finish!: (value: unknown) => void;
  m.providerApprovalHistory.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole("button", {name: "Refresh selected provider approval history"}));
  expect(onProviderDecision).toHaveBeenLastCalledWith(undefined);
  fireEvent.change(picker, {target: {value: ""}});
  await act(async () => finish({ok: true, data: {events: [approval]}}));
  expect(onProviderDecision).toHaveBeenLastCalledWith(undefined);
});

it("opens the selected release review only from a verified eligible plan", async () => {
  const rejected = {...row, id: "release_plan_" + "8".repeat(64), version: 1,
    status: "rejected", canReview: false,
    history: [...row.history, {sequence: 1, type: "rejected", at: row.createdAt, actorKind: "independent_reviewer"}]};
  m.list.mockResolvedValue({...reply, data: {...reply.data, plans: [row, rejected]}});
  const onReturn = vi.fn();
  show(onReturn);

  const review = await screen.findByRole("button", {name: "View release review"});
  const details = screen.getByRole("list", {name: "Saved merge plan details"});
  expect(within(details).getAllByRole("listitem")).toHaveLength(3);
  fireEvent.click(review);
  expect(onReturn).toHaveBeenCalledExactlyOnceWith("review");

  fireEvent.change(screen.getByRole("combobox", {name: "Saved plan"}), {target: {value: rejected.id}});
  expect(screen.queryByRole("button", {name: "View release review"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Open exact release"}));
  expect(onReturn).toHaveBeenLastCalledWith();
});
