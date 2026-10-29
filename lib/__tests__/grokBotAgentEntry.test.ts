// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {createElement,useState} from 'react';
import {render,screen,fireEvent,waitFor,cleanup,act,within} from '@testing-library/react';
import type {VerifiedDesktopIdentity} from '../../desktop/src/lib/desktopClient';
const m=vi.hoisted(()=>({config:{apiBase:'https://axiom.test',sessionToken:'axm.desk.synthetic'},revision:1,listeners:new Set<()=>void>(),methods:new Map<string,ReturnType<typeof vi.fn>>()}));
vi.mock('../../desktop/src/lib/desktopClient',()=>({desktopClient:new Proxy({}, {get(_target,key){if(key==='config')return m.config;if(key==='getContextRevision')return()=>m.revision;if(key==='subscribeContext')return(fn:()=>void)=>{m.listeners.add(fn);return()=>m.listeners.delete(fn);};const name=String(key);if(!m.methods.has(name))m.methods.set(name,vi.fn(async()=>({ok:false,error:'synthetic_unavailable'})));return m.methods.get(name);}})}));
vi.mock('../../desktop/src/lib/preferences',()=>({readDesktopPreferences:async()=>({})}));
import {AxiomBotView as AgentChatView} from '../../desktop/src/views/AxiomBotView';
import {AgentChatView as ActualChatView} from '../../desktop/src/views/AgentChatView';
const identity=():VerifiedDesktopIdentity=>({kind:'desktop_session',organizationId:'tenant',email:'verified@example.invalid',capabilities:[],access:{allowed:true,code:'active',title:'Active',message:'Synthetic verified access',planTier:'pro',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/pricing'}});
beforeEach(()=>{m.methods.clear();m.listeners.clear();m.config={apiBase:'https://axiom.test',sessionToken:'axm.desk.synthetic'};m.revision=1;Element.prototype.scrollIntoView=vi.fn();Element.prototype.scrollTo=vi.fn();});afterEach(cleanup);
it('retains same-owner drafts and refuses Send until AI capability and models are verified',()=>{
 const who=identity();const view=render(createElement(AgentChatView,{identity:who}));
 fireEvent.change(screen.getByLabelText('Bot task title'),{target:{value:'Unsent readiness check'}});
 view.rerender(createElement(AgentChatView,{identity:who,active:false}));expect(screen.queryByRole('textbox',{name:'Bot task title'})).toBeNull();
 view.rerender(createElement(AgentChatView,{identity:who}));expect((screen.getByLabelText('Bot task title') as HTMLInputElement).value).toBe('Unsent readiness check');
 expect(screen.getByRole('complementary',{name:'Saved task details'})).toBeTruthy();expect(screen.getByRole('button',{name:'Send'})).toHaveProperty('disabled',true);expect(screen.queryByRole('button',{name:/run|connect|control/i})).toBeNull();expect(screen.queryByRole('combobox',{name:'Bot model'})).toBeNull();expect(new Set(m.methods.keys())).toEqual(new Set(['botAiCapabilities','listSavedBotTasks']));expect(m.methods.get('listSavedBotTasks')).toHaveBeenCalledTimes(1);
});
it.each(['config','context','identity'] as const)('withholds old text synchronously after %s replacement',async change=>{
 let who=identity();const view=render(createElement(AgentChatView,{identity:who}));fireEvent.change(screen.getByLabelText('Bot task title'),{target:{value:'PRIVATE OLD DRAFT'}});
 if(change==='config')m.config={...m.config};if(change==='identity')who={...who,organizationId:'other-tenant'};if(change==='context')await act(async()=>{m.revision++;for(const listener of m.listeners)listener();});
 view.rerender(createElement(AgentChatView,{identity:who}));expect(screen.queryByDisplayValue('PRIVATE OLD DRAFT')).toBeNull();expect((screen.getByLabelText('Bot task title') as HTMLInputElement).value).toBe('');
});
it('requires verified paired identity rather than API-key or missing identity',()=>{
 const view=render(createElement(AgentChatView,{identity:{...identity(),kind:'api_key'}}));expect(screen.queryByLabelText('Bot task title')).toBeNull();expect(screen.getByText(/verified paired workspace session/)).toBeTruthy();view.rerender(createElement(AgentChatView,{}));expect(screen.queryByLabelText('Bot task title')).toBeNull();
});

// App route active semantics with the real, unchanged Chat implementation.
function QueueRouteHarness(){
 const [bot,setBot]=useState(false);const [who]=useState(identity);
 return createElement('div',{},createElement('button',{onClick:()=>setBot(true)},'Open Axiom Bot'),createElement('button',{onClick:()=>setBot(false)},'Return to Agent'),createElement('div',{hidden:bot},createElement(ActualChatView,{identity:who,active:!bot})),bot?createElement(AgentChatView,{identity:who}):null);
}
it('pauses actual queued Chat work off-route and preserves recovery/drafts when returning',async()=>{
 const summary={id:'queued-chat',title:'Existing chat',createdAt:'2026-10-24T00:00:00Z',updatedAt:'2026-10-24T00:00:00Z',turnCount:0};
 m.methods.set('listAgentConversations',vi.fn(async()=>({ok:true,data:{conversations:[summary]}})));
 m.methods.set('getAgentConversation',vi.fn(async()=>({ok:true,data:{...summary,turns:[],actions:[]}})));
 m.methods.set('listAgentSkills',vi.fn(async()=>({ok:true,data:{skills:[]}})));
 m.methods.set('aiProviderStatus',vi.fn(async()=>({ok:true,data:{providers:[{provider:'vercel_gateway',models:[{id:'fixture/model',label:'Fixture model',tier:'standard'}]}],policy:{enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:'fixture/model'},fallbackOrder:['vercel_gateway']}}})));
 let finish!:()=>void;const first=new Promise<void>(r=>{finish=r;});
 const send=vi.fn(async(..._args:unknown[])=>{if(send.mock.calls.length===1)await first;return{ok:true,data:{reply:'Synthetic saved response',proposal:null,usage:{decisionSteps:1,inputTokens:1,outputTokens:1,totalTokens:2}}};});m.methods.set('sendAgentMessage',send);
 render(createElement(QueueRouteHarness));await waitFor(()=>expect((screen.getByLabelText('Agent request') as HTMLTextAreaElement).disabled).toBe(false));
 fireEvent.change(screen.getByLabelText('Agent request'),{target:{value:'First owned request'}});await waitFor(()=>expect((screen.getByRole('button',{name:'Send'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Send'}));await waitFor(()=>expect(send).toHaveBeenCalledTimes(1));
 fireEvent.change(screen.getByLabelText('Agent request'),{target:{value:'Queued second request'}});fireEvent.click(screen.getByRole('button',{name:'Queue message'}));await screen.findByLabelText('Queued Agent messages');
 fireEvent.change(screen.getByLabelText('Agent request'),{target:{value:'Retained third draft'}});fireEvent.click(screen.getByRole('button',{name:'Open Axiom Bot'}));await screen.findByLabelText('Bot task title');const backgroundModelReads=m.methods.get('aiProviderStatus')!.mock.calls.length;fireEvent(window,new Event('focus'));await act(async()=>{await Promise.resolve();});expect(m.methods.get('aiProviderStatus')).toHaveBeenCalledTimes(backgroundModelReads);await act(async()=>{finish();await first;});
 expect(send).toHaveBeenCalledTimes(1);expect((send.mock.calls[0][5] as {signal:AbortSignal}).signal.aborted).toBe(true);expect(m.methods.get('listAgentConversations')).toHaveBeenCalledTimes(1);const modelReads=m.methods.get('aiProviderStatus')!.mock.calls.length;
 fireEvent.click(screen.getByRole('button',{name:'Return to Agent'}));await waitFor(()=>expect(m.methods.get('aiProviderStatus')!.mock.calls.length).toBeGreaterThan(modelReads));expect(send).toHaveBeenCalledTimes(1);expect(screen.getByText('Queued second request')).toBeTruthy();expect(screen.getByText(/Request stopped/)).toBeTruthy();expect(m.methods.get('listAgentConversations')).toHaveBeenCalledTimes(1);expect((screen.getByLabelText('Agent request') as HTMLTextAreaElement).value).toBe('Retained third draft');
});
