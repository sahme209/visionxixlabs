/** @vitest-environment jsdom */
// Actual Settings -> saved baseline -> existing policy panel. API/auth identities
// below are SIMULATED presentation fixtures, never proof of server authority.
import {createElement} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,act} from '@testing-library/react';
const m=vi.hoisted(()=>({config:{},revision:0,listeners:new Set<()=>void>(),baseline:vi.fn(),evidence:vi.fn(),sources:vi.fn(),drift:vi.fn(),list:vi.fn(),requests:vi.fn(),policy:vi.fn(),active:vi.fn(),mutate:vi.fn(),members:vi.fn()}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:vi.fn()}));
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
vi.mock('../../../desktop/src/lib/preferences',()=>({readDesktopPreferences:async()=>null,writeDesktopPreferences:vi.fn()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.config},getContextRevision:()=>m.revision,subscribeContext:(fn:()=>void)=>{m.listeners.add(fn);return()=>m.listeners.delete(fn)},governanceRevision:m.baseline,governanceEvidence:m.evidence,governanceCollectionSources:m.sources,governanceDrift:m.drift,listWorkspaceMembers:m.members,governanceExecutionPolicies:()=>({read:m.policy,list:m.list,requests:m.requests,active:m.active,mutate:m.mutate})}}));
import {SettingsView} from '../../../desktop/src/views/SettingsView';
const digest='a'.repeat(64),baselineId='governance_revision_'+digest,policyId='governance_execution_policy_'+digest;
const scope={repositoryId:'team/repo',resourceId:'github:repository:team/repo',environment:'production'};
const baseline={id:baselineId,version:1,status:'approved',baseline:{organizationId:'org',digest,scopes:[scope],rules:[]},executionAuthorized:false};
const identity={kind:'desktop_session',organizationId:'org',userId:'reviewer',role:'security_reviewer',capabilities:['workspace:read','agent:approve'],access:{allowed:true}} as any;
const policy={id:policyId,version:0,status:'proposed',policy:{scope,organizationId:'org',digest,parentDigest:null,autonomyLevel:4,actions:['repository.merge'],executorUserIds:['executor'],expiresAt:'2030-01-01T00:00:00Z'},requesterUserId:'owner',approval:null,executionAuthorized:false};
beforeEach(()=>{vi.clearAllMocks();m.config={};m.revision=0;m.listeners.clear();m.baseline.mockResolvedValue({ok:true,data:baseline});m.policy.mockResolvedValue({ok:true,data:policy});m.mutate.mockResolvedValue({ok:true,data:{...policy,status:'approved',version:1}})});
afterEach(()=>{cleanup();vi.unstubAllEnvs()});
function openLimits(){fireEvent.click(screen.getByRole('button',{name:'Review execution limits preview'}))}
async function loadBaseline(){fireEvent.change(screen.getByLabelText('Saved baseline revision ID'),{target:{value:baselineId}});fireEvent.click(screen.getByRole('button',{name:'Load baseline review'}));await screen.findByRole('button',{name:'Load saved limit policies'})}
async function loadPolicy(){fireEvent.change(screen.getByLabelText('Saved execution-limit policy ID'),{target:{value:policyId}});fireEvent.click(screen.getByRole('button',{name:'Load exact policy'}));await screen.findByText('proposed · version 0')}
it('actual Settings offers a deliberate limits lane without automatic requests, collectors or baseline authoring',async()=>{
 render(createElement(SettingsView,{identity}));openLimits();
 expect(screen.getByRole('heading',{name:'Execution limits',level:1})).toBeTruthy();expect(screen.getByText(/Load an exact saved baseline, then load or propose limits/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Load saved evidence'})).toBeNull();expect(screen.queryByText('Governance next step')).toBeNull();expect(screen.getByText(/Execution limits preview/)).toBeTruthy();expect(m.baseline).not.toHaveBeenCalled();expect(m.policy).not.toHaveBeenCalled();expect(m.mutate).not.toHaveBeenCalled();expect(m.sources).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:'Load saved limit policies'})).toBeNull();await loadBaseline();
 expect(m.policy).not.toHaveBeenCalled();expect(m.list).not.toHaveBeenCalled();expect(m.mutate).not.toHaveBeenCalled();expect(m.drift).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:'Check current source changes'})).toBeNull();expect(screen.queryByRole('button',{name:/upload|collect|save initial|approve baseline/i})).toBeNull();
});
it('reviewer can deliberately load and review exact policy without proposer or executor authority',async()=>{
 render(createElement(SettingsView,{identity}));openLimits();await loadBaseline();await loadPolicy();
 expect(screen.queryByRole('button',{name:'Save limits for independent review'})).toBeNull();const approve=screen.getByRole('button',{name:'Record independent limit approval'});expect(approve).toHaveProperty('disabled',true);
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(approve);await screen.findByText(/Limits recorded/);expect(m.mutate).toHaveBeenCalledOnce();expect(m.mutate.mock.calls[0][0]).toMatchObject({operation:'approve',id:policyId,version:0,digest});
});
it('mismatched baseline organization never exposes limit controls',async()=>{
 m.baseline.mockResolvedValue({ok:true,data:{...baseline,baseline:{...baseline.baseline,organizationId:'other'}}});render(createElement(SettingsView,{identity}));openLimits();fireEvent.change(screen.getByLabelText('Saved baseline revision ID'),{target:{value:baselineId}});fireEvent.click(screen.getByRole('button',{name:'Load baseline review'}));await screen.findByText(/does not match this workspace/);expect(screen.queryByRole('button',{name:'Load saved limit policies'})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('saved policy outside loaded baseline scope cannot be reviewed',async()=>{
 m.policy.mockResolvedValue({ok:true,data:{...policy,policy:{...policy.policy,scope:{...scope,environment:'staging'}}}});render(createElement(SettingsView,{identity}));openLimits();await loadBaseline();fireEvent.change(screen.getByLabelText('Saved execution-limit policy ID'),{target:{value:policyId}});fireEvent.click(screen.getByRole('button',{name:'Load exact policy'}));await screen.findByText(/outside the loaded baseline scopes/);expect(screen.queryByRole('button',{name:'Record independent limit approval'})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('late baseline response is discarded after workspace/session access changes',async()=>{
 let resolve!:(value:any)=>void;m.baseline.mockImplementation(()=>new Promise(r=>resolve=r));const view=render(createElement(SettingsView,{identity}));openLimits();fireEvent.change(screen.getByLabelText('Saved baseline revision ID'),{target:{value:baselineId}});fireEvent.click(screen.getByRole('button',{name:'Load baseline review'}));view.rerender(createElement(SettingsView,{identity:{...identity,organizationId:'other',access:{allowed:false}}}));await act(async()=>resolve({ok:true,data:baseline}));expect(screen.queryByRole('button',{name:'Load saved limit policies'})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('changing baseline ID unmounts prior policy decision controls',async()=>{
 render(createElement(SettingsView,{identity}));openLimits();await loadBaseline();await loadPolicy();fireEvent.change(screen.getByLabelText('Saved baseline revision ID'),{target:{value:'governance_revision_'+'b'.repeat(64)}});expect(screen.queryByRole('button',{name:'Record independent limit approval'})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('production Settings exposes neither local Governance lane',()=>{
 vi.stubEnv('DEV',false);render(createElement(SettingsView,{identity}));expect(screen.queryByRole('button',{name:'Review execution limits preview'})).toBeNull();expect(screen.queryByRole('button',{name:'Inspect saved Governance'})).toBeNull();expect(m.baseline).not.toHaveBeenCalled();
});

it('manager prepares an exact-baseline-scoped proposal through actual mounted authoring controls',async()=>{
 const manager={...identity,userId:'owner',role:'owner',capabilities:['workspace:read','policy:manage']};
 m.members.mockResolvedValue({ok:true,data:{currentUserId:'owner',members:[{userId:'executor',role:'operator',displayName:'Fixture executor',email:'executor@fixture.test',acceptedAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'}]}});
 m.active.mockResolvedValue({ok:true,data:{found:false,scope,executionAuthorized:false}});
 m.mutate.mockResolvedValue({ok:true,data:{...policy,requesterUserId:'owner'}});
 render(createElement(SettingsView,{identity:manager}));openLimits();await loadBaseline();expect(m.members).not.toHaveBeenCalled();expect(m.active).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Load current workspace members'}));await screen.findByLabelText('Fixture executor · operator');fireEvent.click(screen.getByLabelText('Fixture executor · operator'));
 fireEvent.change(screen.getByLabelText('Limit expiry'),{target:{value:'2030-01-01T12:00'}});fireEvent.click(screen.getByRole('button',{name:'Read exact current limit parent'}));await screen.findByText(/No current limit pointer/);
 fireEvent.click(screen.getByLabelText('I reviewed this exact proposal and its named executors.'));fireEvent.click(screen.getByRole('button',{name:'Save limits for independent review'}));await screen.findByText(/Proposal saved for a separate independent reviewer/);
 expect(m.mutate).toHaveBeenCalledOnce();expect(m.mutate.mock.calls[0][0]).toMatchObject({operation:'propose',policy:{scope,executorUserIds:['executor'],parentDigest:null}});expect(m.sources).not.toHaveBeenCalled();expect(m.drift).not.toHaveBeenCalled();
});
it('workspace reader may inspect limits but cannot propose or approve',async()=>{
 const reader={...identity,role:'read_only',userId:'reader',capabilities:['workspace:read']};render(createElement(SettingsView,{identity:reader}));openLimits();await loadBaseline();await loadPolicy();
 expect(screen.queryByRole('button',{name:'Save limits for independent review'})).toBeNull();expect(screen.getByRole('button',{name:'Record independent limit approval'})).toHaveProperty('disabled',true);expect(screen.queryByRole('button',{name:'Activate these limits'})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it.each(['baseline','policy'])('same-user session-context replacement discards late %s and existing decision text',async(kind)=>{
 let resolve!:(value:any)=>void;render(createElement(SettingsView,{identity}));openLimits();
 if(kind==='policy')await loadBaseline();
 const call=kind==='baseline'?m.baseline:m.policy;call.mockImplementation(()=>new Promise(r=>resolve=r));
 fireEvent.change(screen.getByLabelText(kind==='baseline'?'Saved baseline revision ID':'Saved execution-limit policy ID'),{target:{value:kind==='baseline'?baselineId:policyId}});
 fireEvent.click(screen.getByRole('button',{name:kind==='baseline'?'Load baseline review':'Load exact policy'}));
 act(()=>{m.revision++;for(const fn of m.listeners)fn()});await act(async()=>resolve({ok:true,data:kind==='baseline'?baseline:policy}));
 expect(screen.queryByRole('button',{name:'Record independent limit approval'})).toBeNull();expect(screen.queryByRole('button',{name:'Load saved limit policies'})).toBeNull();expect(screen.queryByText('proposed · version 0')).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('original evidence entry remains read-only even for a policy manager',()=>{
 render(createElement(SettingsView,{identity:{...identity,capabilities:['workspace:read','policy:manage','agent:approve']}}));fireEvent.click(screen.getByRole('button',{name:'Inspect saved Governance'}));
 expect(screen.queryByRole('button',{name:'Load saved limit policies'})).toBeNull();expect(screen.queryByRole('button',{name:/approve|activate|collect|save limits/i})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('reloading the same baseline removes previous decision controls before its response',async()=>{
 let resolve!:(value:any)=>void;render(createElement(SettingsView,{identity}));openLimits();await loadBaseline();await loadPolicy();
 m.baseline.mockImplementation(()=>new Promise(r=>resolve=r));fireEvent.click(screen.getByRole('button',{name:'Load baseline review'}));
 expect(screen.queryByRole('button',{name:'Record independent limit approval'})).toBeNull();
 await act(async()=>resolve({ok:false,error:'Current baseline unavailable'}));expect(screen.queryByRole('button',{name:'Load saved limit policies'})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('equivalent policy scope key order does not change baseline scope eligibility',async()=>{
 m.policy.mockResolvedValue({ok:true,data:{...policy,policy:{...policy.policy,scope:{environment:scope.environment,resourceId:scope.resourceId,repositoryId:scope.repositoryId}}}});
 render(createElement(SettingsView,{identity}));openLimits();await loadBaseline();await loadPolicy();expect(screen.getByRole('button',{name:'Record independent limit approval'})).toBeTruthy();expect(screen.queryByText(/outside the loaded baseline scopes/)).toBeNull();
});
it('ambiguous generic authoring plus limits identity refuses both lanes',async()=>{
 const {GovernanceEvidenceView}=await import('../../../desktop/src/views/GovernanceEvidenceView');
 const manager={...identity,capabilities:['workspace:read','policy:manage','agent:approve']};render(createElement(GovernanceEvidenceView,{identity:manager,executionPolicyIdentity:manager} as any));
 expect(screen.getByRole('alert').textContent).toMatch(/Choose one Governance preview lane/);expect(screen.queryByRole('button',{name:'Load baseline review'})).toBeNull();expect(m.sources).not.toHaveBeenCalled();expect(m.mutate).not.toHaveBeenCalled();
});
it('locks selection controls during reads so users cannot change the pending request target',async()=>{
 let resolve!:(value:any)=>void;m.baseline.mockImplementation(()=>new Promise(r=>resolve=r));render(createElement(SettingsView,{identity}));openLimits();
 const baselineInput=screen.getByLabelText('Saved baseline revision ID');fireEvent.change(baselineInput,{target:{value:baselineId}});fireEvent.click(screen.getByRole('button',{name:'Load baseline review'}));expect(baselineInput).toHaveProperty('disabled',true);
 await act(async()=>resolve({ok:true,data:baseline}));expect(baselineInput).toHaveProperty('disabled',false);
 m.policy.mockImplementation(()=>new Promise(r=>resolve=r));const policyInput=screen.getByLabelText('Saved execution-limit policy ID');fireEvent.change(policyInput,{target:{value:policyId}});fireEvent.click(screen.getByRole('button',{name:'Load exact policy'}));expect(policyInput).toHaveProperty('disabled',true);expect(screen.getByRole('button',{name:'Load saved limit policies'})).toHaveProperty('disabled',true);
 await act(async()=>resolve({ok:true,data:policy}));expect(policyInput).toHaveProperty('disabled',false);expect(m.mutate).not.toHaveBeenCalled();
});
