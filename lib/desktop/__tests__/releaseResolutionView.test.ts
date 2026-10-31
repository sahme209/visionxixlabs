/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
const m=vi.hoisted(()=>({requests:vi.fn(),executions:vi.fn(),revision:vi.fn(),config:{}}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{deploymentRequests:m.requests,listDeploymentExecutions:m.executions,deploymentRequestForRevision:m.revision,config:m.config,subscribeContext:()=>()=>{},getContextRevision:()=>0}}));
const releaseContext={window:null,scope:{applicationCount:1,repositoryCount:0,targetEnvironment:null},approval:{prStatus:'pending',noPrRequired:false},readiness:{developmentReady:false,productionReady:false,validationStepCount:0,deferredValidation:false,approvalDecision:'needs_attention',blockers:['Resolve release details']},recovery:{rollbackAvailability:'unknown',backupRequired:false,evidenceCount:0},observation:{status:'not_connected',recordedMonitoringPlan:false}};
import {DeploymentRequestsView} from '../../../desktop/src/views/DeploymentRequestsView';
beforeEach(()=>{vi.clearAllMocks();m.requests.mockResolvedValue({ok:true,data:[]});m.executions.mockResolvedValue({ok:true,data:{executions:[]}})});afterEach(cleanup);
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
it('keeps draft actions limited to completion and history',async()=>{m.requests.mockResolvedValue({ok:true,data:[{id:'draft1',title:'Unresolved ticket',status:'draft',version:1,correlationId:'c',updatedAt:'2026-10-24T00:00:00Z',latestPlaybook:null,releaseContext}]});render(createElement(DeploymentRequestsView));await screen.findByText('Unresolved ticket');expect(screen.getByRole('button',{name:'Complete release details'})).toBeTruthy();expect(screen.getByText('Review history')).toBeTruthy();expect(screen.queryByText('Generate next playbook')).toBeNull();expect(screen.queryByText('Collect GitHub evidence')).toBeNull();expect(screen.queryByText('Review execution controls')).toBeNull()});
it('shows the original ticket details while completing the guarded intake',async()=>{m.requests.mockResolvedValue({ok:true,data:[{id:'draft1',title:'Unresolved ticket',status:'draft',version:1,correlationId:'c',updatedAt:'2026-10-24T00:00:00Z',latestPlaybook:null,releaseContext}]});m.revision.mockResolvedValue({ok:true,data:{id:'draft1',version:1,intake:{kind:'resolution_draft',title:'Unresolved ticket',applications:['Checkout'],requestDetails:'Need the application owner to resolve the pipeline.',ticketUrl:'https://tickets.example.test/42'}}});render(createElement(DeploymentRequestsView));await screen.findByText('Unresolved ticket');fireEvent.click(screen.getByRole('button',{name:'Complete release details'}));await screen.findByText('Need the application owner to resolve the pipeline.');expect(screen.getByText('https://tickets.example.test/42')).toBeTruthy();expect(screen.getByLabelText('Request title')).toHaveProperty('value','Unresolved ticket')});
it('does not replace a newly opened ticket draft with a delayed completion read',async()=>{let resolve!:(v:unknown)=>void;m.requests.mockResolvedValue({ok:true,data:[{id:'draft1',title:'Older ticket',status:'draft',version:1,correlationId:'c',updatedAt:'2026-10-24T00:00:00Z',latestPlaybook:null,releaseContext}]});m.revision.mockReturnValue(new Promise(r=>resolve=r));render(createElement(DeploymentRequestsView));await screen.findByText('Older ticket');fireEvent.click(screen.getByRole('button',{name:'Complete release details'}));fireEvent.click(screen.getByText('Start from ticket'));fireEvent.change(screen.getByLabelText('Request title'),{target:{value:'New ticket draft'}});const {act}=await import('@testing-library/react');await act(async()=>resolve({ok:true,data:{id:'draft1',version:1,intake:{kind:'resolution_draft',title:'Older ticket',applications:['Checkout'],requestDetails:'Old request'}}}));expect(screen.getByLabelText('What needs to be released?')).toBeTruthy();expect(screen.getByLabelText('Request title')).toHaveProperty('value','New ticket draft');expect(screen.queryByText('Complete release details for submission')).toBeNull()});

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
 render(createElement(DeploymentRequestsView));await screen.findByText('Bound release');fireEvent.click(screen.getByText('Revise'));
 await screen.findByRole('button',{name:'Remove batch daily specific-run',hidden:true});
 expect(screen.getByText('2026-10-24T00:00:00.000001Z')).toBeTruthy();
});
