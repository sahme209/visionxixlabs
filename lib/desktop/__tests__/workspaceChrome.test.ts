/** @vitest-environment jsdom */
import {createElement as h} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {TopBar} from '../../../desktop/src/components/TopBar';
import type {VerifiedDesktopIdentity} from '../../../desktop/src/lib/desktopClient';
afterEach(cleanup);
const identity={kind:'desktop_session',organizationId:'workspace-exact-id',capabilities:[],access:{allowed:true}} as VerifiedDesktopIdentity;
it('keeps the exact verified workspace available without placing its technical ID in the main toolbar',()=>{
 const view=render(h(TopBar,{activeView:'agent',identity}));
 const summary=screen.getByLabelText('Workspace access: active');
 expect(summary.textContent).toContain('Access active');expect(summary.getAttribute('title')).toContain(identity.organizationId);
 const details=view.container.querySelector('details')!;expect(details.open).toBe(false);
 expect(details.textContent).toContain(identity.organizationId);expect(details.textContent).toContain('Paired desktop session');
});
it('does not show active access for a refused identity',()=>{
 render(h(TopBar,{activeView:'agent',identity:{...identity,access:{...identity.access,allowed:false}}}));
 expect(screen.getByLabelText('Workspace access: needs attention').textContent).toContain('Access needs attention');
 expect(screen.queryByText('Access active')).toBeNull();
});
it('closes workspace details with Escape and when navigating, preserving the current exact identity',()=>{
 const view=render(h(TopBar,{activeView:'agent',identity}));let details=view.container.querySelector('details')!;details.open=true;
 fireEvent.keyDown(details,{key:'Escape'});expect(details.open).toBe(false);
 details.open=true;view.rerender(h(TopBar,{activeView:'plugins-skills',identity}));expect(details.open).toBe(false);
});
it('keeps navigation actions explicit and closes details before opening commands',()=>{
 const commands=vi.fn(),split=vi.fn();const view=render(h(TopBar,{activeView:'agent',identity,onOpenCommands:commands,onToggleSplit:split}));
 expect(commands).not.toHaveBeenCalled();expect(split).not.toHaveBeenCalled();
 const details=view.container.querySelector('details')!;details.open=true;fireEvent.click(screen.getByRole('button',{name:'Commands'}));
 expect(commands).toHaveBeenCalledOnce();expect(details.open).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Editor & Agent'}));expect(split).toHaveBeenCalledOnce();
});
