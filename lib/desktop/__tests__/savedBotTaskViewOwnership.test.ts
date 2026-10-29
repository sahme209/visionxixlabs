/** @vitest-environment jsdom */
import {createElement} from "react";
import {it,expect,vi} from "vitest";
import {render,screen,act,fireEvent} from "@testing-library/react";
const m=vi.hoisted(()=>({config:{sessionToken:"axm.desk.synthetic"},children:[] as Array<{ownerKey:string;draft:{ownerKey:string;title:string;task:string;context:string};onDraftChange:(value:{ownerKey:string;title:string;task:string;context:string})=>void}>}));
vi.mock("../../../desktop/src/lib/desktopClient",()=>({desktopClient:{get config(){return m.config},subscribeContext:()=>()=>{},getContextRevision:()=>0}}));
vi.mock("../../../desktop/src/components/AxiomBotDraftTask",()=>({AxiomBotDraftTask:(props:any)=>{m.children.push(props);return createElement('output',{'data-testid':'draft'},props.draft.title)}}));
vi.mock("../../../desktop/src/components/SavedBotTaskWorkspace",()=>({SavedBotTaskWorkspace:(props:any)=>{m.children.push(props);return createElement('output',{'data-testid':'draft'},props.draft.title)}}));
import {AxiomBotView} from "../../../desktop/src/views/AxiomBotView";
it("refuses an old draft callback after the paired identity object changes",()=>{const first={kind:'desktop_session' as const,organizationId:'org-a',capabilities:['workspace:read'],access:{allowed:true,code:'active' as const,title:'Active',message:'Verified',planTier:'pro',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/pricing'}};const view=render(createElement(AxiomBotView,{identity:first}));const old=m.children[0];view.rerender(createElement(AxiomBotView,{identity:{...first,organizationId:'org-b'}}));act(()=>old.onDraftChange({...old.draft,title:'PRIVATE OLD TASK'}));expect(screen.queryByText('PRIVATE OLD TASK')).toBeNull();view.unmount()});

it.each(['role','capabilities','access','credentials'])("clears editor and refuses stale callbacks when %s changes",change=>{
 const first={kind:'desktop_session' as const,organizationId:'org-a',role:'owner' as const,capabilities:['workspace:read'],access:{allowed:true,code:'active' as const,title:'Active',message:'Verified',planTier:'pro',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/pricing'}};
 const start=m.children.length;const view=render(createElement(AxiomBotView,{identity:first}));const old=m.children[start];
 act(()=>old.onDraftChange({...old.draft,title:'PRIVATE OLD TASK'}));
 expect(screen.getByText('PRIVATE OLD TASK')).toBeTruthy();
 const next={...first,...(change==='role'?{role:'read_only' as const}:change==='capabilities'?{capabilities:[]}:change==='access'?{access:{...first.access,allowed:false}}:{})};
 if(change==='credentials')m.config={sessionToken:'axm.desk.changed'};
 view.rerender(createElement(AxiomBotView,{identity:next}));
 act(()=>old.onDraftChange({...old.draft,title:'PRIVATE OLD TASK'}));
 expect(screen.queryByText('PRIVATE OLD TASK')).toBeNull();view.unmount();
});

it("opens existing app connections without changing the unsaved Bot draft",()=>{
 const identity={kind:'desktop_session' as const,organizationId:'org-a',capabilities:['workspace:read'],access:{allowed:true,code:'active' as const,title:'Active',message:'Verified',planTier:'pro',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/pricing'}};
 const open=vi.fn();const start=m.children.length;const view=render(createElement(AxiomBotView,{identity,onConnectApps:open}));
 const child=m.children[start];act(()=>child.onDraftChange({...child.draft,title:'Keep my draft'}));
 fireEvent.click(screen.getByRole('button',{name:'Connect apps'}));
 expect(open).toHaveBeenCalledTimes(1);expect(screen.getByText('Keep my draft')).toBeTruthy();view.unmount();
});
it('does not substitute email or ephemeral observation actor for stable recovery user identity',()=>{const start=m.children.length,identity={kind:'desktop_session' as const,organizationId:'org-a',email:'verified@example.test',capabilities:['workspace:read'],access:{allowed:true,code:'active' as const,title:'Active',message:'Verified',planTier:'pro',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/pricing'}};const view=render(createElement(AxiomBotView,{identity}));expect(m.children[start]).not.toHaveProperty('recoveryIdentity');expect(m.children[start]).toMatchObject({observationIdentity:{workspaceId:'org-a',actorId:expect.stringMatching(/^local-bot-workspace:/)}});view.unmount()});

it('passes only stable server-verified paired user identity and resets the old draft on user switch',()=>{const start=m.children.length,identity={kind:'desktop_session' as const,organizationId:'org-a',userId:'verified-user-one',email:'same@example.test',capabilities:['workspace:read'],access:{allowed:true,code:'active' as const,title:'Active',message:'Verified',planTier:'pro',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/pricing'}};const view=render(createElement(AxiomBotView,{identity}));const old=m.children[start];expect(old).toMatchObject({recoveryIdentity:{organizationId:'org-a',userId:'verified-user-one'}});act(()=>old.onDraftChange({...old.draft,title:'PRIVATE FIRST USER'}));expect(screen.getByText('PRIVATE FIRST USER')).toBeTruthy();view.rerender(createElement(AxiomBotView,{identity:{...identity,userId:'verified-user-two'}}));expect(m.children.at(-1)).toMatchObject({recoveryIdentity:{organizationId:'org-a',userId:'verified-user-two'}});act(()=>old.onDraftChange({...old.draft,title:'PRIVATE FIRST USER'}));expect(screen.queryByText('PRIVATE FIRST USER')).toBeNull();view.unmount()});
it('API-key identity never supplies a paired computer recovery identity or workspace',()=>{const start=m.children.length,identity={kind:'api_key' as const,organizationId:'org-a',userId:'unexpected-user',capabilities:['workspace:read'],access:{allowed:true,code:'active' as const,title:'Active',message:'Verified',planTier:'pro',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/pricing'}};const view=render(createElement(AxiomBotView,{identity}));expect(m.children).toHaveLength(start);expect(screen.getByText(/verified paired workspace session is required/)).toBeTruthy();view.unmount()});
it.each(['','   ','bad\u0000user'])('does not substitute an invalid stable user identifier %s',userId=>{const start=m.children.length,identity={kind:'desktop_session' as const,organizationId:'org-a',userId,email:'verified@example.test',capabilities:['workspace:read'],access:{allowed:true,code:'active' as const,title:'Active',message:'Verified',planTier:'pro',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/pricing'}};const view=render(createElement(AxiomBotView,{identity}));expect(m.children[start]).not.toHaveProperty('recoveryIdentity');view.unmount()});
