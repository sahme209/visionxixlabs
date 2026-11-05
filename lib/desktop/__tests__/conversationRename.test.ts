/** @vitest-environment jsdom */
import {createElement} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rename:vi.fn(),read:vi.fn(),context:{}}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.context;},renameAgentConversation:m.rename,getAgentConversation:m.read}}));
import {useDismissibleDetails} from '../../../desktop/src/lib/useDismissibleDetails';
import {ConversationRename} from '../../../desktop/src/components/ConversationRename';
beforeEach(()=>{vi.resetAllMocks();m.context={};m.rename.mockResolvedValue({ok:true,data:{id:'one',title:'Release review'}});m.read.mockResolvedValue({ok:true,data:{id:'one',title:'Release review'}});});afterEach(cleanup);
it('renames the saved title without sending or replacing a chat draft',async()=>{const saved=vi.fn();render(createElement(ConversationRename,{id:'one',title:'Old',onRenamed:saved}));fireEvent.click(screen.getByRole('button',{name:'Rename chat'}));fireEvent.change(screen.getByRole('textbox',{name:'Conversation title'}),{target:{value:'Release review'}});fireEvent.click(screen.getByRole('button',{name:'Save title'}));await screen.findByText('Conversation title saved.');expect(m.rename).toHaveBeenCalledWith('one','Release review','Old');expect(saved).toHaveBeenCalledWith('one','Release review');});
it('discards a late mutation receipt after credential context replacement',async()=>{let finish!:(value:unknown)=>void;m.rename.mockReturnValue(new Promise(done=>{finish=done;}));const saved=vi.fn();render(createElement(ConversationRename,{id:'one',title:'Old',onRenamed:saved}));fireEvent.click(screen.getByRole('button',{name:'Rename chat'}));fireEvent.change(screen.getByRole('textbox',{name:'Conversation title'}),{target:{value:'Release review'}});fireEvent.click(screen.getByRole('button',{name:'Save title'}));m.context={};await act(async()=>finish({ok:true,data:{id:'one',title:'Release review'}}));expect(saved).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();});
it('refreshes after an uncertain rename and never replays the write',async()=>{m.rename.mockRejectedValue(new Error('PRIVATE_DIAGNOSTIC'));m.read.mockResolvedValue({ok:true,data:{id:'one',title:'Other title'}});const saved=vi.fn();render(createElement(ConversationRename,{id:'one',title:'Old',onRenamed:saved}));fireEvent.click(screen.getByRole('button',{name:'Rename chat'}));fireEvent.change(screen.getByRole('textbox',{name:'Conversation title'}),{target:{value:'Release review'}});fireEvent.click(screen.getByRole('button',{name:'Save title'}));await screen.findByText(/Title refreshed from the service/);expect(saved).toHaveBeenCalledWith('one','Other title');expect(m.rename).toHaveBeenCalledTimes(1);expect(screen.queryByText(/PRIVATE_DIAGNOSTIC/)).toBeNull();});

// Exercise the real rename input inside its real floating-menu keyboard hook.
function RenameMenu(){
 const menu=useDismissibleDetails();
 return createElement('details',{...menu},createElement('summary',null,'Chat options'),createElement(ConversationRename,{id:'one',title:'Old',onRenamed:vi.fn()}));
}
it.each([{isComposing:true},{keyCode:229}])('retains nested rename and menu on composing Escape (%j)',signal=>{
 const view=render(createElement(RenameMenu)),details=view.container.querySelector('details')!;details.open=true;
 fireEvent.click(screen.getByRole('button',{name:'Rename chat'}));
 const input=screen.getByRole('textbox',{name:'Conversation title'});fireEvent.change(input,{target:{value:'未確定 draft'}});input.focus();
 const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,...signal});fireEvent(input,event);
 expect(event.defaultPrevented).toBe(false);expect(details.open).toBe(true);expect(screen.getByRole('form',{name:'Rename conversation'})).toBeTruthy();
 expect(screen.getByRole('textbox',{name:'Conversation title'})).toBe(input);expect(input).toHaveProperty('value','未確定 draft');expect(document.activeElement).toBe(input);
 expect(m.rename).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();
});
it.each([{isComposing:true},{keyCode:229}])('cancels composing Enter default without rename or read (%j)',signal=>{
 const view=render(createElement(RenameMenu)),details=view.container.querySelector('details')!;details.open=true;
 fireEvent.click(screen.getByRole('button',{name:'Rename chat'}));const input=screen.getByRole('textbox',{name:'Conversation title'});
 fireEvent.change(input,{target:{value:'未確定 draft'}});input.focus();
 const event=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...signal});fireEvent(input,event);
 // jsdom does not synthesize implicit form submission; cancellation is the
 // browser-facing contract that prevents the composition key from submitting.
 expect(event.defaultPrevented).toBe(true);expect(details.open).toBe(true);expect(screen.getByRole('form',{name:'Rename conversation'})).toBeTruthy();expect(input).toHaveProperty('value','未確定 draft');expect(document.activeElement).toBe(input);
 expect(m.rename).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();
});
it('ordinary Escape closes nested rename and menu and restores summary focus',()=>{
 const view=render(createElement(RenameMenu)),details=view.container.querySelector('details')!;details.open=true;
 fireEvent.click(screen.getByRole('button',{name:'Rename chat'}));const input=screen.getByRole('textbox',{name:'Conversation title'});input.focus();
 const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});fireEvent(input,event);
 expect(event.defaultPrevented).toBe(true);expect(screen.queryByRole('form',{name:'Rename conversation'})).toBeNull();expect(details.open).toBe(false);expect(document.activeElement).toBe(view.container.querySelector('summary'));
 expect(m.rename).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();
});

for(const write of [true,false]) it(`precommit replaced context refuses title ${write?"save":"refresh"}`,()=>{
 const saved=vi.fn(),busy=vi.fn();render(createElement(ConversationRename,{id:'one',title:'Old',onRenamed:saved,onBusyChange:busy}));
 fireEvent.click(screen.getByRole('button',{name:'Rename chat'}));const input=screen.getByRole('textbox',{name:'Conversation title'});
 fireEvent.change(input,{target:{value:'Preserve exact draft'}});m.context={};
 fireEvent.click(screen.getByRole('button',{name:write?'Save title':'Refresh title'}));
 expect(m.rename).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();expect(saved).not.toHaveBeenCalled();expect(busy).not.toHaveBeenCalled();
 expect(input).toHaveProperty('value','Preserve exact draft');
});
