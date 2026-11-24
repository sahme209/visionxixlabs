/** @vitest-environment jsdom */
import {createElement} from 'react';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';

const ports=vi.hoisted(()=>({native:vi.fn(),open:vi.fn(),vaultRead:vi.fn(),vaultWrite:vi.fn(),vaultClear:vi.fn()}));
vi.mock('@tauri-apps/api/core',()=>({invoke:ports.native}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:ports.open}));
vi.mock('../../../desktop/src/lib/secureStorage',()=>({readSecret:ports.vaultRead,writeSecret:ports.vaultWrite,clearSecret:ports.vaultClear}));
vi.mock('../../../desktop/src/lib/preferences',()=>({readDesktopPreferences:async()=>({theme:'dark',interface_density:'comfortable',reduce_motion:true}),writeDesktopPreferences:ports.native}));
vi.mock('../../../desktop/src/lib/useNativeMenuActions',()=>({useNativeMenuActions:()=>{}}));

import App from '../../../desktop/src/App';
import {desktopClient,type VerifiedDesktopIdentity} from '../../../desktop/src/lib/desktopClient';

const identity:VerifiedDesktopIdentity={kind:'desktop_session',userId:'synthetic-screen-reviewer',organizationId:'ws_internal_screen_coverage',role:'read_only',capabilities:['workspace:read','pipeline:read'],access:{allowed:true,code:'active',title:'Synthetic access',message:'Isolated component fixture only',planTier:'synthetic',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/plans'}};
const originalScrollTo=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollTo');
let accessAllowed=true;
let requests:Array<{method:string;path:string}>;
beforeEach(()=>{
 Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
 vi.clearAllMocks();requests=[];accessAllowed=true;window.localStorage.clear();
 ports.vaultRead.mockResolvedValue(undefined);
 ports.vaultWrite.mockRejectedValue(new Error('fixture_vault_write_forbidden'));
 ports.vaultClear.mockRejectedValue(new Error('fixture_vault_clear_forbidden'));
 ports.open.mockRejectedValue(new Error('fixture_external_open_forbidden'));
 ports.native.mockImplementation(async(command:string)=>{
  if(command==='plugin:app|version')return '7.8.9';
  if(command==='default_repos_directory')return '/synthetic/empty-repositories';
  if(command==='list_local_repositories')return [];
  throw Error('fixture_native_command_forbidden:'+command);
 });
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const method=(init?.method??(typeof Request!=='undefined'&&input instanceof Request?input.method:'GET')).toUpperCase();requests.push({method,path:url.pathname});
  if(url.origin!=='https://desktop-fixture.invalid')throw Error('fixture_unexpected_origin');
  if(method!=='GET'&&method!=='HEAD')throw Error('fixture_write_request_forbidden');
  if(url.pathname==='/api/desktop/access'){
   const access=accessAllowed?identity.access:{...identity.access,allowed:false,code:'production_access_required',title:'Workspace access required'};
   return new Response(JSON.stringify({ok:true,data:{identity:{...identity,access},access}}),{status:200});
  }
  return new Response(JSON.stringify({ok:false,error:'synthetic_service_unavailable'}),{status:503});
 }));
 desktopClient.setApiBase('https://desktop-fixture.invalid');
 desktopClient.setSession('axm.desk.synthetic-screen-fixture.not-a-real-signature');
});
afterEach(()=>{cleanup();desktopClient.setSession(undefined);vi.unstubAllGlobals();if(originalScrollTo)Object.defineProperty(HTMLElement.prototype,'scrollTo',originalScrollTo);else delete (HTMLElement.prototype as {scrollTo?:unknown}).scrollTo;});

it('keeps all ten customer screens navigable when data services are unavailable, without dispatching writes',async()=>{
 const view=render(createElement(App));
 const frames:Record<string,string>={};
 await screen.findByRole('form',{name:'Workspace planner'});
 const workspaceNav=screen.getByRole('navigation',{name:'V19 workspace'});
 const utilityNav=screen.getByRole('navigation',{name:'Workspace utilities'});
 const home=within(workspaceNav).getByRole('button',{name:'Home'});
 expect(home.getAttribute('aria-current')).toBe('page');
 expect(screen.getByLabelText('Workspace access: active')).toBeDefined();
 const workspaceSummary=screen.getByLabelText('Current workspace');
 const workspaceDetails=workspaceSummary.closest('details')!;
 fireEvent.click(workspaceSummary);
 expect(workspaceDetails.open).toBe(true);
 expect(within(workspaceDetails).getByText('Access verified')).toBeDefined();
 expect(within(workspaceDetails).getByText(identity.organizationId)).toBeDefined();
 fireEvent.keyDown(workspaceSummary,{key:'Escape'});
 expect(workspaceDetails.open).toBe(false);
 frames.welcome=view.container.innerHTML;
 for(const [label,frame] of [['Agent','agent'],['Saved Tasks','bot'],['Deployments','releases'],['Tickets','tickets'],['Repositories','repositories'],['Batches','batches'],['Apps & Skills','apps'],['Documentation','docs']] as const){
  const item=within(label==='Documentation'?utilityNav:workspaceNav).getByRole('button',{name:label});
  fireEvent.click(item);
  await screen.findAllByRole('heading',{name:label});
  await act(async()=>{});
  // Body landmarks and settled failure states cannot be satisfied by TopBar.
  if(label==='Agent')await screen.findByRole('button',{name:'Retry models'});
  if(label==='Saved Tasks')await screen.findByRole('region',{name:'V19 Bot workspace'});
  if(label==='Deployments')await screen.findByText('Something went wrong loading your requests. Please try again.');
  if(label==='Tickets')await screen.findByText('Ticket records could not be verified. Refresh to try again.');
  if(label==='Repositories'){
   await screen.findByText('Repository directory is unavailable. Refresh to try again.');
   fireEvent.click(screen.getByRole('button',{name:'Open local editor'}));
   await screen.findByRole('textbox',{name:'Local repositories folder'});
   fireEvent.click(screen.getByRole('button',{name:'Back to repository directory'}));
  }
  if(label==='Batches'){
   await screen.findByRole('heading',{name:'Airflow connection status unavailable'});
   expect(screen.getByRole('button',{name:'Retry connection status'})).toBeDefined();
   expect(screen.queryByText('Approvals and audit always on')).toBeNull();
   expect(screen.getByText('Review actions before running')).toBeDefined();
  }
  if(label==='Apps & Skills'){
   const search=await screen.findByRole('searchbox',{name:'Search apps and skills'});
   fireEvent.change(search,{target:{value:'synthetic-no-match'}});
   expect((search as HTMLInputElement).value).toBe('synthetic-no-match');
   fireEvent.change(search,{target:{value:''}});
  }
  if(label==='Documentation')await screen.findByRole('article',{name:'Release governance'});
  expect(screen.queryByText('This view could not be displayed')).toBeNull();
  expect(item.getAttribute('aria-current')).toBe('page');
  frames[frame]=view.container.innerHTML;
  if(label==='Agent'){
   fireEvent.click(screen.getByLabelText('Workspace access: active'));
   expect(screen.getByText('Access active')).toBeDefined();
   fireEvent.click(screen.getByRole('button',{name:'Editor & Agent'}));
   await act(async()=>{});
   frames['split-editor']=view.container.innerHTML;
   fireEvent.click(screen.getByLabelText('Workspace access: active'));
   fireEvent.click(screen.getByRole('button',{name:'Single pane'}));
  }
 }
 const settings=within(utilityNav).getByRole('button',{name:'Settings'});
 fireEvent.click(settings);
 await screen.findAllByRole('heading',{name:'Settings'});
 expect(screen.getByRole('searchbox',{name:'Search settings'})).toBeDefined();
 expect(screen.getByRole('navigation',{name:'Settings sections'})).toBeDefined();
 expect(settings.getAttribute('aria-current')).toBe('page');
 frames.settings=view.container.innerHTML;
 expect(screen.queryByText('This view could not be displayed')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Back to workspace'}));
 await screen.findAllByRole('heading',{name:'Documentation'});
 fireEvent.click(home);
 await screen.findByRole('form',{name:'Workspace planner'});
 expect(home.getAttribute('aria-current')).toBe('page');
 await waitFor(()=>expect(requests.some(request=>request.path==='/api/desktop/access')).toBe(true));
 expect(requests.every(request=>request.method==='GET'||request.method==='HEAD')).toBe(true);
 expect(ports.native.mock.calls.every(([command])=>['default_repos_directory','list_local_repositories','plugin:app|version'].includes(command))).toBe(true);
 expect(ports.native.mock.calls.filter(([command])=>command==='plugin:app|version')).toHaveLength(1);
 expect(screen.queryByText('7.8.9')).toBeNull(); // Settings was closed again.
 expect(ports.open).not.toHaveBeenCalled();
 expect(ports.vaultWrite).not.toHaveBeenCalled();expect(ports.vaultClear).not.toHaveBeenCalled();
 if(process.env.AXIOM_WRITE_DESKTOP_SCREEN_STUDY==='1'){
  const directory=resolve(import.meta.dirname,'../../../work/desktop-exact-composition');
  mkdirSync(directory,{recursive:true});
  writeFileSync(resolve(directory,'SOURCE-MARKUP.json'),JSON.stringify({scope:'Actual App mounted with synthetic identity and denied network/native write ports. Static captured layouts, not installed/native/provider acceptance.',frames},null,2)+'\n',{mode:0o600});
 }
});

it('keeps private destinations unmounted when verified identity lacks workspace access',async()=>{
 accessAllowed=false;
 render(createElement(App));
 await screen.findByRole('heading',{name:'Workspace access required'});
 await act(async()=>{});
 expect(screen.queryByRole('navigation',{name:'V19 workspace'})).toBeNull();
 expect(screen.queryByLabelText('Current workspace')).toBeNull();
 expect(screen.queryByLabelText('Workspace access: active')).toBeNull();
 expect(screen.queryByRole('form',{name:'Workspace planner'})).toBeNull();
 expect(requests.length).toBeGreaterThan(0);
 expect(requests.every(request=>request.method==='GET'&&request.path==='/api/desktop/access')).toBe(true);
 expect(ports.native).not.toHaveBeenCalled();
 expect(ports.open).not.toHaveBeenCalled();
 expect(ports.vaultWrite).not.toHaveBeenCalled();
 expect(ports.vaultClear).not.toHaveBeenCalled();
});

it('reveals the selected destination after keyboard command navigation into a collapsed group',async()=>{
 render(createElement(App));
 await screen.findByRole('form',{name:'Workspace planner'});
 const navigation=within(screen.getByRole('navigation',{name:'V19 workspace'}));
 const resources=navigation.getByRole('button',{name:'Resources'});
 fireEvent.click(resources);
 expect(resources.getAttribute('aria-expanded')).toBe('false');
 expect(navigation.queryByRole('button',{name:'Repositories'})).toBeNull();
 const commands=screen.getByRole('button',{name:'Search or run a command'});
 commands.focus();
 fireEvent.keyDown(commands,{key:'k',ctrlKey:true});
 const field=await screen.findByRole('combobox',{name:'Search desktop commands'});
 expect(document.activeElement).toBe(field);
 fireEvent.keyDown(field,{key:'Escape'});
 expect(document.activeElement).toBe(commands);
 fireEvent.click(commands);
 fireEvent.change(screen.getByRole('combobox',{name:'Search desktop commands'}),{target:{value:'repositories'}});
 fireEvent.keyDown(screen.getByRole('combobox',{name:'Search desktop commands'}),{key:'Enter'});
 const active=await navigation.findByRole('button',{name:'Repositories'});
 expect(resources.getAttribute('aria-expanded')).toBe('true');
 expect(active.getAttribute('aria-current')).toBe('page');
 expect(screen.queryByRole('dialog',{name:'Desktop commands'})).toBeNull();
});
