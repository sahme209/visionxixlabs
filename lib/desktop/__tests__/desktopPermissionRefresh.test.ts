/** @vitest-environment jsdom */
import {createElement} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({list:vi.fn(),readingOverview:false,update:vi.fn(),context:{} as object,subscribe:vi.fn(),open:vi.fn()}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:m.open}));
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
vi.mock('../../../desktop/src/lib/preferences',()=>({readDesktopPreferences:vi.fn().mockResolvedValue(null),writeDesktopPreferences:vi.fn()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.context;},getContextRevision:()=>1,listWorkspaceMembers:()=>m.readingOverview ? Promise.resolve({ok:true,data:{currentUserId:'owner',members:[]}}) : m.list(),updateWorkspaceMemberRole:m.update,subscribeContext:m.subscribe}}));
import {SettingsView} from '../../../desktop/src/views/SettingsView';
const identity={kind:'desktop_session',organizationId:'test-org',role:'owner',capabilities:['members:manage'],access:{allowed:true,code:'active',title:'Active',message:'Active',planTier:'free',billingStatus:'active',pricingPath:'/plans',accessRequestPath:'/contact'}} as const;
const result=(role='security_reviewer',manage=true)=>({ok:true,data:{currentUserId:'owner',currentRole:manage?'owner':'read_only',capabilities:manage?['members:manage']:['workspace:read'],members:[{userId:'reviewer',email:'reviewer@example.test',displayName:'Reviewer',role}]}});
const show=()=>{
 m.readingOverview=true;
 const view=render(createElement(SettingsView,{identity:identity as never}));
 m.readingOverview=false;
 fireEvent.click(screen.getByRole('button',{name:'Permissions'}));
 return view;
};
beforeEach(()=>{vi.clearAllMocks();m.context={};m.list.mockResolvedValue(result());m.subscribe.mockReturnValue(()=>{});});afterEach(cleanup);
it('refreshes an externally changed member role on window focus without a role write',async()=>{
 m.list.mockResolvedValueOnce(result()).mockResolvedValue(result('read_only'));show();await screen.findByDisplayValue('Security reviewer');fireEvent.focus(window);await screen.findByDisplayValue('Read only');expect(m.update).not.toHaveBeenCalled();
});
it('uses current service capabilities instead of cached owner claims for role controls',async()=>{
 m.list.mockResolvedValue(result('security_reviewer',false));show();await screen.findByDisplayValue('Security reviewer');expect((screen.getByRole('combobox',{name:'Role for reviewer@example.test'}) as HTMLSelectElement).disabled).toBe(true);expect(screen.getByText('Your role: read only')).toBeTruthy();
});
it('discards a delayed membership response after the credential context changes',async()=>{
 let finish!:(value:unknown)=>void;m.list.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;})).mockResolvedValue(result('read_only'));const view=show();await waitFor(()=>expect(m.list).toHaveBeenCalledOnce());m.context={replacement:true};view.rerender(createElement(SettingsView,{identity:identity as never}));await screen.findByDisplayValue('Read only');await act(async()=>finish(result('admin')));expect(screen.queryByDisplayValue('Admin')).toBeNull();expect(m.update).not.toHaveBeenCalled();
});
it('offers an explicit read-only retry and withholds cached authority after refresh failure',async()=>{
 m.list.mockResolvedValueOnce(result()).mockRejectedValueOnce(new Error('private transport failure')).mockResolvedValue(result('read_only',false));show();await screen.findByDisplayValue('Security reviewer');fireEvent.focus(window);await screen.findByRole('alert');expect(screen.queryByRole('combobox',{name:'Role for reviewer@example.test'})).toBeNull();expect(screen.queryByText('private transport failure')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Refresh members'}));await screen.findByDisplayValue('Read only');expect(m.update).not.toHaveBeenCalled();
});
it('ignores an old role-write result after credentials change',async()=>{
 let finish!:(value:unknown)=>void;m.update.mockReturnValue(new Promise(resolve=>{finish=resolve;}));const view=show();await screen.findByDisplayValue('Security reviewer');fireEvent.change(screen.getByRole('combobox',{name:'Role for reviewer@example.test'}),{target:{value:'read_only'}});await waitFor(()=>expect(m.update).toHaveBeenCalledOnce());m.context={replacement:true};m.list.mockResolvedValue(result('read_only',false));view.rerender(createElement(SettingsView,{identity:identity as never}));await screen.findByDisplayValue('Read only');await act(async()=>finish({ok:true,data:{userId:'reviewer',role:'read_only'}}));expect(m.list).toHaveBeenCalledTimes(2);expect(screen.getByText('Your role: read only')).toBeTruthy();
});
it('does not replay a failed role mutation during a refresh',async()=>{
 m.update.mockResolvedValue({ok:false,error:'Role update was rejected.'});show();await screen.findByDisplayValue('Security reviewer');fireEvent.change(screen.getByRole('combobox',{name:'Role for reviewer@example.test'}),{target:{value:'read_only'}});await screen.findByText('Role update was rejected.');fireEvent.focus(window);await screen.findByDisplayValue('Security reviewer');expect(m.update).toHaveBeenCalledTimes(1);
});

const ownResult=()=>{const r=result();r.data.members.push({userId:'owner',email:'owner@example.test',displayName:'Owner',role:'owner',acceptedAt:'2026-10-20T12:00:00.000Z',updatedAt:'2026-10-21T12:00:00.000Z'} as never);return r;};
it('opens a scoped advisory browser handoff only after a fresh own membership read and preserves local search',async()=>{m.list.mockResolvedValue(ownResult());show();const button=await screen.findByRole('button',{name:'Manage in cockpit'});const search=screen.getByPlaceholderText('Search settings');fireEvent.change(search,{target:{value:'Perm'}});fireEvent.click(button);await waitFor(()=>expect(m.open).toHaveBeenCalledOnce());const url=new URL(m.open.mock.calls[0][0]);expect(url.pathname).toBe('/workspace-handoff');expect(url.searchParams.get('expectedUserId')).toBe('owner');expect(url.searchParams.get('organizationId')).toBe('test-org');expect(url.searchParams.get('membershipUpdatedAt')).toBe('2026-10-21T12:00:00.000Z');expect((search as HTMLInputElement).value).toBe('Perm');expect(screen.getByRole('combobox',{name:'Role for reviewer@example.test'})).toBeTruthy();expect(m.update).not.toHaveBeenCalled();});
it('does not open a browser when credentials change while the click freshness read is pending',async()=>{let finish!:(value:unknown)=>void;m.list.mockResolvedValueOnce(ownResult()).mockReturnValueOnce(new Promise(r=>{finish=r;})).mockResolvedValue(ownResult());const view=show();fireEvent.click(await screen.findByRole('button',{name:'Manage in cockpit'}));await waitFor(()=>expect(m.list).toHaveBeenCalledTimes(2));m.context={newCredential:true};view.rerender(createElement(SettingsView,{identity:identity as never}));await act(async()=>finish(ownResult()));expect(m.open).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();});
it('withholds the handoff if current service authority or own membership cannot be confirmed',async()=>{m.list.mockResolvedValueOnce(ownResult()).mockResolvedValue(result('read_only',false));show();fireEvent.click(await screen.findByRole('button',{name:'Manage in cockpit'}));await screen.findByText(/Browser navigation could not be confirmed/);expect(m.open).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();});

it('retains the General member preview for an equivalent identity and refreshes it for a changed account',async()=>{
 const owner={...identity,userId:'owner'} as never;
 const view=render(createElement(SettingsView,{identity:owner}));
 await screen.findByText('Reviewer');
 view.rerender(createElement(SettingsView,{identity:{...identity,userId:'owner'} as never}));
 expect(screen.getByText('Reviewer')).toBeTruthy();
 expect(m.list).toHaveBeenCalledOnce();
 view.rerender(createElement(SettingsView,{identity:{...identity,userId:'different-account'} as never}));
 expect(screen.queryByText('Reviewer')).toBeNull();
 expect(await screen.findByText('Workspace members are unavailable.')).toBeTruthy();
 expect(m.list).toHaveBeenCalledTimes(2);
 expect(m.update).not.toHaveBeenCalled();
});

it('opens the verified workspace invitation from General without mutating membership', async () => {
 const owner = {...identity, userId: 'owner'} as never;
 m.list.mockResolvedValue(ownResult());
 render(createElement(SettingsView, {identity: owner}));
 fireEvent.click(await screen.findByRole('button', {name: 'Invite member'}));
 await waitFor(() => expect(m.open).toHaveBeenCalledOnce());
 const url = new URL(m.open.mock.calls[0][0]);
 expect(url.pathname).toBe('/workspace-handoff');
 expect(url.searchParams.get('destination')).toBe('members');
 expect(url.searchParams.get('expectedUserId')).toBe('owner');
 expect(url.searchParams.get('organizationId')).toBe('test-org');
 expect(m.list).toHaveBeenCalledTimes(2);
 expect(m.update).not.toHaveBeenCalled();
});

it('rechecks the General directory after window return and keeps a retry in the access section', async () => {
 let complete!: (value: unknown) => void;
 m.list.mockResolvedValueOnce(ownResult())
  .mockReturnValueOnce(new Promise(resolve => {complete = resolve;}))
  .mockResolvedValueOnce(result('read_only', false));
 render(createElement(SettingsView, {identity: {...identity, userId: 'owner'} as never}));
 const invite = await screen.findByRole('button', {name: 'Invite member'});
 invite.focus();
 fireEvent.focus(window);
 fireEvent.focus(window);
 await screen.findByText('Loading workspace members…');
 const heading = screen.getByRole('heading', {name: 'Access & roles'});
 expect(document.activeElement).toBe(heading);
 expect(screen.queryByRole('button', {name: 'Invite member'})).toBeNull();
 expect(m.list).toHaveBeenCalledTimes(2);
 await act(async () => complete({ok: false, error: 'Unavailable'}));
 const retry = screen.getByRole('button', {name: 'Refresh members'});
 retry.focus();
 fireEvent.click(retry);
 expect(document.activeElement).toBe(heading);
 expect(await screen.findByText('Read only')).toBeTruthy();
 expect(m.list).toHaveBeenCalledTimes(3);
 expect(screen.queryByRole('button', {name: 'Invite member'})).toBeNull();
 expect(m.update).not.toHaveBeenCalled();
 expect(m.open).not.toHaveBeenCalled();
});

it('removes an invitation when the fresh membership read refuses access and can recover', async () => {
 m.list.mockResolvedValueOnce(ownResult())
  .mockResolvedValueOnce(result('read_only', false))
  .mockResolvedValue(ownResult());
 render(createElement(SettingsView, {identity: {...identity, userId: 'owner'} as never}));
 const invite = await screen.findByRole('button', {name: 'Invite member'});
 invite.focus();
 fireEvent.click(invite);
 const status = await screen.findByText(/invitation page could not be verified/);
 expect(document.activeElement).toBe(status);
 expect(screen.queryByRole('button', {name: 'Invite member'})).toBeNull();
 expect(m.open).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', {name: 'Refresh members'}));
 await screen.findByRole('button', {name: 'Invite member'});
 expect(m.update).not.toHaveBeenCalled();
});
