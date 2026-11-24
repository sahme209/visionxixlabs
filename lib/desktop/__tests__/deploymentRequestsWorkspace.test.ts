/** @vitest-environment jsdom */
import {createElement} from 'react';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({config:{marker:'A'},revision:0,scope:'A',listeners:new Set<()=>void>(),requests:vi.fn(),executions:vi.fn(),observe:vi.fn(),close:vi.fn(),revisionSeed:vi.fn(),batchReadiness:vi.fn(),githubEvidence:vi.fn(),openBrowser:vi.fn()}));
vi.mock("@tauri-apps/plugin-shell", () => ({open: m.openBrowser}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.config},getContextRevision:()=>m.revision,subscribeContext:(listener:()=>void)=>{m.listeners.add(listener);return()=>{m.listeners.delete(listener)}},deploymentRequests:m.requests,listDeploymentExecutions:m.executions,observeDeploymentExecution:m.observe,closeDeploymentRequest:m.close,deploymentRequestForRevision:m.revisionSeed,releaseBatchReadiness:m.batchReadiness,collectGitHubReleaseEvidence:m.githubEvidence}}));
// Provider review/execution panels are outside this view-state ownership seam.
vi.mock('../../../desktop/src/components/ReleaseTicketWorkspace',()=>({ReleaseTicketWorkspace:()=>null}));
vi.mock('../../../desktop/src/components/ReleaseMergeReview',()=>({ReleaseMergeReview:()=>null}));
// The wrapper and view are real; only their service boundary is simulated.
import {DeploymentRequestsWorkspace} from '../../../desktop/src/views/DeploymentRequestsWorkspace';
const releaseContext={window:null,scope:{applicationCount:1,repositoryCount:1,targetEnvironment:'Test'},approval:{prStatus:'pending',noPrRequired:true},readiness:{developmentReady:false,productionReady:false,validationStepCount:0,deferredValidation:false,approvalDecision:'needs_attention',blockers:['Fixture source review']},recovery:{rollbackAvailability:'unknown',backupRequired:false,evidenceCount:0},observation:{status:'not_connected',recordedMonitoringPlan:false}};
const request=(scope:string)=>({id:'request-'+scope,title:'Release '+scope,status:'submitted',version:1,correlationId:'correlation-'+scope,submittedAt:'2030-01-01T00:00:00Z',closedAt:null,updatedAt:'2030-01-01T00:00:00Z',latestPlaybook:null,releaseContext});
const execution=(scope:string)=>({id:'execution-'+scope,environmentId:'environment-'+scope,repositoryFullName:'fixture/'+scope,sourceRef:null,sourceKind:null,sourceCommitSha:null,branchPolicyId:null,pullRequestUrl:null,workflowRunId:'run-'+scope,workflowUrl:null,source:'github',status:'in_progress',conclusion:null,rollbackStatus:'not_requested',lastObservedAt:null,completedAt:null,createdAt:'2030-01-01T00:00:00Z',updatedAt:'2030-01-01T00:00:00Z'});
function deferred(){let resolve!:(value:any)=>void;const promise=new Promise<any>(done=>{resolve=done});return{promise,resolve}}
function replaceContext(boundary:'config'|'revision'){m.scope='B';if(boundary==='config')m.config={marker:'B'};else m.revision++;for(const listener of [...m.listeners])listener()}
async function mountA(){render(createElement(DeploymentRequestsWorkspace));await screen.findByRole('button',{name:/Release A/});await screen.findByText('Workflow run: run-A')}
beforeEach(()=>{vi.resetAllMocks();m.config={marker:'A'};m.revision=0;m.scope='A';m.listeners.clear();m.requests.mockImplementation(async()=>({ok:true,data:[request(m.scope)]}));m.executions.mockImplementation(async()=>({ok:true,data:{executions:[execution(m.scope)]}}));m.observe.mockResolvedValue({ok:false,error:'Synthetic read unavailable'});});
afterEach(()=>{cleanup();vi.useRealTimers()});
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
    releaseContext: {...current.releaseContext, readiness: {...current.releaseContext.readiness,
      approvalDecision: 'ready_for_human_approval', blockers: [], developmentReady: true, productionReady: true, validationStepCount: 2}},
  }]}));
  expect(plannedValidation()).toBe('2 steps');
  expect(overview.getByText('Requested by').nextElementSibling?.textContent).toBe('Unavailable');
  expect(overview.getByText('Scope').nextElementSibling?.textContent).toBe('1 app · 1 repo');
  expect(prerequisites()).toBe('Ready for human review');
  expect(approvals.getByText('Human approval is still required.')).toBeTruthy();
  const lifecycle = within(screen.getByRole('region', {name: 'Selected release lifecycle'}));
  const approvalStep = lifecycle.getByText('Ready for review').closest('li');
  expect(approvalStep?.querySelector('[data-review-ready="true"]')?.textContent).toBe('3');
  expect(approvalStep?.querySelector('[data-recorded]')).toBeNull();
  expect(readiness.queryByText('Recovery backup')).toBeNull();
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

  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  fireEvent.click(screen.getByRole('button', {name: /Record external outcome and close request/}));
  expect(screen.getByPlaceholderText('Validation or change reference')).toHaveProperty('value', '');
  fireEvent.change(screen.getByPlaceholderText('Validation or change reference'), {target: {value: 'version-two-evidence'}});
  fireEvent.change(screen.getByPlaceholderText('Recorded outcome summary'), {target: {value: 'Version two outcome'}});
  m.close.mockResolvedValue({ok: false, error: 'Synthetic refusal'});
  fireEvent.click(screen.getByRole('button', {name: 'Record closure'}));
  await screen.findByText(/Synthetic refusal/);
  expect(m.close).toHaveBeenCalledExactlyOnceWith('request-A', 2, 'version-two-evidence', 'Version two outcome');
});
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
 m.scope='B';if(boundary==='config')m.config={marker:'B'};else m.revision++;
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
  const check = await screen.findByRole('button', {name: 'Check batches'});
  expect(m.batchReadiness).toHaveBeenCalledExactlyOnceWith('request-A', 1);
  fireEvent.click(check);
  await screen.findByText('Selected batches are not ready. Refresh to check again.');
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
