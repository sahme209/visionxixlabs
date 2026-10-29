// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {render,screen,within,cleanup,fireEvent} from '@testing-library/react';
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
import {Sidebar} from '../../desktop/src/components/Sidebar';
import {applyDesktopPreferences,type DesktopPreferences} from '../../desktop/src/lib/preferences';
afterEach(()=>{cleanup();vi.unstubAllGlobals();delete document.documentElement.dataset.theme;});
it('keeps workspace, resources and bottom destinations separate without losing routes',()=>{
 const go=vi.fn();render(createElement(Sidebar,{activeView:'agent',onNavigate:go}));
 const workspace=screen.getByRole('button',{name:'Workspace'});const resources=screen.getByRole('button',{name:'Resources'});
 const panel=(b:HTMLElement)=>document.getElementById(b.getAttribute('aria-controls')!)!;
 expect(within(panel(workspace)).getAllByRole('button').map(x=>x.textContent)).toEqual(['Agent','Axiom Bot','Releases']);
 expect(within(panel(resources)).getAllByRole('button').map(x=>x.textContent)).toEqual(['Repositories','Batches','Plugins & Skills']);
 const utility=screen.getByRole('navigation',{name:'Workspace utilities'});
 expect(within(utility).getAllByRole('button').map(x=>x.textContent)).toEqual(['Documentation','Settings']);
 fireEvent.click(screen.getByRole('button',{name:'Batches'}));expect(go).toHaveBeenCalledWith('airflow-automation');
 fireEvent.click(workspace);expect(screen.queryByRole('button',{name:'Agent'})).toBeNull();expect(screen.getByRole('button',{name:'Settings'})).toBeTruthy();
});
it('applies explicit light and dark themes without changing their saved meaning',()=>{
 const base={interface_density:'comfortable',reduce_motion:false,high_contrast:false};
 applyDesktopPreferences({...base,theme:'light'} as DesktopPreferences);expect(document.documentElement.dataset.theme).toBe('light');
 applyDesktopPreferences({...base,theme:'dark'} as DesktopPreferences);expect(document.documentElement.dataset.theme).toBe('dark');
});
it('follows system theme changes only while system is selected and removes obsolete listeners',()=>{
 let listener:((e:{matches:boolean})=>void)|undefined;const remove=vi.fn();
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:(_n:string,fn:typeof listener)=>{listener=fn;},removeEventListener:remove}));
 const base={interface_density:'comfortable',reduce_motion:false,high_contrast:false};
 applyDesktopPreferences({...base,theme:'system'} as unknown as DesktopPreferences);expect(document.documentElement.dataset.theme).toBe('light');
 listener?.({matches:true});expect(document.documentElement.dataset.theme).toBe('dark');
 applyDesktopPreferences({...base,theme:'light'} as DesktopPreferences);expect(remove).toHaveBeenCalled();
 listener?.({matches:true});expect(document.documentElement.dataset.theme).toBe('light');
});
