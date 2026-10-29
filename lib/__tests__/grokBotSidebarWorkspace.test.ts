// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {createElement,useState} from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
const m=vi.hoisted(()=>({config:{sessionToken:'axm.desk.synthetic'},identity:{kind:'desktop_session',organizationId:'tenant',email:'verified@example.invalid',access:{allowed:true},capabilities:[]},revision:1,verify:vi.fn()}));
vi.mock('../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.config;},getContextRevision:()=>m.revision,subscribeContext:()=>()=>{},listSavedBotTasks:async()=>({ok:true,data:{tasks:[],nextCursor:null}}),hasAuth:()=>true}}));
vi.mock('../../desktop/src/lib/credentialVerificationCoordinator',()=>({createCredentialVerificationCoordinator:(o:{onVerified:(v:unknown)=>void})=>({verify:async()=>{m.verify();o.onVerified(m.identity);},dispose:()=>{},invalidate:()=>{}})}));
vi.mock('../../desktop/src/lib/preferences',()=>({readDesktopPreferences:async()=>({})}));
vi.mock('../../desktop/src/lib/useNativeMenuActions',()=>({useNativeMenuActions:()=>{}}));
vi.mock('../../desktop/src/components/WorkspaceCommands',()=>({WorkspaceCommands:()=>null}));
vi.mock('../../desktop/src/views/AgentChatView',()=>({AgentChatView:({active}:{active:boolean})=>{const[value,setValue]=useState('');return createElement('label',{},'Chat draft',createElement('input',{'aria-label':'Chat draft',value,onChange:(e:{target:{value:string}})=>setValue(e.target.value)}),createElement('span',{'data-testid':'chat-active'},String(active)));}}));
vi.mock('../../desktop/src/views/DeploymentRequestsView',()=>({DeploymentRequestsView:()=>null}));
vi.mock('../../desktop/src/views/DocsView',()=>({DocsView:()=>null}));
vi.mock('../../desktop/src/views/SettingsView',()=>({SettingsView:({initialSection,onClose}:{initialSection?:string;onClose:()=>void})=>createElement('section',{},createElement('output',{'data-testid':'settings-section'},initialSection??'general'),createElement('button',{onClick:onClose},'Return from settings'))}));
vi.mock('../../desktop/src/views/PluginsSkillsView',()=>({PluginsSkillsView:({onOpenSettings}:{onOpenSettings:()=>void})=>createElement('button',{onClick:onOpenSettings},'Connection settings')}));
vi.mock('../../desktop/src/views/RepositoryWorkspaceView',()=>({RepositoryWorkspaceView:()=>null}));
vi.mock('../../desktop/src/views/AirflowAutomationView',()=>({AirflowAutomationView:()=>null}));
vi.mock('../../desktop/src/views/DesktopSignInView',()=>({DesktopSignInView:()=>null}));
vi.mock('../../desktop/src/views/DesktopAccessRequiredView',()=>({DesktopAccessRequiredView:()=>null}));
import App from '../../desktop/src/App';
afterEach(cleanup);
it('opens the distinct sidebar workspace between Agent and Releases and retains both local drafts without reinitializing Chat',async()=>{
 render(createElement(App));fireEvent.click(await screen.findByRole('button',{name:/Build with AI/}));await screen.findByLabelText('Chat draft');fireEvent.change(screen.getByLabelText('Chat draft'),{target:{value:'Retained Agent draft'}});
 const agent=screen.getByRole('button',{name:'Agent'}),bot=screen.getByRole('button',{name:'Axiom Bot'}),releases=screen.getByRole('button',{name:'Releases'});
 expect(agent.compareDocumentPosition(bot)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(bot.compareDocumentPosition(releases)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 fireEvent.click(bot);await screen.findByLabelText('Bot task title');expect(screen.getByTestId('chat-active').textContent).toBe('false');expect(screen.queryByRole('textbox',{name:'Chat draft'})).toBeNull();
 fireEvent.change(screen.getByLabelText('Bot task title'),{target:{value:'Retained Bot draft'}});fireEvent.click(agent);expect(screen.getByTestId('chat-active').textContent).toBe('true');expect((screen.getByLabelText('Chat draft') as HTMLInputElement).value).toBe('Retained Agent draft');
 fireEvent.click(bot);expect((screen.getByLabelText('Bot task title') as HTMLInputElement).value).toBe('Retained Bot draft');expect(screen.queryByRole('navigation',{name:'Agent capability'})).toBeNull();
});

it('opens connection management from the catalogue and returns to the same workspace',async()=>{
 render(createElement(App));await screen.findByRole('button',{name:/Build with AI/});fireEvent.click(screen.getByRole('button',{name:'Plugins & Skills'}));
 fireEvent.click(await screen.findByRole('button',{name:'Connection settings'}));expect(screen.getByTestId('settings-section').textContent).toBe('integrations');
 fireEvent.click(screen.getByRole('button',{name:'Return from settings'}));expect(screen.getByRole('button',{name:'Connection settings'})).toBeTruthy();expect(screen.queryByTestId('settings-section')).toBeNull();
});
