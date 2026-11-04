/** @vitest-environment jsdom */
import {createElement} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({config:{marker:'A'},revision:0,scope:'A',listeners:new Set<()=>void>(),requests:vi.fn(),executions:vi.fn(),observe:vi.fn(),close:vi.fn()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.config},getContextRevision:()=>m.revision,subscribeContext:(listener:()=>void)=>{m.listeners.add(listener);return()=>{m.listeners.delete(listener)}},deploymentRequests:m.requests,listDeploymentExecutions:m.executions,observeDeploymentExecution:m.observe,closeDeploymentRequest:m.close}}));
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
 const a=deferred(),x=deferred();m.requests.mockReturnValueOnce(a.promise);m.executions.mockReturnValueOnce(x.promise);render(createElement(DeploymentRequestsWorkspace));await act(async()=>replaceContext(boundary));await screen.findByRole('button',{name:/Release B/});
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
