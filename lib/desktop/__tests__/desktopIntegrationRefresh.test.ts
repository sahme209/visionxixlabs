/** @vitest-environment jsdom */
import{createElement}from'react';import{afterEach,beforeEach,expect,it,vi}from'vitest';import{act,cleanup,fireEvent,render,screen,waitFor}from'@testing-library/react';
const f=vi.hoisted(()=>({status:vi.fn(),health:vi.fn(),start:vi.fn(),validate:vi.fn(),context:{}as object,listeners:new Set<()=>void>()}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:vi.fn()}));vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
vi.mock('../../../desktop/src/lib/preferences',()=>({readDesktopPreferences:async()=>({theme:'dark'}),writeDesktopPreferences:vi.fn()}));
vi.mock('../../../desktop/src/components/AwsReadOnlyEnrollment',()=>({AwsReadOnlyEnrollment:()=>null}));vi.mock('../../../desktop/src/components/AzureReadOnlyEnrollment',()=>({AzureReadOnlyEnrollment:()=>null}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return f.context;},integrationStatus:f.status,integrationHealth:f.health,startIntegrationConnection:f.start,validateGitHubReadOnly:f.validate,subscribeContext:(callback:()=>void)=>{f.listeners.add(callback);return()=>f.listeners.delete(callback);}}}));
import{open}from'@tauri-apps/plugin-shell';
vi.mock('../../../desktop/src/components/AwsGuidedConnection',()=>({AwsGuidedConnection:()=>null}));
vi.mock('../../../desktop/src/components/AzureGuidedConnection',()=>({AzureGuidedConnection:()=>null}));
vi.mock('../../../desktop/src/components/GcpGuidedConnection',()=>({GcpGuidedConnection:()=>null}));
import{SettingsView}from'../../../desktop/src/views/SettingsView';
const status=(github='not_connected')=>({ok:true,data:{configuration:{github:true,slack:false,teams:false,linear:false},cloud:[],github:{status:github,repositorySelection:'all'},collaboration:[]}});
beforeEach(()=>{vi.clearAllMocks();f.context={};f.listeners.clear();f.status.mockResolvedValue(status());f.health.mockResolvedValue({ok:false,error:'fixture_unavailable'});});afterEach(()=>{cleanup();vi.useRealTimers();});
async function show(){render(createElement(SettingsView,{identity:{}as never}));fireEvent.click(screen.getByRole('button',{name:'Integrations'}));await waitFor(()=>expect(f.status).toHaveBeenCalled());}
it('recovers the refresh control and shows a safe error when the transport rejects',async()=>{f.status.mockRejectedValue(new Error('private upstream detail'));await show();await screen.findByText('Connection status could not be verified. Try refreshing.');expect((screen.getByRole('button',{name:'Refresh verified status'})as HTMLButtonElement).disabled).toBe(false);expect(screen.queryByText('private upstream detail')).toBeNull();});
it('reloads after a credential context change and ignores the old workspace status',async()=>{let resolve:(value:unknown)=>void=()=>{};f.status.mockReturnValueOnce(new Promise(r=>{resolve=r;}));await show();await act(async()=>{f.context={workspace:'replacement'};for(const listener of f.listeners)listener();});await waitFor(()=>expect(f.status).toHaveBeenCalledTimes(2));await act(async()=>{resolve(status('validated_read_only'));await new Promise(r=>setTimeout(r,0));});expect(screen.queryByText('Validated read-only')).toBeNull();expect((screen.getByRole('button',{name:'Refresh verified status'})as HTMLButtonElement).disabled).toBe(false);});

it('does not open consent returned for a replaced credential context',async()=>{let resolve:(value:unknown)=>void=()=>{};f.start.mockReturnValue(new Promise(r=>{resolve=r;}));await show();fireEvent.click(await screen.findByRole('button',{name:'Connect ↗'}));await waitFor(()=>expect(f.start).toHaveBeenCalledOnce());await act(async()=>{f.context={replacement:true};for(const listener of f.listeners)listener();});await act(async()=>{resolve({ok:true,data:{consentUrl:'https://github.com/apps/fixture/installations/new'}});});expect(open).not.toHaveBeenCalled();});
it('ignores validation success for a replaced workspace',async()=>{let resolve:(value:unknown)=>void=()=>{};f.status.mockResolvedValue(status('installation_recorded'));f.validate.mockReturnValue(new Promise(r=>{resolve=r;}));await show();fireEvent.click(await screen.findByRole('button',{name:'Finish connection'}));await waitFor(()=>expect(f.validate).toHaveBeenCalledOnce());f.status.mockResolvedValue(status());await act(async()=>{f.context={replacement:true};for(const listener of f.listeners)listener();});await act(async()=>{resolve({ok:true});});expect(screen.queryByText('GitHub read-only access is verified for this workspace.')).toBeNull();});
it('recovers validation controls after an unexpected transport rejection',async()=>{f.status.mockResolvedValue(status('installation_recorded'));f.validate.mockRejectedValue(new Error('private provider details'));await show();fireEvent.click(await screen.findByRole('button',{name:'Finish connection'}));await screen.findByText('GitHub could not complete a read-only validation. Review the App installation and try again.');expect((screen.getByRole('button',{name:'Finish connection'})as HTMLButtonElement).disabled).toBe(false);expect(screen.queryByText('private provider details')).toBeNull();});
it('refuses credential-bearing provider consent URLs',async()=>{f.start.mockResolvedValue({ok:true,data:{consentUrl:'https://untrusted-user@github.com/apps/fixture'}});await show();fireEvent.click(await screen.findByRole('button',{name:'Connect ↗'}));await screen.findByText('The secure connection could not be started. Confirm this provider is configured for the workspace and try again.');expect(open).not.toHaveBeenCalled();});

it('bounds a refresh whose transport never settles and allows an explicit retry',async()=>{vi.useFakeTimers();f.status.mockReturnValueOnce(new Promise(()=>{}));render(createElement(SettingsView,{identity:{}as never}));fireEvent.click(screen.getByRole('button',{name:'Integrations'}));await act(async()=>{await vi.advanceTimersByTimeAsync(0);});await act(async()=>{await vi.advanceTimersByTimeAsync(15001);});expect(screen.getByText('Connection status could not be verified. Try refreshing.')).toBeTruthy();expect((screen.getByRole('button',{name:'Refresh verified status'})as HTMLButtonElement).disabled).toBe(false);});
it('shows read-only cloud scope and operable diagnostics without starting provider authorization',async()=>{
 await show();expect(screen.getByText(/Cloud connections are read-only/)).toBeTruthy();const diagnostics=screen.getByRole('button',{name:'Connection diagnostics'});
 expect(diagnostics.getAttribute('aria-expanded')).toBe('false');
 
 fireEvent.click(diagnostics);expect(diagnostics.getAttribute('aria-expanded')).toBe('true');
 fireEvent.click(diagnostics);expect(diagnostics.getAttribute('aria-expanded')).toBe('false');
 expect(f.start).not.toHaveBeenCalled();expect(f.validate).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();
});
it('keeps unavailable providers out of operator setup guides and does not start authorization',async()=>{
 await show();
 const slack=await screen.findByRole('button',{name:'Connect slack'});
 expect((slack as HTMLButtonElement).disabled).toBe(true);
 expect(screen.queryByRole('button',{name:'Setup guide ↗'})).toBeNull();
 fireEvent.click(slack);expect(f.start).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();
});
