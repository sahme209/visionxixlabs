/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';

const ports=vi.hoisted(()=>({invoke:vi.fn(),open:vi.fn(),write:vi.fn()}));
vi.mock('@tauri-apps/api/core',()=>({invoke:ports.invoke}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:ports.open}));
vi.mock('../../../desktop/src/lib/preferences',()=>({readDesktopPreferences:async()=>({theme:'dark',interface_density:'comfortable',notifications_enabled:false}),writeDesktopPreferences:ports.write}));
import {SettingsView} from '../../../desktop/src/views/SettingsView';
const show=()=>render(createElement(SettingsView,{identity:{organizationId:'ws_internal_version_fixture',capabilities:[]} as never}));
beforeEach(()=>{vi.clearAllMocks();ports.invoke.mockImplementation(async(command:string)=>{if(command==='plugin:app|version')return '7.8.9';throw Error('unexpected_native_read')});ports.open.mockResolvedValue(undefined)});
afterEach(()=>cleanup());

it('reports the installed native version, not the source candidate, without opening or writing anything',async()=>{
  show();
  await screen.findByText('7.8.9');
  expect(screen.getByText('Installed version')).toBeTruthy();
  expect(screen.queryByText('0.1.23')).toBeNull();
  expect(ports.invoke).toHaveBeenCalledExactlyOnceWith('plugin:app|version');
  expect(ports.open).not.toHaveBeenCalled();expect(ports.write).not.toHaveBeenCalled();
  expect(screen.getByText(/Website deployments do not replace this installed app/)).toBeTruthy();
});

it('keeps release review an explicit fixed browser handoff, with no update or installation action',async()=>{
  show();await screen.findByText('7.8.9');
  fireEvent.click(screen.getByRole('button',{name:'Review releases'}));
  await waitFor(()=>expect(ports.open).toHaveBeenCalledExactlyOnceWith('https://visionxixlabs.com/download'));
  expect(ports.invoke.mock.calls.map(c=>c[0])).toEqual(['plugin:app|version']);
  expect(ports.write).not.toHaveBeenCalled();
});

it('shows unavailable on native read failure without exposing raw details or a guessed version',async()=>{
  ports.invoke.mockRejectedValue(new Error('private native detail'));
  show();await screen.findByText('Unavailable');
  expect(screen.queryByText('private native detail')).toBeNull();
  expect(screen.queryByText('0.1.23')).toBeNull();
});

it('reports a failed browser handoff without exposing raw native details',async()=>{
  ports.open.mockRejectedValue(new Error('private browser diagnostic'));
  show();await screen.findByText('7.8.9');
  fireEvent.click(screen.getByRole('button',{name:'Review releases'}));
  await screen.findByText('The download page could not be opened. Visit visionxixlabs.com/download in your browser.');
  expect(screen.queryByText('private browser diagnostic')).toBeNull();
  expect(screen.getByText('7.8.9')).toBeTruthy();
  expect(ports.write).not.toHaveBeenCalled();
});

for(const value of ['', ' 7.8.9 ', 'https://private.example/token', '1'.repeat(100), {version:'7.8.9'}])
it('refuses malformed native version metadata without replacing it with source metadata',async()=>{
  ports.invoke.mockResolvedValue(value);
  show();await screen.findByText('Unavailable');
  expect(screen.queryByText('0.1.23')).toBeNull();
});

it('includes native prerelease/build metadata when present',async()=>{
  ports.invoke.mockResolvedValue('7.8.9-beta.2+build.4');
  show();await screen.findByText('7.8.9-beta.2+build.4');
});

it('ignores a late version result from a General section that was left and reopened',async()=>{
  let finish!:(version:string)=>void;
  ports.invoke.mockReturnValueOnce(new Promise<string>(resolve=>{finish=resolve}));
  show();await waitFor(()=>expect(ports.invoke).toHaveBeenCalledOnce());
  expect(screen.getByText('Checking…')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Appearance'}));
  fireEvent.click(screen.getByRole('button',{name:'General'}));
  await screen.findByText('7.8.9');
  await act(async()=>{finish('1.2.3')});
  expect(screen.queryByText('1.2.3')).toBeNull();expect(screen.getByText('7.8.9')).toBeTruthy();
  expect(ports.open).not.toHaveBeenCalled();expect(ports.write).not.toHaveBeenCalled();
});

it('finds General using the installed version keywords without changing preferences',async()=>{
  show();await screen.findByText('7.8.9');
  fireEvent.change(screen.getByRole('searchbox',{name:'Search settings'}),{target:{value:'version'}});
  expect(screen.getByRole('button',{name:'General'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Models'})).toBeNull();
  expect(ports.write).not.toHaveBeenCalled();
});

it('compares the installed version with the latest published release without downloading anything',async()=>{
  const {desktopClient}=await import('../../../desktop/src/lib/desktopClient');
  const manifest=vi.spyOn(desktopClient,'releaseManifest').mockResolvedValue({ok:true,data:{source:'github_release',tag:'desktop-v8.0.0',assets:{}}} as never);
  show();await screen.findByText('7.8.9');
  expect(await screen.findByText('8.0.0 available')).toBeTruthy();
  expect(ports.open).not.toHaveBeenCalled();expect(ports.write).not.toHaveBeenCalled();
  manifest.mockRestore();
});
