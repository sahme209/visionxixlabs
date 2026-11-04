/** @vitest-environment jsdom */
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WorkspaceCommands} from '../../../desktop/src/components/WorkspaceCommands';
afterEach(cleanup);
it('opens from the keyboard and navigates only to a searchable known destination',()=>{const navigate=vi.fn(),change=vi.fn();render(createElement(WorkspaceCommands,{open:false,onOpenChange:change,onNavigate:navigate}));fireEvent.keyDown(window,{key:'p',metaKey:true,shiftKey:true});expect(change).toHaveBeenCalledWith(true);expect(navigate).not.toHaveBeenCalled();});
it('filters destinations and executes the selected result with Enter',()=>{const navigate=vi.fn(),close=vi.fn();render(createElement(WorkspaceCommands,{open:true,onOpenChange:close,onNavigate:navigate}));fireEvent.change(screen.getByRole('combobox',{name:'Search desktop commands'}),{target:{value:'repository'}});expect(screen.getAllByRole('option')).toHaveLength(1);fireEvent.keyDown(screen.getByRole('combobox'),{key:'Enter'});expect(navigate).toHaveBeenCalledWith('repository-workspace');expect(close).toHaveBeenCalledWith(false);});
it('does not execute a hidden command when nothing matches and closes with Escape',()=>{const navigate=vi.fn(),close=vi.fn();render(createElement(WorkspaceCommands,{open:true,onOpenChange:close,onNavigate:navigate}));fireEvent.change(screen.getByRole('combobox'),{target:{value:'delete production'}});fireEvent.keyDown(screen.getByRole('combobox'),{key:'Enter'});expect(navigate).not.toHaveBeenCalled();expect(screen.getByText('No matching commands.')).toBeTruthy();fireEvent.keyDown(screen.getByRole('combobox'),{key:'Escape'});expect(close).toHaveBeenCalledWith(false);});
it('moves the selection with arrow keys and preserves normal typing outside the shortcut',()=>{const close=vi.fn(),navigate=vi.fn();render(createElement(WorkspaceCommands,{open:true,onOpenChange:close,onNavigate:navigate}));const field=screen.getByRole('combobox');fireEvent.keyDown(field,{key:'ArrowDown'});fireEvent.keyDown(field,{key:'Enter'});expect(navigate).toHaveBeenCalledWith('repository-workspace');});
it('lets the close button activate with Enter without running a destination',()=>{const navigate=vi.fn(),close=vi.fn();render(createElement(WorkspaceCommands,{open:true,onOpenChange:close,onNavigate:navigate}));fireEvent.keyDown(screen.getByRole('button',{name:'Close commands'}),{key:'Enter'});expect(navigate).not.toHaveBeenCalled();});

it('opens Axiom Bot from its searchable destination without running a task',()=>{const navigate=vi.fn(),close=vi.fn();render(createElement(WorkspaceCommands,{open:true,onOpenChange:close,onNavigate:navigate}));fireEvent.change(screen.getByRole('combobox'),{target:{value:'bot'}});expect(screen.getByRole('option',{name:'Open Axiom Bot'})).toBeTruthy();fireEvent.keyDown(screen.getByRole('combobox'),{key:'Enter'});expect(navigate).toHaveBeenCalledExactlyOnceWith('axiom-bot');expect(close).toHaveBeenCalledWith(false);});

it('finds the existing Apps and skills workspace using connection names without connecting or executing',()=>{
 const navigate=vi.fn(),close=vi.fn();render(createElement(WorkspaceCommands,{open:true,onOpenChange:close,onNavigate:navigate}));
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'Outlook'}});
 expect(screen.getByRole('option',{name:'Open Apps & skills'})).toBeTruthy();expect(screen.getByText('Connections and reusable skills')).toBeTruthy();expect(navigate).not.toHaveBeenCalled();
 fireEvent.keyDown(screen.getByRole('combobox'),{key:'Enter'});expect(navigate).toHaveBeenCalledExactlyOnceWith('plugins-skills');
});
it.each(['Enter','Escape','ArrowDown','ArrowUp','Home','End'].flatMap(key=>[{key,isComposing:true},{key,keyCode:229}]))('preserves command search, selection and focus during composition (%j)',({key,...signal})=>{
 const navigate=vi.fn(),close=vi.fn();render(createElement(WorkspaceCommands,{open:true,onOpenChange:close,onNavigate:navigate}));
 const field=screen.getByRole('combobox',{name:'Search desktop commands'});fireEvent.change(field,{target:{value:'Open'}});field.focus();
 const selected=field.getAttribute('aria-activedescendant'),event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...signal});fireEvent(field,event);
 expect(event.defaultPrevented).toBe(false);expect(navigate).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();expect(field).toHaveProperty('value','Open');expect(field.getAttribute('aria-activedescendant')).toBe(selected);expect(document.activeElement).toBe(field);
});
it.each([{isComposing:true},{keyCode:229}])('does not open or cancel the global command shortcut during composition (%j)',signal=>{
 const navigate=vi.fn(),change=vi.fn();render(createElement(WorkspaceCommands,{open:false,onOpenChange:change,onNavigate:navigate}));
 const event=new KeyboardEvent('keydown',{key:'p',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true,...signal});fireEvent(window,event);
 expect(event.defaultPrevented).toBe(false);expect(change).not.toHaveBeenCalled();expect(navigate).not.toHaveBeenCalled();
});
