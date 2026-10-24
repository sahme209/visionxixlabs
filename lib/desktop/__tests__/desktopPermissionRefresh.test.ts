/** @vitest-environment jsdom */
import {createElement} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({list:vi.fn(),update:vi.fn(),context:{} as object,subscribe:vi.fn()}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:vi.fn()}));
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
vi.mock('../../../desktop/src/lib/preferences',()=>({readDesktopPreferences:vi.fn().mockResolvedValue(null),writeDesktopPreferences:vi.fn()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.context;},listWorkspaceMembers:m.list,updateWorkspaceMemberRole:m.update,subscribeContext:m.subscribe}}));
import {SettingsView} from '../../../desktop/src/views/SettingsView';
const identity={kind:'desktop_session',organizationId:'test-org',role:'owner',capabilities:['members:manage'],access:{allowed:true,code:'active',title:'Active',message:'Active',planTier:'free',billingStatus:'active',pricingPath:'/plans',accessRequestPath:'/contact'}} as const;
const result=(role='security_reviewer',manage=true)=>({ok:true,data:{currentUserId:'owner',currentRole:manage?'owner':'read_only',capabilities:manage?['members:manage']:['workspace:read'],members:[{userId:'reviewer',email:'reviewer@example.test',displayName:'Reviewer',role}]}});
const show=()=>{const view=render(createElement(SettingsView,{identity:identity as never}));fireEvent.click(screen.getByRole('button',{name:'Permissions'}));return view;};
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
