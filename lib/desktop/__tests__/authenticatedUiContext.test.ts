/** @vitest-environment jsdom */
import {createElement} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({config:{sessionToken:'synthetic-A',apiBase:'https://example.invalid/A'} as {sessionToken:string|undefined;apiBase:string},revision:0,listeners:new Set<()=>void>(),verify:vi.fn(),write:vi.fn(),clear:vi.fn(),read:vi.fn(),cleanupError:vi.fn()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.config},getContextRevision:()=>m.revision,subscribeContext:(f:()=>void)=>{m.listeners.add(f);return()=>{m.listeners.delete(f)}},hasAuth:()=>Boolean(m.config.sessionToken),verifyCurrentCredential:m.verify,setSession:(token:string|undefined)=>{const changed=m.config.sessionToken!==token;m.config={...m.config,sessionToken:token};if(changed){m.revision++;for(const f of [...m.listeners])f()}}}}));
vi.mock('../../../desktop/src/lib/secureStorage',()=>({writeSecret:m.write,clearSecret:m.clear,readSecret:m.read}));
vi.mock('../../../desktop/src/lib/preferences',()=>({readDesktopPreferences:async()=>({})}));
vi.mock('../../../desktop/src/lib/useNativeMenuActions',()=>({useNativeMenuActions:()=>{}}));
vi.mock('../../../desktop/src/components/Sidebar',()=>({Sidebar:({onNavigate}:any)=>createElement('nav',null,'Authenticated navigation',createElement('button',{onClick:()=>onNavigate('settings')},'Open settings fixture'))}));
vi.mock('../../../desktop/src/components/TopBar',()=>({TopBar:({identity}:any)=>createElement('p',null,'Verified identity '+identity.userId)}));
vi.mock('../../../desktop/src/components/WorkspaceCommands',()=>({WorkspaceCommands:()=>null}));
vi.mock('../../../desktop/src/components/WorkspaceViewBoundary',()=>({WorkspaceViewBoundary:({children}:any)=>children}));
vi.mock('../../../desktop/src/views/WelcomeView',()=>({WelcomeView:()=>createElement('p',null,'Workspace mounted')}));
vi.mock('../../../desktop/src/views/AgentChatView',()=>({AgentChatView:()=>null}));
vi.mock('../../../desktop/src/views/AxiomBotView',()=>({AxiomBotView:()=>null}));
vi.mock('../../../desktop/src/views/DeploymentRequestsWorkspace',()=>({DeploymentRequestsWorkspace:()=>null}));
vi.mock('../../../desktop/src/views/DocsView',()=>({DocsView:()=>null}));
vi.mock('../../../desktop/src/views/SettingsView',()=>({SettingsView:({onSignOut}:any)=>createElement('button',{onClick:()=>void(onSignOut?onSignOut():signOutDesktopCredentials()).catch(m.cleanupError)},'Sign out fixture')}));
vi.mock('../../../desktop/src/views/PluginsSkillsView',()=>({PluginsSkillsView:()=>null}));
vi.mock('../../../desktop/src/views/RepositoryWorkspaceView',()=>({RepositoryWorkspaceView:()=>null}));
vi.mock('../../../desktop/src/views/AirflowAutomationView',()=>({AirflowAutomationView:()=>null}));
vi.mock('../../../desktop/src/views/DesktopSignInView',()=>({DesktopSignInView:({initialError,canRetrySavedSignIn,onSignedIn}:any)=>createElement('section',null,createElement('p',null,'Sign-in surface'),createElement('p',null,initialError),createElement('p',null,canRetrySavedSignIn?'Saved recovery available':'No saved retry'),createElement('button',{onClick:()=>onSignedIn(identity('recovered'))},'Accept verified recovery fixture'))}));
import App from '../../../desktop/src/App';
import {signOutDesktopCredentials} from '../../../desktop/src/lib/activeDesktopCredential';
function identity(userId:string,allowed=true){return {kind:'desktop_session',organizationId:'synthetic-org',userId,role:'admin',capabilities:['workspace:read'],access:{allowed,title:'Workspace access required',message:'Synthetic access message',billingStatus:'inactive'}}}
function deferred(){let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>{resolve=r});return {promise,resolve}}
function replace(patch:Partial<typeof m.config>){m.config={...m.config,...patch};m.revision++;for(const f of [...m.listeners])f()}
async function start(){render(createElement(App));await screen.findByText('Verified identity A')}
beforeEach(()=>{vi.resetAllMocks();m.config={sessionToken:'synthetic-A',apiBase:'https://example.invalid/A'};m.revision=0;m.listeners.clear();m.verify.mockResolvedValue({ok:true,data:identity('A')});m.write.mockResolvedValue(undefined);m.clear.mockResolvedValue(undefined)});
afterEach(cleanup);
it.each(['vault-write','legacy-cleanup'])('removes accepted workspace without focus when real signout locks transport then %s fails',async failure=>{
 await start();if(failure==='vault-write')m.write.mockRejectedValue(new Error('Synthetic vault unavailable'));else m.clear.mockRejectedValue(new Error('Synthetic cleanup unavailable'));
 fireEvent.click(screen.getByText('Open settings fixture'));fireEvent.click(screen.getByText('Sign out fixture'));await screen.findByText(/Sign-out could not be saved|Sign-out is saved/);
 expect(screen.queryByText('Authenticated navigation')).toBeNull();expect(screen.queryByText('Sign-in surface')).toBeNull();expect(m.config.sessionToken).toBeUndefined();expect(m.verify).toHaveBeenCalledTimes(1);
});
it.each(['sessionToken','apiBase'] as const)('withholds old identity on %s replacement until current verification',async key=>{
 await start();const b=deferred();m.verify.mockReturnValueOnce(b.promise);act(()=>replace({[key]:'synthetic-B'}));
 expect(screen.queryByText('Verified identity A')).toBeNull();expect(screen.queryByText('Authenticated navigation')).toBeNull();await waitFor(()=>expect(m.verify).toHaveBeenCalledTimes(2));
 await act(async()=>b.resolve({ok:true,data:identity('B')}));await screen.findByText('Verified identity B');expect(m.write).not.toHaveBeenCalled();
});
it('ignores pending old identity after two replacements, accepting only current config',async()=>{
 await start();const b=deferred(),c=deferred();m.verify.mockReturnValueOnce(b.promise).mockReturnValueOnce(c.promise);act(()=>replace({sessionToken:'synthetic-B'}));await waitFor(()=>expect(m.verify).toHaveBeenCalledTimes(2));act(()=>replace({sessionToken:'synthetic-C'}));await waitFor(()=>expect(m.verify).toHaveBeenCalledTimes(3));
 await act(async()=>b.resolve({ok:true,data:identity('B')}));expect(screen.queryByText('Verified identity B')).toBeNull();await act(async()=>c.resolve({ok:true,data:identity('C')}));await screen.findByText('Verified identity C');
});
it('retains accepted identity without verification for ordinary revision-only notification',async()=>{
 await start();act(()=>{m.revision++;for(const f of [...m.listeners])f()});expect(screen.getByText('Verified identity A')).toBeTruthy();expect(m.verify).toHaveBeenCalledTimes(1);
});
it('retains unavailable recovery classification without credential deletion or verification loop',async()=>{
 await start();m.verify.mockResolvedValueOnce({ok:false,failureKind:'unavailable',error:'Synthetic service unavailable'});act(()=>replace({sessionToken:'synthetic-B'}));await screen.findByText('Saved recovery available');expect(screen.getByText('Synthetic service unavailable')).toBeTruthy();expect(m.config.sessionToken).toBeUndefined();expect(m.verify).toHaveBeenCalledTimes(2);expect(m.write).not.toHaveBeenCalled();expect(m.clear).not.toHaveBeenCalled();
});
it('keeps current access-required response outside workspace and handles real signout failure there',async()=>{
 m.verify.mockResolvedValueOnce({ok:true,data:identity('restricted',false)});render(createElement(App));await screen.findByText('Workspace access required');expect(screen.queryByText('Authenticated navigation')).toBeNull();m.write.mockRejectedValueOnce(new Error('Synthetic vault failure'));fireEvent.click(screen.getByText('Use another account'));await screen.findByText(/Sign-out could not be saved completely/);expect(screen.queryByText('Sign-in surface')).toBeNull();
});
it('missing credential uses signin and explicit verified recovery owns current config without duplicate verification',async()=>{
 m.config={...m.config,sessionToken:undefined};render(createElement(App));await screen.findByText('Sign-in surface');expect(m.verify).not.toHaveBeenCalled();act(()=>{m.config={...m.config,sessionToken:'synthetic-recovered'}});fireEvent.click(screen.getByText('Accept verified recovery fixture'));await screen.findByText('Verified identity recovered');expect(m.verify).not.toHaveBeenCalled();
});

it.each(['success','failure'])('ignores late old signout %s after a new configuration verifies',async outcome=>{
 await start();const pending=deferred();m.write.mockImplementationOnce(()=>pending.promise.then(()=>{if(outcome==='failure')throw new Error('Synthetic old failure')}));
 fireEvent.click(screen.getByText('Open settings fixture'));fireEvent.click(screen.getByText('Sign out fixture'));expect(screen.queryByText('Sign-in surface')).toBeNull();expect(screen.queryByText('Authenticated navigation')).toBeNull();
 m.verify.mockResolvedValueOnce({ok:true,data:identity('B')});act(()=>replace({sessionToken:'synthetic-B'}));await screen.findByText('Verified identity B');const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
 await act(async()=>pending.resolve(undefined));expect(screen.getByText('Verified identity B')).toBeTruthy();expect(screen.queryByText(/Sign-out could not be saved completely/)).toBeNull();expect(errors).not.toHaveBeenCalled();errors.mockRestore();expect(m.verify).toHaveBeenCalledTimes(2);
});
it('successful access-required signout locks transport and clears saved selection once',async()=>{
 m.verify.mockResolvedValueOnce({ok:true,data:identity('restricted',false)});render(createElement(App));await screen.findByText('Workspace access required');fireEvent.click(screen.getByText('Use another account'));await screen.findByText('Sign-in surface');await waitFor(()=>expect(m.clear).toHaveBeenCalledTimes(3));expect(m.write).toHaveBeenCalledExactlyOnceWith('desktop.credential.selection.v1',{version:1,active:'signed_out'});expect(m.config.sessionToken).toBeUndefined();expect(m.verify).toHaveBeenCalledTimes(1);
});

it('manual cleanup retry is single-flight and refuses a retained stale button before context notification',async()=>{
 await start();m.write.mockRejectedValueOnce(new Error('Synthetic vault failure'));fireEvent.click(screen.getByText('Open settings fixture'));fireEvent.click(screen.getByText('Sign out fixture'));const retry=await screen.findByRole('button',{name:'Retry saved credential cleanup'});expect(m.write).toHaveBeenCalledTimes(1);
 // Extracting the retained React handler models the real pre-notification window.
 m.config={...m.config,sessionToken:'synthetic-B'};fireEvent.click(retry);expect(m.write).toHaveBeenCalledTimes(1);expect(m.config.sessionToken).toBe('synthetic-B');
 act(()=>{for(const f of [...m.listeners])f()});await screen.findByText('Verified identity A');expect(screen.queryByRole('button',{name:'Retry saved credential cleanup'})).toBeNull();
});
it('explicit cleanup retry retains missing transport, refuses burst duplicates and clears failure on success',async()=>{
 await start();m.write.mockRejectedValueOnce(new Error('Synthetic vault failure'));fireEvent.click(screen.getByText('Open settings fixture'));fireEvent.click(screen.getByText('Sign out fixture'));const retry=await screen.findByRole('button',{name:'Retry saved credential cleanup'});const pending=deferred();m.write.mockReturnValueOnce(pending.promise);
 act(()=>{fireEvent.click(retry);fireEvent.click(retry)});expect(m.write).toHaveBeenCalledTimes(2);expect(m.config.sessionToken).toBeUndefined();expect(screen.queryByText('Sign-in surface')).toBeNull();await act(async()=>pending.resolve(undefined));await screen.findByText('Sign-in surface');expect(screen.queryByRole('button',{name:'Retry saved credential cleanup'})).toBeNull();expect(screen.queryByText(/saved sign-in details may remain on this device/)).toBeNull();expect(m.clear).toHaveBeenCalledTimes(3);
});

it('refuses retained old workspace signout before replacement context notification',async()=>{
 await start();fireEvent.click(screen.getByText('Open settings fixture'));const stale=screen.getByText('Sign out fixture');m.config={...m.config,sessionToken:'synthetic-B'};fireEvent.click(stale);expect(m.config.sessionToken).toBe('synthetic-B');expect(m.write).not.toHaveBeenCalled();expect(m.clear).not.toHaveBeenCalled();act(()=>{for(const f of [...m.listeners])f()});
});
it('unmounts all normal signin during failed cleanup and pending retry, restoring it only after cleanup succeeds',async()=>{
 await start();m.write.mockRejectedValueOnce(new Error('Synthetic vault failure'));fireEvent.click(screen.getByText('Open settings fixture'));fireEvent.click(screen.getByText('Sign out fixture'));
 const retry=await screen.findByRole('button',{name:'Retry saved credential cleanup'});expect(screen.queryByText('Sign-in surface')).toBeNull();expect(screen.queryByRole('button',{name:'Accept verified recovery fixture'})).toBeNull();expect(screen.getByText(/saved sign-in details may remain on this device/)).toBeTruthy();
 const held=deferred();m.write.mockReturnValueOnce(held.promise);fireEvent.click(retry);expect(screen.queryByText('Sign-in surface')).toBeNull();expect(screen.queryByRole('button',{name:'Accept verified recovery fixture'})).toBeNull();await act(async()=>held.resolve(undefined));await screen.findByText('Sign-in surface');expect(screen.getByRole('button',{name:'Accept verified recovery fixture'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Retry saved credential cleanup'})).toBeNull();
});
