/** @vitest-environment jsdom */
import {createElement} from 'react';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import { createReleaseClosureDrafts } from "../../../desktop/src/lib/releaseClosureDrafts";
const m=vi.hoisted(()=>({config:{apiBase:'https://workspace-a.example.test'},revision:0,scope:'A',listeners:new Set<()=>void>(),requests:vi.fn(),executions:vi.fn(),observe:vi.fn(),close:vi.fn(),exact:vi.fn(),revisionSeed:vi.fn(),batchReadiness:vi.fn(),githubEvidence:vi.fn(),playbookGenerate:vi.fn(),playbookRead:vi.fn(),history:vi.fn(),operations:vi.fn(),openBrowser:vi.fn()}));
vi.mock("@tauri-apps/plugin-shell", () => ({open: m.openBrowser}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.config},getContextRevision:()=>m.revision,subscribeContext:(listener:()=>void)=>{m.listeners.add(listener);return()=>{m.listeners.delete(listener)}},deploymentRequests:m.requests,listDeploymentExecutions:m.executions,observeDeploymentExecution:m.observe,closeDeploymentRequest:m.close,savedDeploymentRequest:m.exact,deploymentRequestForRevision:m.revisionSeed,releaseBatchReadiness:m.batchReadiness,collectGitHubReleaseEvidence:m.githubEvidence,generateDeploymentPlaybook:m.playbookGenerate,latestDeploymentPlaybook:m.playbookRead,deploymentRequestHistory:m.history,deploymentOperations:m.operations}}));
// Provider review/execution panels are outside this view-state ownership seam.
vi.mock('../../../desktop/src/components/ReleaseTicketWorkspace',()=>({
 ReleaseTicketWorkspace:({version}:{version:number})=>createElement('section',{'aria-label':'Release ticket workspace', 'data-release-version':version},
  createElement('input',{key:version,'aria-label':'Fixture ticket draft'})),
}));
vi.mock('../../../desktop/src/components/ReleaseMergeReview',()=>({ReleaseMergeReview:()=>null}));
// The wrapper and view are real; only their service boundary is simulated.
import {DeploymentRequestsWorkspace} from '../../../desktop/src/views/DeploymentRequestsWorkspace';
const releaseContext={window:null,scope:{applicationCount:1,repositoryCount:1,targetEnvironment:'Test'},approval:{prStatus:'pending',noPrRequired:true},readiness:{developmentReady:false,productionReady:false,validationStepCount:0,deferredValidation:false,approvalDecision:'needs_attention',blockers:['Fixture source review']},recovery:{rollbackAvailability:'unknown',backupRequired:false,evidenceCount:0},observation:{status:'not_connected',recordedMonitoringPlan:false}};
const request=(scope:string)=>({id:'request-'+scope,title:'Release '+scope,status:'submitted',version:1,correlationId:'correlation-'+scope,submittedAt:'2030-01-01T00:00:00Z',closedAt:null,updatedAt:'2030-01-01T00:00:00Z',latestPlaybook:null,releaseContext});
const execution=(scope:string)=>({id:'execution-'+scope,environmentId:'environment-'+scope,repositoryFullName:'fixture/'+scope,sourceRef:null,sourceKind:null,sourceCommitSha:null,branchPolicyId:null,pullRequestUrl:null,workflowRunId:'run-'+scope,workflowUrl:null,source:'github',status:'in_progress',conclusion:null,rollbackStatus:'not_requested',lastObservedAt:null,completedAt:null,createdAt:'2030-01-01T00:00:00Z',updatedAt:'2030-01-01T00:00:00Z'});
function deferred(){let resolve!:(value:any)=>void;const promise=new Promise<any>(done=>{resolve=done});return{promise,resolve}}
function replaceContext(boundary:'config'|'revision'){m.scope='B';if(boundary==='config')m.config={apiBase:'https://workspace-b.example.test'};else m.revision++;for(const listener of [...m.listeners])listener()}
async function mountA(){render(createElement(DeploymentRequestsWorkspace));await screen.findByRole('button',{name:/Release A/});await screen.findByText('Workflow run: run-A')}
beforeEach(()=>{vi.resetAllMocks();m.config={apiBase:'https://workspace-a.example.test'};m.revision=0;m.scope='A';m.listeners.clear();m.requests.mockImplementation(async()=>({ok:true,data:[request(m.scope)]}));m.executions.mockImplementation(async()=>({ok:true,data:{executions:[execution(m.scope)]}}));m.observe.mockResolvedValue({ok:false,error:'Synthetic read unavailable'});});
afterEach(()=>{cleanup();vi.useRealTimers()});
it("retires stale Deployments release actions and keeps the exact readiness control focused", async () => {
 const initial = request("A");
 const row = {...initial, releaseContext:{...initial.releaseContext, batches:{selectedRunCount:1}, approval:{noPrRequired:false,prStatus:"pending"}}};
 m.requests.mockResolvedValueOnce({ok:true,data:[row]});
 m.batchReadiness.mockResolvedValue({ok:true,data:{ready:false,reason:"changed",closedRelease:{requestId:row.id,version:row.version}}});
 await mountA();
 const check = await screen.findByRole("button",{name:"Check batches"});
 check.focus();
 fireEvent.click(check);
 await screen.findByText(/This saved release is closed/);
 expect(document.activeElement).toBe(check);
 expect(screen.getByRole("button",{name:"Monitor batches"}).getAttribute("aria-disabled")).toBe("true");
 expect(screen.getByRole<HTMLButtonElement>("button",{name:"View release review"}).disabled).toBe(true);
 expect(screen.getByRole<HTMLButtonElement>("button",{name:/Record external outcome and close request/}).disabled).toBe(true);
 expect(m.close).not.toHaveBeenCalled();
});

it.each(['config','revision'] as const)('drops old requests and execution rows and loads the new %s context',async boundary=>{
 await mountA();await act(async()=>replaceContext(boundary));expect(screen.queryByRole('button',{name:/Release A/})).toBeNull();expect(screen.queryByText('Workflow run: run-A')).toBeNull();
 await screen.findByRole('button',{name:/Release B/});await screen.findByText('Workflow run: run-B');expect(m.requests).toHaveBeenCalledTimes(2);expect(m.executions).toHaveBeenCalledTimes(2);
});
it.each(['config','revision'] as const)('discards delayed old initial reads after the new %s context has loaded',async boundary=>{
 const a=deferred(),x=deferred();m.requests.mockReturnValueOnce(a.promise);m.executions.mockReturnValueOnce(x.promise);render(createElement(DeploymentRequestsWorkspace));
 expect(m.requests).toHaveBeenCalledOnce();expect(m.executions).toHaveBeenCalledOnce();
 await act(async()=>replaceContext(boundary));await screen.findByRole('button',{name:/Release B/});await screen.findByText('Workflow run: run-B');
 await act(async()=>{a.resolve({ok:true,data:[request('A')]});x.resolve({ok:true,data:{executions:[execution('A')]}})});
 expect(screen.queryByRole('button',{name:/Release A/})).toBeNull();expect(screen.queryByText('Workflow run: run-A')).toBeNull();expect(screen.getByRole('button',{name:/Release B/})).toBeTruthy();expect(screen.getByText('Workflow run: run-B')).toBeTruthy();
});
it.each(['config','revision'] as const)('stops the old observation interval and ignores its pending result on %s replacement',async boundary=>{
 vi.useFakeTimers();const a=deferred();m.observe.mockImplementation((id:string)=>id==='execution-A'?a.promise:Promise.resolve({ok:false,error:'Synthetic read unavailable'}));await act(async()=>{render(createElement(DeploymentRequestsWorkspace))});expect(m.observe.mock.calls.filter(([id])=>id==='execution-A')).toHaveLength(1);
 await act(async()=>replaceContext(boundary));expect(screen.queryByRole('button',{name:/Release A/})).toBeNull();expect(screen.getByRole('button',{name:/Release B/})).toBeTruthy();
 await act(async()=>a.resolve({ok:true,data:{...execution('A'),status:'completed',workflowRunId:'stale-run-A'}}));await act(async()=>vi.advanceTimersByTime(15000));
 expect(m.observe.mock.calls.filter(([id])=>id==='execution-A')).toHaveLength(1);expect(m.observe.mock.calls.filter(([id])=>id==='execution-B').length).toBeGreaterThan(1);expect(screen.queryByText('Workflow run: stale-run-A')).toBeNull();
});
it.each(['config','revision'] as const)('prevents an old manual refresh from following up with new-context execution reads after %s replacement',async boundary=>{
 await mountA();const a=deferred();m.requests.mockReturnValueOnce(a.promise);fireEvent.click(screen.getByRole('button',{name:'Refresh'}));await act(async()=>replaceContext(boundary));await screen.findByRole('button',{name:/Release B/});const reads=m.executions.mock.calls.length;
 await act(async()=>a.resolve({ok:true,data:[request('A')]}));expect(m.executions).toHaveBeenCalledTimes(reads);expect(screen.queryByRole('button',{name:/Release A/})).toBeNull();expect(screen.getByRole('button',{name:/Release B/})).toBeTruthy();
});
it('withholds readiness from the selected release while refreshing its details', async () => {
  const current = request('A');
  const recovery = {...current.releaseContext.recovery, backupRequired: true};
  m.requests.mockResolvedValueOnce({ok: true, data: [{
    ...current, requesterName: 'Fixture requester',
    releaseContext: {...current.releaseContext, recovery},
  }]});
  await mountA();
  const first = screen.getByRole('button', {name: /Release A/});
  fireEvent.click(first);
  const readiness = within(screen.getByRole('region', {name: 'Recorded readiness'}));
  const plannedValidation = () => readiness.getByText('Planned validation').nextElementSibling?.textContent;
  expect(plannedValidation()).toBe('No steps recorded');
  const approvals = within(screen.getByRole('region', {name: 'Recorded approvals'}));
  const prerequisites = () => approvals.getByText('Approval prerequisites').nextElementSibling?.textContent;
  expect(prerequisites()).toBe('Needs attention');
  const blockers = approvals.getByText('Review recorded blockers (1)').closest('details')!;
  expect(blockers.open).toBe(false);
  expect(within(blockers).getByText('Fixture source review')).toBeTruthy();

  const details = screen.getByText('Recorded release details').closest('details')!;
  details.open = true;
  const overview = within(screen.getByRole('region', {name: 'Release overview'}));
  expect(overview.getByRole('group', {name: 'Release context'})).toBeTruthy();
  const requirements = overview.getByRole('heading', {name: 'Execution requirements'}).parentElement!;
  expect(within(requirements).getByText('Exact approvals and verified evidence are required before execution.')).toBeTruthy();
  expect(screen.getAllByText('Exact approvals and verified evidence are required before execution.')).toHaveLength(1);
  expect(overview.getByText('Requested by').nextElementSibling?.textContent).toBe('Fixture requester');
  expect(overview.getByText('Scope').nextElementSibling?.textContent).toBe('1 app · 1 repo');
  expect(readiness.getByText('Recovery backup').nextElementSibling?.textContent).toBe('Required by saved intake');

  const pending = deferred();
  m.requests.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  expect(plannedValidation()).toBe('Unavailable');
  expect(readiness.getAllByText('Unavailable')).toHaveLength(6);
  expect(readiness.queryByText('Recovery backup')).toBeNull();
  expect(prerequisites()).toBe('Unavailable');
  expect(approvals.getByText('Saved merge approval').nextElementSibling?.textContent).toBe('Unavailable');
  expect(approvals.queryByText('Review recorded blockers (1)')).toBeNull();
  expect(overview.queryByRole('button', {name: 'View release review'})).toBeNull();
  expect(overview.getByRole('button', {name: 'Open Agent Approval Center in browser'})).toBeTruthy();
  for (const label of ['Target', 'Requested by', 'Scope', 'Backup evidence', 'Evidence references']) {
    expect(overview.getByText(label).nextElementSibling?.textContent).toBe('Unavailable');
  }

  await act(async () => pending.resolve({ok: true, data: [{
    ...current,
    releaseContext: {...current.releaseContext, approval:{prStatus:"pending",noPrRequired:false}, readiness: {...current.releaseContext.readiness,
      approvalDecision: 'ready_for_human_approval', blockers: [], developmentReady: true, productionReady: true, validationStepCount: 2}},
  }]}));
  expect(plannedValidation()).toBe('2 steps');
  expect(overview.getByText('Requested by').nextElementSibling?.textContent).toBe('Unavailable');
  expect(overview.getByText('Scope').nextElementSibling?.textContent).toBe('1 app · 1 repo');
  expect(prerequisites()).toBe('Ready for human review');
  expect(approvals.getByText('Check release review for the saved merge decision.')).toBeTruthy();
  const lifecycle = within(screen.getByRole('region', {name: 'Selected release lifecycle'}));
  const approvalStep = lifecycle.getByText('Ready for review').closest('li');
  expect(approvalStep?.querySelector('[data-review-ready="true"]')?.textContent).toBe('3');
  expect(approvalStep?.querySelector('[data-recorded]')).toBeNull();
  expect(readiness.queryByText('Recovery backup')).toBeNull();
});
it.each([
  {prStatus:'pending', noPrRequired:true},
  {prStatus:'not_applicable', noPrRequired:false},
])('does not offer PR review when the saved approval evidence is %j', async approval => {
  const current = request('A');
  m.requests.mockResolvedValue({ok:true, data:[{...current,
    releaseContext:{...current.releaseContext, approval,
      readiness:{...current.releaseContext.readiness, approvalDecision:'ready_for_human_approval', blockers:[]}}}]});
  await mountA();
  const lifecycle = within(screen.getByRole('region', {name:'Selected release lifecycle'}));
  const approvalStep = lifecycle.getByText('PR review not required').closest('li');
  expect(approvalStep?.querySelector('[data-review-ready]')).toBeNull();
  expect(approvalStep?.querySelector('[data-recorded]')).toBeNull();
  const approvals = within(screen.getByRole('region', {name:'Recorded approvals'}));
  expect(approvals.getByText('PR not required')).toBeTruthy();
  expect(approvals.queryByText('Check release review for the saved merge decision.')).toBeNull();
  expect(screen.queryByRole('button', {name:'View release review'})).toBeNull();
});

it('keeps browser handoff keyboard focus and lets the operator retry a failed launch', async () => {
  m.openBrowser.mockRejectedValueOnce(new Error('Native launch refused')).mockResolvedValueOnce(undefined);
  await mountA();
  screen.getByText('Recorded release details').closest('details')!.open = true;
  const overview = within(screen.getByRole('region', {name: 'Release overview'}));
  const launch = overview.getByRole('button', {name: 'Open Agent Approval Center in browser'});
  launch.focus();

  fireEvent.click(launch);
  expect((await overview.findByRole('alert')).textContent).toContain('https://visionxixlabs.com/control/governance');
  expect(document.activeElement).toBe(launch);

  await act(async () => { fireEvent.click(launch); });
  expect(m.openBrowser.mock.calls).toEqual([
    ['https://visionxixlabs.com/control/governance'],
    ['https://visionxixlabs.com/control/governance'],
  ]);
  expect(overview.queryByRole('alert')).toBeNull();
  expect(document.activeElement).toBe(launch);
});
it('keeps a recorded validation deferral visible when no steps have been saved', async () => {
  const current = request('A');
  m.requests.mockResolvedValue({ok: true, data: [{
    ...current,
    releaseContext: {...current.releaseContext,
      readiness: {...current.releaseContext.readiness, deferredValidation: true},
      observation: {...current.releaseContext.observation, recordedMonitoringPlan: true}},
  }]});
  await mountA();
  const readiness = within(screen.getByRole('region', {name: 'Recorded readiness'}));
  expect(readiness.getByText('Planned validation').nextElementSibling?.textContent).toBe('No steps recorded · deferred');
  const lifecycle = within(screen.getByRole('region', {name: 'Selected release lifecycle'}));
  const [plan, validate, approve, deploy, verify] = lifecycle.getAllByRole('listitem');
  expect(plan.querySelector('[data-recorded="true"]')).toBeTruthy();
  expect(within(validate).getByText('No steps recorded')).toBeTruthy();
  expect(within(validate).getByText('Deferral recorded')).toBeTruthy();
  expect(within(verify).getByText('Verification unavailable')).toBeTruthy();
  expect(within(verify).getByText('Monitoring plan recorded')).toBeTruthy();
  for (const stage of [validate, approve, deploy, verify]) {
    expect(stage.querySelector('[data-recorded]')).toBeNull();
  }
});
async function openCurrentVersionTwo() {
  const row = await screen.findByRole('button', {name: /Release A.*Version 2/});
  expect(row.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(row);
}

it('keeps an outcome draft attached to its original version across a directory refresh', async () => {
  await mountA();
  fireEvent.click(screen.getByRole('button', {name: /Record external outcome and close request/}));
  const reference = screen.getByPlaceholderText('Validation or change reference');
  fireEvent.change(reference, {target: {value: 'version-one-evidence'}});
  fireEvent.change(screen.getByPlaceholderText('Recorded outcome summary'), {target: {value: 'Version one outcome'}});
  const submit = screen.getByRole<HTMLButtonElement>('button', {name: 'Record closure'});
  const pending = deferred();
  m.requests.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  expect(submit.disabled).toBe(true);
  fireEvent.click(submit);
  expect(m.close).not.toHaveBeenCalled();

  await act(async () => pending.resolve({ok: true, data: [{...request('A'), version: 2}]}));
  expect(submit.disabled).toBe(true);
  expect(screen.getByText(/This draft is for version 1.*version 2/)).toBeTruthy();
  expect(reference).toHaveProperty('value', 'version-one-evidence');
  fireEvent.click(submit);
  expect(m.close).not.toHaveBeenCalled();

  await openCurrentVersionTwo();
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  fireEvent.click(screen.getByRole('button', {name: /Record external outcome and close request/}));
  expect(screen.getByPlaceholderText('Validation or change reference')).toHaveProperty('value', '');
  fireEvent.change(screen.getByPlaceholderText('Validation or change reference'), {target: {value: 'version-two-evidence'}});
  fireEvent.change(screen.getByPlaceholderText('Recorded outcome summary'), {target: {value: 'Version two outcome'}});
  m.close.mockResolvedValue({ok: false, error: 'closure_evidence_required'});
  fireEvent.click(screen.getByRole('button', {name: 'Record closure'}));
  await screen.findByText(/Enter a validation or change reference/);
  expect(m.close).toHaveBeenCalledExactlyOnceWith('request-A', 2, 'version-two-evidence', 'Version two outcome');
});
it('focuses the labeled closure draft and returns to its release action on cancel', async () => {
  await mountA();
  const open = screen.getByRole('button', {name: /Record external outcome and close request/});
  open.focus();
  fireEvent.click(open);
  const draft = screen.getByRole('group', {name: 'Record external outcome'});
  expect(document.activeElement).toBe(within(draft).getByRole('textbox', {name: 'Validation or change reference'}));
  expect(within(draft).getByRole('textbox', {name: 'Recorded outcome summary'})).toBeTruthy();

  fireEvent.click(within(draft).getByRole('button', {name: 'Cancel'}));
  const restored = screen.getByRole('button', {name: /Record external outcome and close request/});
  expect(document.activeElement).toBe(restored);
  expect(m.close).not.toHaveBeenCalled();
  expect(m.exact).not.toHaveBeenCalled();
});

it('returns cancel focus to Refresh while the release is being checked', async () => {
  await mountA();
  fireEvent.click(screen.getByRole('button', {name: /Record external outcome and close request/}));
  const refresh = screen.getByRole('button', {name: 'Refresh'});
  const pending = deferred();
  m.requests.mockReturnValueOnce(pending.promise);
  fireEvent.click(refresh);
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

  expect(document.activeElement).toBe(refresh);
  const open = screen.getByRole<HTMLButtonElement>('button', {name: /Record external outcome and close request/});
  expect(open.disabled).toBe(true);
  fireEvent.click(open);
  expect(screen.queryByRole('group', {name: 'Record external outcome'})).toBeNull();
  await act(async () => pending.resolve({ok: true, data: [request('A')]}));
  expect(open.disabled).toBe(false);
  expect(document.activeElement).toBe(refresh);
  expect(m.close).not.toHaveBeenCalled();
});

it("keeps an unsent closure draft across release switches and remounts", async () => {
  const releaseClosureDrafts = createReleaseClosureDrafts(m.config, m.revision);
  m.requests.mockResolvedValue({ok: true, data: [request("A"), request("B")]});
  const mount = () => render(createElement(DeploymentRequestsWorkspace, {releaseClosureDrafts}));
  const open = () => fireEvent.click(screen.getByRole("button", {name: /Record external outcome and close request/}));
  const reference = () => screen.getByRole<HTMLInputElement>("textbox", {name: "Validation or change reference"});
  const view = mount();
  await screen.findByRole("button", {name: /Release A/});
  open();
  fireEvent.change(reference(), {target: {value: "A-only-reference"}});
  fireEvent.click(screen.getByRole("button", {name: /Release B/}));
  open();
  expect(reference().value).toBe("");
  fireEvent.change(reference(), {target: {value: "B-only-reference"}});
  view.unmount();

  const returned = mount();
  fireEvent.click(await screen.findByRole("button", {name: "Resume closure draft"}));
  expect(reference().value).toBe("A-only-reference");
  fireEvent.click(screen.getByRole("button", {name: /Release B/}));
  fireEvent.click(screen.getByRole("button", {name: "Resume closure draft"}));
  expect(reference().value).toBe("B-only-reference");

  await act(async () => replaceContext("revision"));
  await screen.findByRole("button", {name: /Release B/});
  expect(screen.queryByRole("button", {name: "Resume closure draft"})).toBeNull();
  expect(m.close).not.toHaveBeenCalled();
  returned.unmount();
});

it("keeps an in-flight closure locked on return and requires an exact check after the response is lost", async () => {
  const releaseClosureDrafts = createReleaseClosureDrafts(m.config, m.revision);
  const mount = () => render(createElement(DeploymentRequestsWorkspace, {releaseClosureDrafts}));
  const pending = deferred();
  m.close.mockReturnValueOnce(pending.promise);
  const view = mount();
  fireEvent.click(await screen.findByRole("button", {name: /Record external outcome and close request/}));
  fireEvent.change(screen.getByRole("textbox", {name: "Validation or change reference"}), {target: {value: "validation-ref"}});
  fireEvent.change(screen.getByRole("textbox", {name: "Recorded outcome summary"}), {target: {value: "Reported result"}});
  fireEvent.click(screen.getByRole("button", {name: "Record closure"}));
  view.unmount();

  mount();
  const resume = await screen.findByRole<HTMLButtonElement>("button", {name: "Resume closure draft"});
  expect(resume.disabled).toBe(true);
  await act(async () => pending.resolve({ok: false, error: "Response lost"}));
  expect(resume.disabled).toBe(false);
  fireEvent.click(resume);
  expect(screen.getByRole("textbox", {name: "Validation or change reference"})).toHaveProperty("value", "validation-ref");
  expect(screen.queryByRole("button", {name: "Record closure"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Close draft"}));
  fireEvent.click(screen.getByRole("button", {name: "Resume closure draft"}));
  m.exact.mockResolvedValueOnce({ok: true, data: {...request("A"), status: "closed", closedAt: "2030-01-01T00:01:00.000Z"}});
  fireEvent.click(screen.getByRole("button", {name: "Check closure status"}));
  await screen.findByText(/^Closure recorded/);
  expect(m.close).toHaveBeenCalledExactlyOnceWith("request-A", 1, "validation-ref", "Reported result");
  expect(m.exact).toHaveBeenCalledExactlyOnceWith({id: "request-A", version: 1}, true);
  expect(releaseClosureDrafts.getSnapshot().size).toBe(0);
});

it.each([1, 2])('only accepts a closure response bound to the submitted version (receipt version %i)', async version => {
  await mountA();
  fireEvent.click(screen.getByRole('button', {name: /Record external outcome and close request/}));
  fireEvent.change(screen.getByPlaceholderText('Validation or change reference'), {target:{value:'confirmed-reference'}});
  fireEvent.change(screen.getByPlaceholderText('Recorded outcome summary'), {target:{value:'External outcome'}});
  m.close.mockResolvedValueOnce({ok:true, data:{id:'request-A',version,status:'closed',closedAt:'2030-01-01T00:01:00.000Z'}});
  await act(async () => fireEvent.click(screen.getByRole('button', {name:'Record closure'})));
  if (version === 1) {
    expect(screen.getByText(/^Closure recorded/)).toBeTruthy();
    expect(screen.queryByPlaceholderText('Recorded outcome summary')).toBeNull();
  } else {
    expect(screen.queryByText(/^Closure recorded/)).toBeNull();
    expect(screen.getByRole('button', {name:'Check closure status'})).toBeTruthy();
    expect(screen.getByPlaceholderText('Recorded outcome summary')).toHaveProperty('value','External outcome');
  }
  expect(m.exact).not.toHaveBeenCalled();
});

it.each(["closed", "still open", "wrong version", "read failed"] as const)(
  "checks the exact saved release after a lost closure response: %s",
  async outcome => {
    await mountA();
    fireEvent.click(screen.getByRole('button', {name: /Record external outcome and close request/}));
    const reference = screen.getByPlaceholderText('Validation or change reference');
    const summary = screen.getByPlaceholderText('Recorded outcome summary');
    fireEvent.change(reference, {target: {value: 'closure-reference'}});
    fireEvent.change(summary, {target: {value: 'Reported external result'}});
    m.close.mockResolvedValueOnce({ok:false,error:'Connection lost'});
    fireEvent.click(screen.getByRole('button', {name: 'Record closure'}));
    const check = await screen.findByRole('button', {name: 'Check closure status'});
    expect(screen.queryByRole('button', {name: 'Record closure'})).toBeNull();
    expect(m.exact).not.toHaveBeenCalled();
    expect(reference).toHaveProperty('readOnly',true);
    m.exact.mockResolvedValueOnce(outcome === "read failed" ? {ok:false,error:'Read failed'} : {ok:true,data:{
      ...request('A'),
      version: outcome === "wrong version" ? 2 : 1,
      ...(outcome === "closed" ? {status:'closed',closedAt:'2030-01-01T00:01:00.000Z'} : {}),
    }});
    check.focus();
    await act(async () => fireEvent.click(check));
    expect(m.exact).toHaveBeenCalledExactlyOnceWith({id:'request-A',version:1},true);
    expect(m.close).toHaveBeenCalledExactlyOnceWith('request-A',1,'closure-reference','Reported external result');
    if (outcome === "closed") {
      expect(document.activeElement).toBe(screen.getByText(/^Closure recorded/));
      expect(screen.queryByPlaceholderText('Recorded outcome summary')).toBeNull();
    } else {
      expect(reference).toHaveProperty('value','closure-reference');
      expect(summary).toHaveProperty('value','Reported external result');
      expect(document.activeElement).toBe(check);
      const nextAction = outcome === "still open" ? 'Record closure' : 'Check closure status';
      expect(screen.getByRole('button', {name: nextAction})).toBe(check);
      expect(reference).toHaveProperty('readOnly',outcome !== 'still open');
    }
  },
);

it.each(['config','revision'] as const)('prevents a late old closure completion from refreshing or changing new work after %s replacement',async boundary=>{
 await mountA();const a=deferred();m.close.mockReturnValueOnce(a.promise);fireEvent.click(screen.getByRole('button',{name:/Record external outcome and close request/}));fireEvent.change(screen.getByPlaceholderText('Validation or change reference'),{target:{value:'fixture-reference'}});fireEvent.change(screen.getByPlaceholderText('Recorded outcome summary'),{target:{value:'Fixture reported outcome only'}});fireEvent.click(screen.getByRole('button',{name:'Record closure'}));expect(m.close).toHaveBeenCalledWith('request-A',1,'fixture-reference','Fixture reported outcome only');
 await act(async()=>replaceContext(boundary));await screen.findByRole('button',{name:/Release B/});const requests=m.requests.mock.calls.length,executions=m.executions.mock.calls.length;
 await act(async()=>a.resolve({ok:true,data:{}}));expect(m.requests).toHaveBeenCalledTimes(requests);expect(m.executions).toHaveBeenCalledTimes(executions);expect(m.close).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:/Release B/})).toBeTruthy();expect(screen.queryByPlaceholderText('Recorded outcome summary')).toBeNull();
});

it.each(['config','revision'] as const)('refuses retained refresh and closure handlers during the synchronous %s transition before notification',async boundary=>{
 await mountA();fireEvent.click(screen.getByRole('button',{name:/Record external outcome and close request/}));fireEvent.change(screen.getByPlaceholderText('Validation or change reference'),{target:{value:'fixture-reference'}});fireEvent.change(screen.getByPlaceholderText('Recorded outcome summary'),{target:{value:'Fixture outcome'}});
 const refresh=screen.getByRole('button',{name:'Refresh'}),close=screen.getByRole('button',{name:'Record closure'}),reads=m.requests.mock.calls.length;
 // Exercise retained mounted event handlers before the external-store signal
 // can replace their subtree. Owner checks must use the actual client state.
 m.scope='B';if(boundary==='config')m.config={apiBase:'https://workspace-b.example.test'};else m.revision++;
 fireEvent.click(close);fireEvent.click(refresh);expect(m.close).not.toHaveBeenCalled();expect(m.requests).toHaveBeenCalledTimes(reads);
 await act(async()=>{for(const listener of [...m.listeners])listener()});await screen.findByRole('button',{name:/Release B/});expect(screen.queryByPlaceholderText('Recorded outcome summary')).toBeNull();
});


it('leaves the target and workflow inputs unset when starting a release', async () => {
  await mountA();
  fireEvent.click(screen.getByRole('button', {name: 'New release'}));

  const target = screen.getByLabelText<HTMLInputElement>('Target environment');
  expect(target.value).toBe('');
  expect(target.required).toBe(true);
  expect(screen.queryByLabelText('Input name 1')).toBeNull();
});

it.each([
  {intake: {targetEnvironment: 'Staging', workflowInputs: {environment: 'staging'}}, target: 'Staging'},
  {intake: {workflowInputs: {environment: 'staging'}}, target: ''},
])('restores recorded workflow inputs and uses the recorded target only ($target)', async ({intake, target}) => {
  m.revisionSeed.mockResolvedValue({ok: true, data: {id: 'request-A', version: 1, intake}});
  await mountA();
  fireEvent.click(screen.getByRole('button', {name: 'Revise'}));

  expect((await screen.findByLabelText<HTMLInputElement>('Target environment')).value).toBe(target);
  expect(screen.getByLabelText<HTMLInputElement>('Input name 1').value).toBe('environment');
  expect(screen.getByLabelText<HTMLInputElement>('Input value 1').value).toBe('staging');
});

it.each([
  {id: 'request-A', version: 2, intake: {title: 'Newer private release'}},
  {id: 'another-release', version: 1, intake: {title: 'Different private release'}},
])('keeps $id v$version out of the editor when the user selected request-A v1', async seed => {
  await mountA();
  const revise = screen.getByRole('button', {name: 'Revise'});
  revise.focus();
  m.revisionSeed.mockResolvedValue({ok: true, data: seed});
  fireEvent.click(revise);
  await act(async () => {});
  expect(screen.queryByRole('heading', {name: /Revise release request/})).toBeNull();
  expect(screen.getByRole('button', {name: 'Revise'})).toBe(revise);
  expect(document.activeElement).toBe(revise);
  expect(screen.getByText('The selected release version could not be verified. Refresh releases, then choose the version to revise.')).toBeTruthy();
  expect(m.revisionSeed).toHaveBeenCalledExactlyOnceWith('request-A', 1);

  m.requests.mockResolvedValueOnce({ok: true, data: [{...request('A'), version: 2}]});
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  await openCurrentVersionTwo();
  expect(screen.queryByRole('heading', {name: /Revise release request/})).toBeNull();
  m.revisionSeed.mockResolvedValueOnce({ok: true, data: {id: 'request-A', version: 2, intake: {title: 'Current release'}}});
  fireEvent.click(screen.getByRole('button', {name: 'Revise'}));
  const heading = await screen.findByRole('heading', {name: 'Revise release request · v2 → v3'});
  expect(document.activeElement).toBe(heading);
  expect(m.revisionSeed).toHaveBeenLastCalledWith('request-A', 2);
});

it.each(['refresh', 'selection'] as const)('ignores a delayed exact editor read after a %s change', async change => {
  m.requests.mockResolvedValueOnce({ok: true, data: [request('A'), request('B')]});
  await mountA();
  const pending = deferred();
  m.revisionSeed.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button', {name: 'Revise'}));
  if (change === 'refresh') {
    m.requests.mockResolvedValueOnce({ok: true, data: [{...request('A'), version: 2}, request('B')]});
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    await openCurrentVersionTwo();
  } else {
    fireEvent.click(screen.getByRole('button', {name: /Release B/}));
    expect(screen.getByRole('heading', {name: 'Release B'})).toBeTruthy();
  }
  await act(async () => pending.resolve({ok: true, data: {id: 'request-A', version: 1, intake: {title: 'Original release'}}}));
  expect(screen.queryByRole('heading', {name: /Revise release request/})).toBeNull();
  expect(screen.getByRole('button', {name: 'Revise'})).toBeTruthy();
});

it('can open the refreshed version before an older editor read finishes', async () => {
  await mountA();
  const older = deferred();
  m.revisionSeed.mockReturnValueOnce(older.promise)
    .mockResolvedValueOnce({ok: true, data: {id: 'request-A', version: 2, intake: {title: 'Current release'}}});
  fireEvent.click(screen.getByRole('button', {name: 'Revise'}));
  m.requests.mockResolvedValueOnce({ok: true, data: [{...request('A'), version: 2}]});
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  await openCurrentVersionTwo();
  fireEvent.click(screen.getByRole('button', {name: 'Revise'}));
  const heading = await screen.findByRole('heading', {name: 'Revise release request · v2 → v3'});
  await act(async () => older.resolve({ok: true, data: {id: 'request-A', version: 1, intake: {title: 'Old release'}}}));
  expect(document.activeElement).toBe(heading);
  expect(screen.queryByRole('heading', {name: 'Revise release request · v1 → v2'})).toBeNull();
});

it("opens the exact Terraform review inside Evidence and closes it when the directory refreshes", async () => {
  await mountA();
  const planning = screen.getByText("Planning tools").closest("details")!;
  planning.open = true;
  fireEvent.click(within(planning).getByRole("button",{name:"Review Terraform evidence"}));
  const evidence = screen.getByRole("region",{name:"Release evidence"});
  expect(document.activeElement).toBe(evidence);
  expect(within(evidence).getByRole("region",{name:"Terraform saved plan review"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Refresh"}));
  expect(screen.queryByRole("region",{name:"Terraform saved plan review"})).toBeNull();
  await screen.findByRole("button",{name:"Review history"});
  expect(screen.queryByRole("region",{name:"Terraform saved plan review"})).toBeNull();
});

it("focuses Evidence and keeps revision history through the selected version", async () => {
  await mountA();
  const row = {author:"You", createdAt:"2026-11-24T00:00:00.000Z",version:1,changes:["Initial release"]};
  m.history.mockResolvedValueOnce({ok:true,data:[{...row,version:2,changes:["Newer scope"]},row]});
  fireEvent.click(screen.getByRole("button",{name:"Review history"}));
  const evidence = screen.getByRole("region",{name:"Release evidence"});
  expect(document.activeElement).toBe(evidence);
  expect(screen.getByRole("button",{name:"Evidence"}).getAttribute("aria-current")).toBe("location");
  expect(await within(evidence).findByText("Initial release")).toBeTruthy();
  const recorded = evidence.querySelector('time[datetime="2026-11-24T00:00:00.000Z"]');
  expect(recorded?.textContent).toMatch(/2026.*12:00:00.*UTC/);
  expect(screen.queryByText("Newer scope")).toBeNull();
  expect(m.history).toHaveBeenCalledExactlyOnceWith("request-A",1);
});

it("discards a delayed history read after refresh and recovers an unavailable request-wide ledger inside Evidence", async () => {
  await mountA();
  const history = deferred();
  m.history.mockReturnValueOnce(history.promise);
  fireEvent.click(screen.getByRole("button",{name:"Review history"}));
  m.requests.mockResolvedValueOnce({ok:true,data:[{...request("A"),version:2}]});
  fireEvent.click(screen.getByRole("button",{name:"Refresh"}));
  await openCurrentVersionTwo();
  await act(async () => history.resolve({ok:true,data:[{version:1,author:"You",createdAt:"2026-11-24T00:00:00.000Z",changes:["Retired history"]}]}));
  expect(screen.queryByText("Retired history")).toBeNull();

  m.operations.mockResolvedValueOnce({ok:false,error:"service_unavailable"}).mockResolvedValueOnce({ok:true,data:[]});
  fireEvent.click(screen.getByRole("button",{name:"Review execution controls"}));
  const evidence = within(screen.getByRole("region",{name:"Release evidence"}));
  expect((await evidence.findByRole("alert")).textContent).toContain("Request-wide operation history could not be loaded");
  expect(screen.queryByText(/no entries in the operation ledger/)).toBeNull();
  fireEvent.click(evidence.getByRole("button",{name:"Retry operation history"}));
  expect(await evidence.findByText("Read-only durable operation status across request versions.")).toBeTruthy();
  expect(evidence.getByText(/no entries in the operation ledger/).textContent).toContain("does not show whether a release dispatch, approval or attempt occurred");
  expect(evidence.getByText(/not bound to release version 2 or to a workflow attempt/)).toBeTruthy();
  expect(evidence.queryByText(/No consequential operation/)).toBeNull();
  expect(m.operations.mock.calls).toEqual([["request-A"],["request-A"]]);
});

it("checks the generated playbook's release binding and hides the old result on refresh", async () => {
  await mountA();
  const metadata = {id:"plan", requestId:"request-A", requestVersion:2, version:1, status:"submitted",
    contentHash:"c".repeat(64), scope:"Current scope", stepCount:0, steps:[]};
  m.playbookGenerate.mockResolvedValueOnce({ok:true, data:metadata})
    .mockImplementationOnce(async (_id, _version, attemptId) => ({ok:true, data:{...metadata,requestVersion:1,attemptId}}));
  const planning = screen.getByText("Planning tools").closest("details")!;
  planning.open = true;
  fireEvent.click(within(planning).getByRole("button",{name:"Generate next playbook"}));
  await screen.findByText(/Playbook generation could not be confirmed/);
  expect(screen.queryByText("Playbook v1 persisted")).toBeNull();
  expect(m.playbookGenerate).toHaveBeenCalledExactlyOnceWith("request-A",1,expect.any(String));
  const attempt = m.playbookGenerate.mock.calls[0][2];
  expect(attempt).toMatch(/^[0-9a-f-]{36}$/);
  fireEvent.click(screen.getByRole("button",{name:"Refresh"}));
  await screen.findByText("Retry same playbook");

  fireEvent.click(within(planning).getByRole("button",{name:"Retry same playbook"}));
  expect(await screen.findByText("Playbook v1 persisted")).toBeTruthy();
  expect(m.playbookGenerate.mock.calls).toEqual([["request-A",1,attempt],["request-A",1,attempt]]);
  m.requests.mockResolvedValueOnce({ok:true,data:[{...request("A"),version:2}]});
  fireEvent.click(screen.getByRole("button",{name:"Refresh"}));
  await screen.findByRole("button",{name:/Release A.*Version 2/});
  expect(screen.queryByText("Playbook v1 persisted")).toBeNull();
});

it("restores a pending playbook identity across remounts without offering it on other releases or versions", async () => {
  const pendingPlaybookAttempts = new Map<string,string>();
  const generation = deferred();
  m.playbookGenerate.mockReturnValueOnce(generation.promise);
  const home = render(createElement(DeploymentRequestsWorkspace, {pendingPlaybookAttempts}));
  await screen.findByRole("button", {name:/Release A/});
  const generate = (label: string) => {
    const planning = screen.getByText("Planning tools").closest("details")!;
    planning.open = true;
    const button = within(planning).getByRole("button", {name:label});
    fireEvent.click(button);
  };
  generate("Generate next playbook");
  const attempt = m.playbookGenerate.mock.calls[0][2];
  home.unmount();
  await act(async () => generation.resolve({ok:false,error:"network_unavailable"}));

  const current = request("A");
  m.requests.mockResolvedValueOnce({ok:true,data:[{...current,version:2},request("B")]});
  const other = render(createElement(DeploymentRequestsWorkspace, {pendingPlaybookAttempts}));
  await screen.findByRole("button", {name:/Release A.*Version 2/});
  expect(screen.queryByText("Retry same playbook")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:/Release B/}));
  expect(screen.queryByText("Retry same playbook")).toBeNull();
  other.unmount();

  const unrelated = render(createElement(DeploymentRequestsWorkspace, {pendingPlaybookAttempts:new Map()}));
  await screen.findByRole("button", {name:/Release A/});
  expect(screen.queryByText("Retry same playbook")).toBeNull();
  unrelated.unmount();

  m.playbookGenerate.mockResolvedValueOnce({ok:true,data:{id:"plan",requestId:current.id,requestVersion:1,
    attemptId:attempt,version:1,status:"submitted",contentHash:"c".repeat(64),steps:[],stepCount:0,scope:"Owned fixture"}});
  render(createElement(DeploymentRequestsWorkspace, {pendingPlaybookAttempts}));
  await screen.findByText(/Playbook generation is unconfirmed/);
  generate("Retry same playbook");
  await screen.findByText("Playbook v1 persisted");
  expect(m.playbookGenerate.mock.calls).toEqual([[current.id,1,attempt],[current.id,1,attempt]]);
  expect(pendingPlaybookAttempts.size).toBe(0);
});

it("opens historical instructions only when the read matches the recorded playbook", async () => {
  const recorded = {id:"plan",version:1,status:"superseded",contentHash:"b".repeat(64),createdAt:"2030-01-01T00:00:00Z"};
  m.requests.mockResolvedValueOnce({ok:true,data:[{...request("A"),latestPlaybook:recorded}]});
  await mountA();
  const response = {requestId:"request-A",...recorded,scope:"Historical fixture",stepCount:0,steps:[]};
  m.playbookRead.mockResolvedValueOnce({ok:true,data:{...response,version:2,id:"other-plan"}})
    .mockResolvedValueOnce({ok:true,data:response});
  const open = screen.getByRole("button",{name:"Review historical playbook"});
  fireEvent.click(open);
  await screen.findByText(/The recorded playbook could not be verified/);
  expect(screen.queryByText("Historical fixture")).toBeNull();
  fireEvent.click(open);
  expect(await screen.findByText("Playbook v1 · superseded")).toBeTruthy();
  expect(screen.getByText("Historical fixture")).toBeTruthy();
  expect(m.playbookGenerate).not.toHaveBeenCalled();
});

it('clears batch evidence and controls during an unsuccessful refresh and binds the next check to the current version', async () => {
  const original = request('A');
  const withBatches = {...original, releaseContext: {...original.releaseContext, batches: {selectedRunCount: 1}}};
  m.requests.mockResolvedValueOnce({ok: true, data: [withBatches]});
  m.batchReadiness.mockResolvedValueOnce({ok: true, data: {ready: true, requestVersion: 1}});
  await mountA();
  fireEvent.click(screen.getByRole('button', {name: 'Check batches'}));
  await screen.findByText('Selected batches completed. Release approval is still required.');

  const pending = deferred();
  m.requests.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  expect(screen.getByText('Refreshing releases…')).toBeTruthy();
  expect(screen.queryByRole('button', {name: 'Check batches'})).toBeNull();
  expect(screen.queryByRole('button', {name: 'Monitor batches'})).toBeNull();
  expect(screen.queryByText(/Selected batches completed/)).toBeNull();
  await act(async () => pending.resolve({ok: false, error: 'Synthetic read unavailable'}));
  expect(screen.queryByRole('button', {name: 'Check batches'})).toBeNull();

  m.requests.mockResolvedValueOnce({ok: true, data: [{...withBatches, version: 2}]});
  m.batchReadiness.mockResolvedValueOnce({ok: true, data: {ready: false, reason: 'waiting'}});
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  await openCurrentVersionTwo();
  const check = await screen.findByRole('button', {name: 'Check batches'});
  expect(m.batchReadiness).toHaveBeenCalledExactlyOnceWith('request-A', 1);
  fireEvent.click(check);
  await screen.findByText('Selected batches have not all completed yet. This is normal while they run; check again later.');
  expect(m.batchReadiness).toHaveBeenLastCalledWith('request-A', 2);
});

it('withholds displayed and in-flight GitHub evidence across release refresh', async () => {
  const evidence = {ok: true, data: {mode: 'read_only_evidence', requestId: 'request-A', requestVersion: 1,
    repositories: [{repository: 'fixture/payments', state: 'observed', branchProtection: 'protected', latestWorkflow: 'passed'}],
    pullRequests: []}};
  m.githubEvidence.mockResolvedValueOnce(evidence);
  await mountA();
  const collect = () => screen.getByRole<HTMLButtonElement>('button', {name: 'Collect GitHub evidence'});
  const refresh = () => fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  fireEvent.click(collect());
  await screen.findByText('GitHub release evidence');

  const reload = deferred();
  m.requests.mockReturnValueOnce(reload.promise);
  refresh();
  expect(screen.queryByText('GitHub release evidence')).toBeNull();
  expect(collect().disabled).toBe(true);
  await act(async () => reload.resolve({ok: true, data: [request('A')]}));
  expect(screen.queryByText('GitHub release evidence')).toBeNull();

  const priorRead = deferred();
  m.githubEvidence.mockReturnValueOnce(priorRead.promise);
  fireEvent.click(collect());
  refresh();
  await act(async () => priorRead.resolve(evidence));
  expect(screen.queryByText('GitHub release evidence')).toBeNull();

  m.githubEvidence.mockResolvedValueOnce(evidence);
  fireEvent.click(collect());
  await screen.findByText('GitHub release evidence');
  expect(m.githubEvidence.mock.calls).toEqual([['request-A', 1], ['request-A', 1], ['request-A', 1]]);
});

it('withholds ticket controls during a failed release refresh and restores its exact draft on retry', async () => {
  await mountA();
  const ticketPanel = () => screen.queryByRole('region', {name: 'Release ticket workspace'});
  const draft = screen.getByRole('textbox', {name: 'Fixture ticket draft'});
  fireEvent.change(draft, {target: {value: 'Retained ticket draft'}});
  const holder = ticketPanel()!.parentElement!;
  const pending = deferred();
  m.requests.mockReturnValueOnce(pending.promise);
  const refresh = () => fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));

  refresh();
  expect(ticketPanel()).toBeNull();
  expect(holder.hasAttribute('inert')).toBe(true);
  await act(async () => pending.resolve({ok: false, error: 'Synthetic read unavailable'}));
  expect(ticketPanel()).toBeNull();
  expect(screen.getByText('Refresh releases to verify this version before opening ticket actions.')).toBeTruthy();

  refresh();
  await screen.findByRole('region', {name: 'Release ticket workspace'});
  expect(holder.hasAttribute('inert')).toBe(false);
  expect(screen.getByRole('textbox', {name: 'Fixture ticket draft'})).toBe(draft);
  expect(draft).toHaveProperty('value', 'Retained ticket draft');

  m.requests.mockResolvedValueOnce({ok: true, data: [{...request('A'), version: 2}]});
  refresh();
  await openCurrentVersionTwo();
  await screen.findByRole('region', {name: 'Release ticket workspace'});
  expect(ticketPanel()?.dataset.releaseVersion).toBe('2');
  expect(screen.getByRole('textbox', {name: 'Fixture ticket draft'})).toHaveProperty('value', '');
});

it("shows request ledger times as machine-readable UTC and never guesses an invalid time", async () => {
  await mountA();
  m.operations.mockResolvedValueOnce({ok:true,data:[
    {kind:"dispatch_workflow",status:"succeeded",attemptCount:1,createdAt:"2026-11-24T08:05:09.000Z",lastAttemptAt:null,lastReconciledAt:"not-a-time",externallyReferenced:false},
  ]});
  fireEvent.click(screen.getByRole("button",{name:"Review execution controls"}));
  const evidence = screen.getByRole("region",{name:"Release evidence"});
  const entry = await within(evidence).findByText(/dispatch workflow · succeeded/);
  const detail = entry.nextElementSibling!;
  expect(detail.querySelector('time[datetime="2026-11-24T08:05:09.000Z"]')?.textContent).toMatch(/8:05:09.*UTC/);
  expect(detail.textContent).toContain("reconciled time unavailable");
  expect(detail.querySelectorAll("time")).toHaveLength(1);
});

it("shows the recorded closure time as machine-readable UTC", async () => {
  m.requests.mockImplementation(async()=>({ok:true,data:[{...request("A"),status:"closed",closedAt:"2026-11-24T10:15:00.000Z"}]}));
  render(createElement(DeploymentRequestsWorkspace));
  const note = await screen.findByText(/Closure recorded/);
  expect(note.querySelector('time[datetime="2026-11-24T10:15:00.000Z"]')?.textContent).toMatch(/10:15:00.*UTC/);
});
