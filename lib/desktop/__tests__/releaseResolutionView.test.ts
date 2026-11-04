/** @vitest-environment jsdom */
import {createElement,Profiler} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,act} from '@testing-library/react';
const m=vi.hoisted(()=>({create:vi.fn(),revise:vi.fn(),observe:vi.fn(),requests:vi.fn(),executions:vi.fn(),revision:vi.fn(),config:{},contextRevision:0,listeners:new Set<()=>void>()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{deploymentRequests:m.requests,listDeploymentExecutions:m.executions,observeDeploymentExecution:m.observe,deploymentRequestForRevision:m.revision,createDeploymentRequest:m.create,reviseDeploymentRequest:m.revise,get config(){return m.config},subscribeContext:(listener:()=>void)=>{m.listeners.add(listener);return()=>{m.listeners.delete(listener)}},getContextRevision:()=>m.contextRevision}}));
const releaseContext={window:null,scope:{applicationCount:1,repositoryCount:0,targetEnvironment:null},approval:{prStatus:'pending',noPrRequired:false},readiness:{developmentReady:false,productionReady:false,validationStepCount:0,deferredValidation:false,approvalDecision:'needs_attention',blockers:['Resolve release details']},recovery:{rollbackAvailability:'unknown',backupRequired:false,evidenceCount:0},observation:{status:'not_connected',recordedMonitoringPlan:false}};
import {DeploymentRequestsView} from '../../../desktop/src/views/DeploymentRequestsView';
beforeEach(()=>{vi.clearAllMocks();m.config={};m.contextRevision=0;m.listeners.clear();m.observe.mockResolvedValue({ok:false,error:"Unavailable"});m.requests.mockResolvedValue({ok:true,data:[]});m.executions.mockResolvedValue({ok:true,data:{executions:[]}})});afterEach(()=>{cleanup();vi.useRealTimers()});
it('offers a ticket-first path without opening full execution intake',async()=>{
 render(createElement(DeploymentRequestsView));await screen.findByText(/No deployment requests exist/);
 fireEvent.click(screen.getByText('Start from ticket'));
 const details=screen.getByRole('textbox',{name:'What needs to be released?'});
 fireEvent.change(details,{target:{value:'Retain this ticket narrative'}});
 expect(screen.queryByText('New release request')).toBeNull();
 fireEvent.click(screen.getByText('Cancel draft'));
 expect(screen.queryByRole('textbox',{name:'What needs to be released?'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Save draft'})).toBeNull();
 expect(details.closest('[hidden]')).not.toBeNull();
 expect(screen.queryByText('New release request')).toBeNull();
 fireEvent.click(screen.getByText('Start from ticket'));
 expect(screen.getByRole('textbox',{name:'What needs to be released?'})).toHaveProperty('value','Retain this ticket narrative');
});
it('keeps draft actions limited to completion and history',async()=>{m.requests.mockResolvedValue({ok:true,data:[{id:'draft1',title:'Unresolved ticket',status:'draft',version:1,correlationId:'c',updatedAt:'2026-10-24T00:00:00Z',latestPlaybook:null,releaseContext}]});render(createElement(DeploymentRequestsView));await screen.findByRole('button',{name:/^Unresolved ticket/});expect(screen.getByRole('button',{name:'Complete release details'})).toBeTruthy();expect(screen.getByText('Review history')).toBeTruthy();expect(screen.queryByText('Generate next playbook')).toBeNull();expect(screen.queryByText('Collect GitHub evidence')).toBeNull();expect(screen.queryByText('Review execution controls')).toBeNull()});
it('shows the original ticket details while completing the guarded intake',async()=>{m.requests.mockResolvedValue({ok:true,data:[{id:'draft1',title:'Unresolved ticket',status:'draft',version:1,correlationId:'c',updatedAt:'2026-10-24T00:00:00Z',latestPlaybook:null,releaseContext}]});m.revision.mockResolvedValue({ok:true,data:{id:'draft1',version:1,intake:{kind:'resolution_draft',title:'Unresolved ticket',applications:['Checkout'],requestDetails:'Need the application owner to resolve the pipeline.',ticketUrl:'https://tickets.example.test/42'}}});render(createElement(DeploymentRequestsView));await screen.findByRole('button',{name:/^Unresolved ticket/});fireEvent.click(screen.getByRole('button',{name:'Complete release details'}));await screen.findByText('Need the application owner to resolve the pipeline.');expect(screen.getByText('https://tickets.example.test/42')).toBeTruthy();expect(screen.getByLabelText('Request title')).toHaveProperty('value','Unresolved ticket')});
it('does not replace a newly opened ticket draft with a delayed completion read',async()=>{let resolve!:(v:unknown)=>void;m.requests.mockResolvedValue({ok:true,data:[{id:'draft1',title:'Older ticket',status:'draft',version:1,correlationId:'c',updatedAt:'2026-10-24T00:00:00Z',latestPlaybook:null,releaseContext}]});m.revision.mockReturnValue(new Promise(r=>resolve=r));render(createElement(DeploymentRequestsView));await screen.findByRole('button',{name:/^Older ticket/});fireEvent.click(screen.getByRole('button',{name:'Complete release details'}));fireEvent.click(screen.getByText('Start from ticket'));fireEvent.change(screen.getByLabelText('Request title'),{target:{value:'New ticket draft'}});const {act}=await import('@testing-library/react');await act(async()=>resolve({ok:true,data:{id:'draft1',version:1,intake:{kind:'resolution_draft',title:'Older ticket',applications:['Checkout'],requestDetails:'Old request'}}}));expect(screen.getByLabelText('What needs to be released?')).toBeTruthy();expect(screen.getByLabelText('Request title')).toHaveProperty('value','New ticket draft');expect(screen.queryByText('Complete release details for submission')).toBeNull()});

it('marks future intake steps unavailable and keeps prior steps navigable without losing input',async()=>{
 render(createElement(DeploymentRequestsView));await screen.findByText(/No deployment requests exist/);fireEvent.click(screen.getByRole('button',{name:'New release'}));
 expect(screen.getByRole('button',{name:'2. Scope'})).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'1. Window'}).getAttribute('aria-current')).toBe('step');
 fireEvent.change(screen.getByLabelText('Request title'),{target:{value:'Preserved release title'}});
 fireEvent.change(screen.getByLabelText('Window start'),{target:{value:'2030-01-01T12:00'}});
 fireEvent.change(screen.getByLabelText('Window end'),{target:{value:'2030-01-01T13:00'}});
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 expect(screen.getByRole('button',{name:'2. Scope'})).toHaveProperty('disabled',false);
 expect(screen.getByRole('button',{name:'2. Scope'}).getAttribute('aria-current')).toBe('step');
 expect(screen.getByRole('button',{name:'3. Execution'})).toHaveProperty('disabled',true);
 fireEvent.click(screen.getByRole('button',{name:'1. Window'}));
 expect(screen.getByLabelText('Request title')).toHaveProperty('value','Preserved release title');
});

it('separates the final Continue click from the submit control',async()=>{
 render(createElement(DeploymentRequestsView));await screen.findByText(/No deployment requests exist/);fireEvent.click(screen.getByRole('button',{name:'New release'}));
 const fill=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
 const next=()=>fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 fill('Request title','Unsent transition test');fill('Window start','2030-01-01T12:00');fill('Window end','2030-01-01T13:00');next();
 for(const [label,value] of [['Applications (comma or line separated)','Audit'],['Clients (comma or line separated)','Internal'],['Deployment owner','Owner'],['Application owner','Owner'],['Escalation owner','Owner'],['Repository URLs','https://github.com/example/audit'],['Production PR URLs','https://github.com/example/audit/pull/1'],['Source branch','audit']])fill(label,value);
 next();fill('Deployment method','Unsent test');fill('Workflow name / trigger','audit.yml');next();
 fill('Tested lower environments','Test example');fill('Exact technical production validation','Test example');fill('Expected production result','No execution');
 const continueButton=screen.getByRole('button',{name:'Continue'});
 expect(fireEvent.click(continueButton)).toBe(false);
 const submit=screen.getByRole('button',{name:'Submit release request'});
 expect(submit).not.toBe(continueButton);
 expect(continueButton.isConnected).toBe(false);
 expect(submit.getAttribute('type')).toBe('submit');
});

it('retains the exact batch selection when opening an immutable revision',async()=>{
 m.requests.mockResolvedValue({ok:true,data:[{id:'request1',title:'Bound release',status:'submitted',version:2,correlationId:'c',updatedAt:'2026-10-24T00:00:00Z',latestPlaybook:null,releaseContext}]});
 m.revision.mockResolvedValue({ok:true,data:{id:'request1',version:2,intake:{title:'Bound release',airflowDependency:{connectionId:'connection',connectionUpdatedAt:'2026-10-24T00:00:00.000Z',runs:[{dagId:'daily',dagRunId:'specific-run',logicalDate:'2026-10-24T00:00:00.000001Z'}]}}}});
 render(createElement(DeploymentRequestsView));await screen.findByRole('button',{name:/^Bound release/});fireEvent.click(screen.getByText('Revise'));
 await screen.findByRole('button',{name:'Remove batch daily specific-run',hidden:true});
 expect(screen.getByText('2026-10-24T00:00:00.000001Z')).toBeTruthy();
});

const workflow={id:'execution-a',environmentId:'environment',repositoryFullName:'fixture/repository',sourceRef:null,sourceKind:null,sourceCommitSha:null,branchPolicyId:null,pullRequestUrl:null,workflowRunId:null,workflowUrl:null,source:'github',status:'in_progress',conclusion:null,rollbackStatus:'not_requested',lastObservedAt:null,completedAt:null,createdAt:'2030-01-01T00:00:00Z',updatedAt:'2030-01-01T00:00:00Z'};
function observationDeferred(){let resolve!:(value:any)=>void,reject!:(error:Error)=>void;const promise=new Promise<any>((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
async function mountExecutions(rows:Array<typeof workflow>){vi.useFakeTimers();m.executions.mockResolvedValue({ok:true,data:{executions:rows}});await act(async()=>{render(createElement(DeploymentRequestsView))})}
it('keeps one observation batch in flight across multiple five-second ticks and resumes on the next tick after settlement',async()=>{
 const a=observationDeferred(),b=observationDeferred();m.observe.mockImplementation((id:string)=>id===workflow.id?a.promise:b.promise);
 await mountExecutions([workflow,{...workflow,id:'execution-b'}]);expect(m.observe).toHaveBeenCalledTimes(2);
 await act(async()=>vi.advanceTimersByTime(20000));expect(m.observe).toHaveBeenCalledTimes(2);
 await act(async()=>{a.resolve({ok:true,data:{...workflow,workflowRunId:'observed-a'}});b.resolve({ok:false,error:'Read unavailable'})});
 expect(screen.getByText('Workflow run: observed-a')).toBeTruthy();expect(m.observe).toHaveBeenCalledTimes(2);
 await act(async()=>vi.advanceTimersByTime(4999));expect(m.observe).toHaveBeenCalledTimes(2);await act(async()=>vi.advanceTimersByTime(1));expect(m.observe).toHaveBeenCalledTimes(4);
});
it('retains a rejected execution record and keeps the batch held until its delayed sibling settles',async()=>{
 const a=observationDeferred(),b=observationDeferred();m.observe.mockImplementation((id:string)=>id===workflow.id?a.promise:b.promise);
 await mountExecutions([workflow,{...workflow,id:'execution-b'}]);await act(async()=>a.reject(new Error('Synthetic read rejection')));
 await act(async()=>vi.advanceTimersByTime(15000));expect(m.observe).toHaveBeenCalledTimes(2);
 await act(async()=>b.resolve({ok:true,data:{...workflow,id:'execution-b',workflowRunId:'sibling-observed'}}));
 expect(screen.getByText('Workflow run: sibling-observed')).toBeTruthy();expect(screen.getAllByText('GitHub workflow: in progress')).toHaveLength(2);expect(screen.queryByText(/GitHub workflow: completed/)).toBeNull();
 await act(async()=>vi.advanceTimersByTime(5000));expect(m.observe).toHaveBeenCalledTimes(4);
});
it('settles a synchronous observer throw without skipping its sibling or falsely completing a run',async()=>{
 const sibling=observationDeferred();m.observe.mockImplementation((id:string)=>{if(id===workflow.id)throw Error('Synthetic synchronous read failure');return sibling.promise});
 await mountExecutions([workflow,{...workflow,id:'execution-b'}]);expect(m.observe).toHaveBeenCalledTimes(2);await act(async()=>vi.advanceTimersByTime(15000));expect(m.observe).toHaveBeenCalledTimes(2);
 await act(async()=>sibling.resolve({ok:false,error:'Unavailable'}));expect(screen.getAllByText('GitHub workflow: in progress')).toHaveLength(2);await act(async()=>vi.advanceTimersByTime(5000));expect(m.observe).toHaveBeenCalledTimes(4);
});
it('discards a replaced effect’s delayed completed result while the newer saved status remains current',async()=>{
 const old=observationDeferred(),current=observationDeferred();m.observe.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
 await mountExecutions([{...workflow,status:'queued'}]);expect(m.observe).toHaveBeenCalledTimes(1);
 m.executions.mockResolvedValueOnce({ok:true,data:{executions:[workflow]}});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Refresh'})));expect(m.observe).toHaveBeenCalledTimes(2);
 await act(async()=>old.resolve({ok:true,data:{...workflow,status:'completed',workflowRunId:'stale-old'}}));expect(screen.getByText('GitHub workflow: in progress')).toBeTruthy();expect(screen.queryByText('Workflow run: stale-old')).toBeNull();
 await act(async()=>current.resolve({ok:true,data:{...workflow,workflowRunId:'current-run'}}));expect(screen.getByText('Workflow run: current-run')).toBeTruthy();
});
it('never polls completed or tracking-unavailable workflow records',async()=>{
 await mountExecutions([{...workflow,status:'completed'},{...workflow,id:'execution-b',status:'tracking_unavailable'}]);await act(async()=>vi.advanceTimersByTime(30000));expect(m.observe).not.toHaveBeenCalled();expect(screen.getByText('GitHub workflow: completed')).toBeTruthy();expect(screen.getByText('GitHub workflow: tracking unavailable')).toBeTruthy();
});

async function openFilledIntake(mode:'create'|'revise',observeCommit?:()=>void){
 if(mode==='revise'){
  m.requests.mockResolvedValue({ok:true,data:[{id:'request-existing',title:'Existing pending fixture',status:'submitted',version:3,correlationId:'fixture',updatedAt:'2030-01-01T00:00:00Z',latestPlaybook:null,releaseContext}]});
  m.revision.mockResolvedValue({ok:true,data:{id:'request-existing',version:3,intake:{}}});
 }
 const content=createElement(DeploymentRequestsView);const view=render(observeCommit?createElement(Profiler,{id:'intake-context-commit',onRender:observeCommit},content):content);
 if(mode==='revise'){await screen.findByRole('button',{name:/^Existing pending fixture/});fireEvent.click(screen.getByRole('button',{name:'Revise'}));await screen.findByText('Revise release request · v3 → v4')}
 else{await screen.findByText(/No deployment requests exist/);fireEvent.click(screen.getByRole('button',{name:'New release'}))}
 const fill=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value}}),next=()=>fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 fill('Request title','Captured intake fixture');fill('Window start','2030-01-01T12:00');fill('Window end','2030-01-01T13:00');next();
 for(const [label,value] of [['Applications (comma or line separated)','Fixture app'],['Clients (comma or line separated)','Fixture client'],['Deployment owner','Fixture owner'],['Application owner','Fixture app owner'],['Escalation owner','Fixture escalation'],['Repository URLs','https://github.com/fixture/repository'],['Production PR URLs','https://github.com/fixture/repository/pull/1'],['Source branch','fixture-branch']])fill(label,value);
 next();fill('Deployment method','Fixture method');fill('Workflow name / trigger','fixture.yml');next();
 fill('Tested lower environments','Fixture testing');fill('Exact technical production validation','Fixture validation only');fill('Expected production result','No real deployment');next();
 fill('Exact rollback instruction','Fixture rollback only');fill('Rollback owner','Fixture rollback owner');fill('Confirmed operational fact','Captured exact fact');fill('Source evidence identifier','fixture-evidence');fill('Confirmed by','Fixture author');
 return{view,form:screen.getByRole('button',{name:mode==='revise'?'Save revision':'Submit release request'}).closest('form')!};
}
it.each(['create','revise'] as const)('freezes the captured %s intake synchronously and sends only one immutable request',async mode=>{
 const pending=observationDeferred(),save=mode==='create'?m.create:m.revise;save.mockReturnValue(pending.promise);const{form}=await openFilledIntake(mode);
 const fact=screen.getByLabelText('Confirmed operational fact'),source=screen.getByLabelText('Source evidence identifier');
 act(()=>{fireEvent.submit(form);fireEvent.change(fact,{target:{value:'Later edit must not enter captured form'}});fireEvent.change(source,{target:{value:'later-source'}});fireEvent.submit(form)});
 expect(save).toHaveBeenCalledTimes(1);expect(fact.matches(':disabled')).toBe(true);expect(source.matches(':disabled')).toBe(true);expect(screen.getByLabelText('Backup required').matches(':disabled')).toBe(true);expect(screen.getByLabelText('Rollback availability').matches(':disabled')).toBe(true);
 expect(fact).toHaveProperty('value','Captured exact fact');expect(source).toHaveProperty('value','fixture-evidence');expect(screen.getByText(/Saving release details/).textContent).toContain('Leaving does not cancel this save');
 const payload=save.mock.calls[0][mode==='create'?0:2];expect(payload.facts[0]).toMatchObject({value:'Captured exact fact',sourceEvidenceId:'fixture-evidence'});if(mode==='create')expect(save.mock.calls[0][1]).toEqual(expect.any(String));else expect(save.mock.calls[0].slice(0,2)).toEqual(['request-existing',3]);
 await act(async()=>pending.resolve({ok:true,data:{id:'fixture-saved'}}));expect(screen.queryByLabelText('Confirmed operational fact')).toBeNull();expect(save).toHaveBeenCalledTimes(1);
});
it.each(['create','revise'] as const)('does not close a replacement draft after an abandoned %s intake succeeds',async mode=>{
 const pending=observationDeferred(),save=mode==='create'?m.create:m.revise;save.mockReturnValue(pending.promise);const{form}=await openFilledIntake(mode);fireEvent.submit(form);
 fireEvent.click(screen.getByRole('button',{name:'Cancel intake'}));fireEvent.click(screen.getByRole('button',{name:'New release'}));fireEvent.change(screen.getByLabelText('Request title'),{target:{value:'Keep this replacement draft'}});
 const reads=m.requests.mock.calls.length;await act(async()=>pending.resolve({ok:true,data:{id:'old-saved'}}));expect(screen.getByLabelText('Request title')).toHaveProperty('value','Keep this replacement draft');expect(m.requests).toHaveBeenCalledTimes(reads);expect(save).toHaveBeenCalledTimes(1);
});
it.each(['response','rejection'] as const)('retains and unlocks the captured form after save %s without automatic replay',async kind=>{
 const pending=observationDeferred();m.create.mockReturnValue(pending.promise);const{form}=await openFilledIntake('create');fireEvent.submit(form);
 await act(async()=>{if(kind==='response')pending.resolve({ok:false,error:'Fixture save unavailable'});else pending.reject(new Error('Synthetic thrown save failure'))});
 expect(screen.getByRole('alert').textContent).toContain(kind==='response'?'Fixture save unavailable':'The save could not be confirmed');expect(screen.getByLabelText('Confirmed operational fact')).toHaveProperty('value','Captured exact fact');expect(screen.getByLabelText('Confirmed operational fact').matches(':disabled')).toBe(false);expect(m.create).toHaveBeenCalledTimes(1);
});
it('closes the form only after its own ordinary successful save',async()=>{
 m.create.mockResolvedValue({ok:true,data:{id:'fixture-saved'}});const{form}=await openFilledIntake('create');await act(async()=>fireEvent.submit(form));expect(screen.queryByLabelText('Confirmed operational fact')).toBeNull();expect(m.create).toHaveBeenCalledTimes(1);
});
it('does not refresh or apply a late successful save after the intake view unmounts',async()=>{
 const pending=observationDeferred();m.create.mockReturnValue(pending.promise);const{view,form}=await openFilledIntake('create');fireEvent.submit(form);const reads=m.requests.mock.calls.length;view.unmount();await act(async()=>pending.resolve({ok:true,data:{id:'old-saved'}}));expect(m.requests).toHaveBeenCalledTimes(reads);expect(m.create).toHaveBeenCalledTimes(1);
});

function replaceIntakeContext(kind:'config'|'revision'){
 if(kind==='config')m.config={};else m.contextRevision++;
 for(const listener of [...m.listeners])listener();
}
it.each((['create','revise'] as const).flatMap(mode=>(['config','revision'] as const).map(boundary=>({mode,boundary}))))('invalidates the old $mode draft synchronously on $boundary replacement without submitting it',async({mode,boundary})=>{
 let capture=false;const visibleAtReplacement:boolean[]=[];
 const{form}=await openFilledIntake(mode,()=>{if(capture)visibleAtReplacement.push(Boolean(screen.queryByLabelText('Request title')||screen.queryByLabelText('Confirmed operational fact')))});
 const fact=screen.getByLabelText('Confirmed operational fact'),save=mode==='create'?m.create:m.revise;
 capture=true;act(()=>{replaceIntakeContext(boundary);fireEvent.change(fact,{target:{value:'Stale edit must not survive'}});fireEvent.submit(form)});capture=false;
 expect(save).not.toHaveBeenCalled();expect(visibleAtReplacement.length).toBeGreaterThan(0);expect(visibleAtReplacement).not.toContain(true);
 expect(screen.queryByLabelText('Confirmed operational fact')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'New release'}));
 expect(screen.getByLabelText('Request title')).toHaveProperty('value','');expect(screen.queryByText(/Revise release request/)).toBeNull();
});
it.each((['create','revise'] as const).flatMap(mode=>(['config','revision'] as const).map(boundary=>({mode,boundary}))))('discards the old $mode save completion after $boundary replacement without closing or refreshing current work',async({mode,boundary})=>{
 const pending=observationDeferred(),save=mode==='create'?m.create:m.revise;save.mockReturnValue(pending.promise);const{form}=await openFilledIntake(mode);fireEvent.submit(form);expect(save).toHaveBeenCalledTimes(1);
 act(()=>replaceIntakeContext(boundary));expect(screen.queryByLabelText('Confirmed operational fact')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'New release'}));
 fireEvent.change(screen.getByLabelText('Request title'),{target:{value:'Current context draft'}});const title=screen.getByLabelText('Request title'),reads=m.requests.mock.calls.length;
 await act(async()=>pending.resolve({ok:true,data:{id:'old-context-saved'}}));expect(screen.getByLabelText('Request title')).toBe(title);expect(title).toHaveProperty('value','Current context draft');expect(m.requests).toHaveBeenCalledTimes(reads);expect(save).toHaveBeenCalledTimes(1);
});
