// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({push:vi.fn(),pathname:'/'}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:state.push}),usePathname:()=>state.pathname}));
import {CommandPalette} from '../CommandPalette';
afterEach(()=>{cleanup();state.push.mockClear();state.pathname='/';});
function open(){
 render(createElement(CommandPalette));
 fireEvent.keyDown(window,{key:'k',ctrlKey:true,metaKey:true});
 return screen.getByPlaceholderText('Search the site… type, then ↵') as HTMLInputElement;
}
const composition=[{name:'native composition',isComposing:true,keyCode:0},{name:'legacy IME229',isComposing:false,keyCode:229}];
for(const variant of composition){
 it.each(['Enter','Escape','ArrowDown','ArrowUp'])('preserves '+variant.name+' %s for the input method',key=>{
  const input=open();fireEvent.change(input,{target:{value:'Axiom capabilities'}});input.focus();
  const event=new KeyboardEvent('keydown',{key,...variant,bubbles:true,cancelable:true});
  fireEvent(input,event);
  expect(screen.queryByRole('dialog',{name:'Command palette'})).not.toBeNull();
  expect(input.value).toBe('Axiom capabilities');
  expect(document.activeElement).toBe(input);
  expect(event.defaultPrevented).toBe(false);
  expect(state.push).not.toHaveBeenCalled();
 });
 it('does not toggle the palette for '+variant.name+' shortcut',()=>{
  render(createElement(CommandPalette));
  const event=new KeyboardEvent('keydown',{key:'k',ctrlKey:true,metaKey:true,...variant,bubbles:true,cancelable:true});
  fireEvent(window,event);
  expect(screen.queryByRole('dialog',{name:'Command palette'})).toBeNull();
  expect(event.defaultPrevented).toBe(false);
 });
}
it('keeps ordinary arrow and Enter navigation to the current Product destination',()=>{
 const input=open();fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'Enter'});
 expect(state.push).toHaveBeenCalledExactlyOnceWith('/product');
 expect(screen.queryByRole('dialog',{name:'Command palette'})).toBeNull();
});
it('keeps ordinary Escape dismissal',()=>{
 const input=open();fireEvent.keyDown(input,{key:'Escape'});
 expect(screen.queryByRole('dialog',{name:'Command palette'})).toBeNull();expect(state.push).not.toHaveBeenCalled();
});
it('does not expose the palette on an account route',()=>{
 state.pathname='/account/settings';render(createElement(CommandPalette));fireEvent.keyDown(window,{key:'k',ctrlKey:true,metaKey:true});
 expect(screen.queryByRole('dialog',{name:'Command palette'})).toBeNull();expect(state.push).not.toHaveBeenCalled();
});
