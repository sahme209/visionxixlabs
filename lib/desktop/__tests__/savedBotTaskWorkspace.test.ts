/** @vitest-environment jsdom */
import {createElement,useState} from "react";
import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {render,screen,fireEvent,cleanup,act} from "@testing-library/react";
const m=vi.hoisted(()=>({config:{sessionToken:"axm.desk.synthetic"},revision:0,list:vi.fn(),get:vi.fn(),create:vi.fn(),update:vi.fn(),history:vi.fn(),prCapabilities:vi.fn(),reportCapabilities:vi.fn(),reports:vi.fn(),prRuns:vi.fn(),jiraConnections:vi.fn(),jiraOwners:[] as any[]}));
vi.mock("../../../desktop/src/lib/desktopClient",()=>({desktopClient:{get config(){return m.config},getContextRevision:()=>m.revision,subscribeContext:()=>()=>{},listSavedBotTasks:m.list,getSavedBotTask:m.get,createSavedBotTask:m.create,updateSavedBotTask:m.update,savedBotTaskHistory:m.history,botPrCapabilities:m.prCapabilities,readinessCapabilities:m.reportCapabilities,readinessReportsForTask:m.reports,botPrRunsForTask:m.prRuns}}));
vi.mock('../../../desktop/src/lib/jiraTicketDiscovery',async()=>({...await vi.importActual('../../../desktop/src/lib/jiraTicketDiscovery'),createJiraTicketDiscoveryClient:(owner:any,readCurrentOwner:any)=>{m.jiraOwners.push({owner,readCurrentOwner});return{connections:m.jiraConnections}}}));
const native=vi.hoisted(()=>({current:vi.fn(),status:vi.fn(),select:vi.fn(),capture:vi.fn(),stop:vi.fn()}));
vi.mock('../../../desktop/src/lib/nativeObservationAdapter',()=>({createNativeObservationAdapter:()=>native}));
vi.mock('../../../desktop/src/lib/nativeObservationFocus',()=>({subscribeNativeObservationFocus:async()=>()=>{}}));
import {SavedBotTaskWorkspace} from "../../../desktop/src/components/SavedBotTaskWorkspace";
import {AxiomBotView} from "../../../desktop/src/views/AxiomBotView";
const id="bot_"+"a".repeat(64);const saved={id,title:"Saved example",instruction:"Saved instruction",context:"Saved context",status:"draft" as const,version:0,createdAt:"2026-10-25T00:00:00.000Z",updatedAt:"2026-10-25T00:00:00.000Z"};
function Host(){const[draft,setDraft]=useState({ownerKey:"owned",title:"",task:"",context:""});return createElement(SavedBotTaskWorkspace,{ownerKey:"owned",draft,onDraftChange:setDraft,active:true})}
const fill=()=>{fireEvent.change(screen.getByLabelText('Bot task title'),{target:{value:'Unsent task'}});fireEvent.change(screen.getByLabelText('What should Axiom Bot help with?'),{target:{value:'Public test instruction'}})};
beforeEach(()=>{vi.clearAllMocks();m.config={sessionToken:"axm.desk.synthetic"};m.revision=0;m.list.mockResolvedValue({ok:true,data:{tasks:[saved],nextCursor:null}});m.get.mockResolvedValue({ok:true,data:{task:saved}});m.create.mockResolvedValue({ok:true,data:{task:saved}});m.update.mockResolvedValue({ok:true,data:{task:{...saved,version:1}}});m.history.mockResolvedValue({ok:true,data:{taskId:id,events:[{version:0,eventType:"draft.created",content:{title:saved.title,instruction:saved.instruction,context:saved.context},occurredAt:saved.createdAt}],nextBeforeVersion:null}})});afterEach(cleanup);
it("never uploads typing and only saves after an explicit valid click",async()=>{render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fill();expect(m.create).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/^Run/})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Save task draft'}));await screen.findByText('Saved draft · version 0');expect(m.create).toHaveBeenCalledWith(expect.objectContaining({title:'Unsent task',instruction:'Public test instruction',context:'',clientRequestId:expect.any(String)}),expect.any(AbortSignal))});
it("reopens a saved draft after the workspace is recreated",async()=>{const first=render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});first.unmount();render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));await screen.findByDisplayValue(saved.instruction);expect((screen.getByLabelText('Bot task title') as HTMLInputElement).value).toBe(saved.title)});
it("requires confirmation before replacing unsent text",async()=>{render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fill();fireEvent.click(screen.getByRole('button',{name:'Open saved task Saved example'}));expect(m.get).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));expect((screen.getByLabelText('Bot task title') as HTMLInputElement).value).toBe('Unsent task')});
it("never saves an oversized visible candidate in place of the previous valid text",async()=>{render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fill();fireEvent.change(screen.getByLabelText('What should Axiom Bot help with?'),{target:{value:'x'.repeat(4001)}});expect(screen.getByRole('button',{name:'Save task draft'})).toHaveProperty('disabled',true);expect(m.create).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Open saved task Saved example'}));expect(screen.getByRole('button',{name:'Keep editing'})).toBeTruthy()});
it("preserves local edits on version conflict",async()=>{m.update.mockResolvedValue({ok:false,error:'Newer saved version',errorCode:'saved_task_conflict_reload_before_saving',outcomeUnconfirmed:false});render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));await screen.findByDisplayValue(saved.instruction);fireEvent.change(screen.getByLabelText('What should Axiom Bot help with?'),{target:{value:'Preserve these edits'}});fireEvent.click(screen.getByRole('button',{name:'Save task draft'}));await screen.findByText('Newer saved version');expect((screen.getByLabelText('What should Axiom Bot help with?') as HTMLTextAreaElement).value).toBe('Preserve these edits');expect(screen.getByRole('button',{name:'Review saved version'})).toBeTruthy();expect(screen.getByRole('button',{name:'Save task draft'})).toHaveProperty('disabled',true)});
it("retries an unknown save with the same immutable payload and identifier",async()=>{m.create.mockResolvedValueOnce({ok:false,error:'Outcome unconfirmed',errorCode:'saved_task_timeout',outcomeUnconfirmed:true});render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fill();fireEvent.click(screen.getByRole('button',{name:'Save task draft'}));fireEvent.click(await screen.findByRole('button',{name:'Retry same save'}));await screen.findByText('Saved draft · version 0');expect(m.create.mock.calls[0][0]).toEqual(m.create.mock.calls[1][0]);expect(m.create).toHaveBeenCalledTimes(2)});
it("ignores late saved-task reads after a context change",async()=>{let resolve!:(v:unknown)=>void;m.get.mockReturnValue(new Promise(r=>{resolve=r}));render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));m.config={sessionToken:'axm.desk.changed'};m.revision++;await act(async()=>resolve({ok:true,data:{task:saved}}));expect(screen.queryByDisplayValue(saved.instruction)).toBeNull()});
it("shows immutable history without replacing current unsent edits",async()=>{render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));await screen.findByDisplayValue(saved.instruction);fireEvent.change(screen.getByLabelText('What should Axiom Bot help with?'),{target:{value:'Unsaved edit retained'}});fireEvent.click(screen.getByRole('button',{name:'History'}));await screen.findByText('Version 0');expect((screen.getByLabelText('What should Axiom Bot help with?') as HTMLTextAreaElement).value).toBe('Unsaved edit retained')});

it("wires real saved-task controls into the paired Bot route",async()=>{render(createElement(AxiomBotView,{identity:{kind:"desktop_session",organizationId:"org-a",capabilities:["workspace:read"],access:{allowed:true,code:"active",title:"Active",message:"Verified",planTier:"pro",billingStatus:"active",accessRequestPath:"/access",pricingPath:"/pricing"}}}));await screen.findByRole('button',{name:'Open saved task Saved example'});expect(screen.getByRole('button',{name:'Save task draft'})).toBeTruthy();expect(screen.queryByRole('button',{name:/^Run/})).toBeNull()});

it("locks edits while opening a saved draft",async()=>{let resolve!:(v:unknown)=>void;m.get.mockReturnValue(new Promise(r=>{resolve=r}));render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));expect(screen.getByLabelText('Bot task title')).toHaveProperty('disabled',true);await act(async()=>resolve({ok:true,data:{task:saved}}))});
it("dismisses replacement confirmation while retaining unknown-save retry",async()=>{m.create.mockResolvedValueOnce({ok:false,error:'Outcome unconfirmed',errorCode:'saved_task_timeout',outcomeUnconfirmed:true});render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fill();fireEvent.click(screen.getByRole('button',{name:'New draft'}));expect(screen.getByRole('button',{name:'Start new draft'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Save task draft'}));await screen.findByRole('button',{name:'Retry same save'});expect(screen.queryByRole('button',{name:'Start new draft'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Retry same save'}));await screen.findByText('Saved draft · version 0');expect(m.create.mock.calls[0][0]).toEqual(m.create.mock.calls[1][0])});

it("retains selected task, history and unsaved edits across identical identity revalidation",async()=>{
 const identity={kind:"desktop_session" as const,organizationId:"org-a",role:"owner" as const,capabilities:["workspace:read"],access:{allowed:true,code:"active" as const,title:"Active",message:"Verified",planTier:"pro",billingStatus:"active",accessRequestPath:"/access",pricingPath:"/pricing"}};
 const view=render(createElement(AxiomBotView,{identity}));
 fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));
 await screen.findByDisplayValue(saved.instruction);
 fireEvent.change(screen.getByLabelText('What should Axiom Bot help with?'),{target:{value:'Unsaved focus edit'}});
 fireEvent.click(screen.getByRole('button',{name:'History'}));await screen.findByText('Version 0');
 view.rerender(createElement(AxiomBotView,{identity:JSON.parse(JSON.stringify(identity))}));
 expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value','Unsaved focus edit');
 expect(screen.getByText('Version 0')).toBeTruthy();
 expect(m.create).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
});

it('opens a genuine saved instruction in the activity surface and keeps unsaved text through inspector tabs',async()=>{
 render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));await screen.findByDisplayValue(saved.instruction);
 expect(screen.getByRole('region',{name:'Bot task activity'}).textContent).toContain('Saved instruction · version 0');
 fireEvent.change(screen.getByLabelText('What should Axiom Bot help with?'),{target:{value:'Unsent instruction kept'}});
 fireEvent.click(screen.getByRole('tab',{name:'Library'}));expect(screen.getByText('No task outputs yet.')).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'Computer'}));expect(screen.getByText('Observe one window')).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'Details'}));expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value','Unsent instruction kept');expect(screen.getByLabelText('Bot task title')).toHaveProperty('value',saved.title);expect(m.update).not.toHaveBeenCalled();
});
it('filters only loaded tasks without replacing the open editor',async()=>{
 render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fill();
 fireEvent.change(screen.getByLabelText('Filter loaded tasks'),{target:{value:'missing'}});expect(screen.queryByRole('button',{name:'Open saved task Saved example'})).toBeNull();expect(screen.getByText('No loaded tasks match.')).toBeTruthy();expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value','Public test instruction');
 fireEvent.change(screen.getByLabelText('Filter loaded tasks'),{target:{value:''}});expect(screen.getByRole('button',{name:'Open saved task Saved example'})).toBeTruthy();
});
it('saves a new instruction with an automatic title through the existing explicit route',async()=>{
 render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});
 fireEvent.change(screen.getByLabelText('What should Axiom Bot help with?'),{target:{value:'Check current release evidence'}});expect(m.create).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Save task draft'}));await screen.findByText('Saved draft · version 0');expect(m.create).toHaveBeenCalledWith(expect.objectContaining({title:'Check current release evidence',instruction:'Check current release evidence'}),expect.any(AbortSignal));
});

it('keeps the full invalid candidate when preserving conflict edits as a new draft',async()=>{
 m.update.mockResolvedValue({ok:false,error:'Newer saved version',errorCode:'saved_task_conflict_reload_before_saving',outcomeUnconfirmed:false});render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));await screen.findByDisplayValue(saved.instruction);
 fireEvent.change(screen.getByLabelText('What should Axiom Bot help with?'),{target:{value:'My conflicting edit'}});fireEvent.click(screen.getByRole('button',{name:'Save task draft'}));await screen.findByText('Newer saved version');
 fireEvent.change(screen.getByLabelText('What should Axiom Bot help with?'),{target:{value:'x'.repeat(4001)}});fireEvent.click(screen.getByRole('button',{name:'Keep edits as new draft'}));
 expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value','x'.repeat(4001));expect(screen.getByRole('button',{name:'Save task draft'})).toHaveProperty('disabled',true);
});

it('supports keyboard navigation between inspector tabs without changing the draft',async()=>{
 render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fill();
 fireEvent.keyDown(screen.getByRole('tab',{name:'Details'}),{key:'ArrowRight'});expect(screen.getByRole('tab',{name:'Library'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value','Public test instruction');
});

it('focuses responsive panels when opened and returns focus when closed',async()=>{
 render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});
 const tasks=screen.getByRole('button',{name:'Tasks'});fireEvent.click(tasks);expect(document.activeElement).toBe(screen.getByLabelText('Filter loaded tasks'));
 fireEvent.click(screen.getByRole('button',{name:'Close task list'}));expect(document.activeElement).toBe(tasks);
 const details=screen.getByRole('button',{name:'Task details'});fireEvent.click(details);expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Details'}));
 fireEvent.click(screen.getByRole('button',{name:'Close task details'}));expect(document.activeElement).toBe(details);
});

it('closes the inspector with Escape from portaled context fields and restores focus',async()=>{
 render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});
 const trigger=screen.getByRole('button',{name:'Task details'});fireEvent.click(trigger);const context=screen.getByLabelText('Context to include');context.focus();fireEvent.keyDown(context,{key:'Escape'});
 expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(trigger);
});
it('opens the bounded report workflow from Library without replacing the saved instruction',async()=>{render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));await screen.findByDisplayValue(saved.instruction);fireEvent.click(screen.getByRole('tab',{name:'Library'}));expect(screen.getByRole('region',{name:'Recorded readiness report'})).toBeTruthy();expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value',saved.instruction)});

it.each([true,false])('runs native support only when the Computer inspector is actually visible (wide=%s)',async wide=>{
 const media={matches:wide,addEventListener:vi.fn(),removeEventListener:vi.fn()};vi.stubGlobal('matchMedia',()=>media);const flags={source:'native_selected_window',inputAvailable:false,aiSharingAvailable:false,backgroundCapture:false};native.current.mockResolvedValue({current:true});native.status.mockResolvedValue({...flags,supported:true});native.stop.mockResolvedValue({stopped:true});native.select.mockResolvedValue({...flags,sessionId:'observation_11111111-1111-4111-8111-111111111111',revision:0,appLabel:'App',windowLabel:'Window',expiresAt:new Date(Date.now()+120000).toISOString()});
 try{render(createElement(SavedBotTaskWorkspace,{ownerKey:'owned',draft:{ownerKey:'owned',title:'',task:'',context:''},onDraftChange:()=>{},active:true,observationIdentity:{workspaceId:'org',actorId:'opaque'}}));await screen.findByRole('button',{name:'Open saved task Saved example'});fireEvent.click(screen.getByRole('tab',{name:'Computer'}));await act(async()=>{});expect(native.status).toHaveBeenCalledTimes(wide?1:0);if(!wide){fireEvent.click(screen.getByRole('button',{name:'Task details'}));await act(async()=>{});expect(native.status).toHaveBeenCalledTimes(1)}fireEvent.click(screen.getByRole('button',{name:'Select window'}));await act(async()=>{});expect(native.select).toHaveBeenCalledTimes(1)}finally{cleanup();vi.unstubAllGlobals()}
});

it('loads shared-app evidence and reports only while their inspector is visible, retaining the draft',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 m.prCapabilities.mockResolvedValue({ok:false,error:'Unavailable'});m.reportCapabilities.mockResolvedValue({ok:false,error:'Unavailable'});
 try{render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));await screen.findByDisplayValue(saved.instruction);await act(async()=>{});expect(m.prCapabilities).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Task details'}));await act(async()=>{});expect(m.prCapabilities).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('tab',{name:'Library'}));await act(async()=>{});expect(m.reportCapabilities).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Close task details'}));expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value',saved.instruction);
 }finally{cleanup();vi.unstubAllGlobals()}
});

it('launches the actual shared-app workflows and saved outcomes without changing the task draft',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 m.reportCapabilities.mockResolvedValue({ok:true,data:{enabled:true,canStart:true}});m.reports.mockResolvedValue({ok:true,data:{runs:[{id:'botrun_'+'b'.repeat(64),taskId:id,taskVersion:0,status:'completed',revision:2,attemptCount:1,createdAt:saved.createdAt,updatedAt:saved.updatedAt,deadlineAt:saved.updatedAt}],truncated:false}});
 m.prCapabilities.mockResolvedValue({ok:true,data:{enabled:true,canStart:false,recoveryScope:'owned'}});m.prRuns.mockResolvedValue({ok:true,data:{runs:[],truncated:false}});
 try{render(createElement(Host));fireEvent.click(await screen.findByRole('button',{name:'Open saved task Saved example'}));await screen.findByDisplayValue(saved.instruction);
 fireEvent.click(screen.getByRole('button',{name:'App actions'}));expect(m.reportCapabilities).not.toHaveBeenCalled();expect(m.prCapabilities).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Open workspace report'}));await screen.findByRole('button',{name:'Open report from version 0'});expect(screen.getByRole('tab',{name:'Library'}).getAttribute('aria-selected')).toBe('true');expect(m.reports).toHaveBeenCalledWith(id,expect.any(AbortSignal));
 fireEvent.click(screen.getByRole('button',{name:'Open GitHub evidence'}));await screen.findByText('A current GitHub connection and read permissions are required. Review shared connections in Connect apps.');expect(m.prRuns).toHaveBeenCalledWith(id,expect.any(AbortSignal));expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value',saved.instruction);
 }finally{cleanup();vi.unstubAllGlobals()}
});
it('explains the saved-task prerequisite through the launcher without creating or running work',async()=>{render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fill();fireEvent.click(screen.getByRole('button',{name:'App actions'}));expect(screen.getByText('Save this task first for reports and evidence history. Jira form exploration can be used without saving.')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Open GitHub evidence'}));expect(screen.getByText('Save a task to read a release’s pull request evidence.')).toBeTruthy();expect(m.create).not.toHaveBeenCalled();expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value','Public test instruction')});

it('explores Jira from Bot only after explicit load, without saving, publishing or replacing the instruction',async()=>{
 m.jiraConnections.mockResolvedValue({ok:true,data:{connections:[],hasMore:false,currentHealth:'not_checked'}});render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fill();fireEvent.click(screen.getByRole('button',{name:'App actions'}));fireEvent.click(screen.getByRole('button',{name:'Explore Jira form'}));
 expect(m.jiraConnections).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Load Jira connections'}));await screen.findByText(/No connection with recorded read validation/);expect(m.jiraConnections).toHaveBeenCalledTimes(1);expect(m.jiraOwners.at(-1).owner.config).toBe(m.config);expect(m.jiraOwners.at(-1).readCurrentOwner()).toEqual({config:m.config,revision:0});expect(m.create).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/publish|save ticket action/i})).toBeNull();expect(screen.getByLabelText('What should Axiom Bot help with?')).toHaveProperty('value','Public test instruction');
});
it('closing Bot Jira exploration aborts its pending read and ignores a late result',async()=>{
 let resolve!:(v:unknown)=>void;m.jiraConnections.mockReturnValue(new Promise(r=>resolve=r));render(createElement(Host));await screen.findByRole('button',{name:'Open saved task Saved example'});fireEvent.click(screen.getByRole('button',{name:'App actions'}));fireEvent.click(screen.getByRole('button',{name:'Explore Jira form'}));fireEvent.click(screen.getByRole('button',{name:'Load Jira connections'}));const signal=m.jiraConnections.mock.calls.at(-1)![0] as AbortSignal;fireEvent.click(screen.getByRole('button',{name:'Close Jira form'}));expect(signal.aborted).toBe(true);await act(async()=>resolve({ok:true,data:{connections:[]}}));expect(screen.queryByRole('region',{name:'Jira ticket discovery'})).toBeNull();
});

it('requires fresh Jira exploration after task change or inactive workspace return',async()=>{
 m.jiraOwners=[];const draft={ownerKey:'owned',title:'',task:'',context:''};const view=render(createElement(SavedBotTaskWorkspace,{ownerKey:'owned',draft,onDraftChange:()=>{},active:true}));await screen.findByRole('button',{name:'Open saved task Saved example'});fireEvent.click(screen.getByRole('button',{name:'App actions'}));fireEvent.click(screen.getByRole('button',{name:'Explore Jira form'}));expect(screen.getByRole('button',{name:'Load Jira connections'})).toBeTruthy();const opened=m.jiraOwners.length;
 view.rerender(createElement(SavedBotTaskWorkspace,{ownerKey:'owned',draft,onDraftChange:()=>{},active:false}));view.rerender(createElement(SavedBotTaskWorkspace,{ownerKey:'owned',draft,onDraftChange:()=>{},active:true}));expect(screen.queryByRole('button',{name:'Load Jira connections'})).toBeNull();expect(m.jiraOwners).toHaveLength(opened);
 fireEvent.click(screen.getByRole('button',{name:'Explore Jira form'}));expect(screen.getByRole('button',{name:'Load Jira connections'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Open saved task Saved example'}));await screen.findByText('Saved instruction · version 0');expect(screen.queryByRole('button',{name:'Load Jira connections'})).toBeNull();
});
