/** @vitest-environment jsdom */
import {createElement as h,useState} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {useDismissibleDetails} from '../../../desktop/src/lib/useDismissibleDetails';
afterEach(cleanup);
function Menu({submit=vi.fn()}:{submit?:()=>void}){
 const menu=useDismissibleDetails(),[text,setText]=useState('');
 return h('div',null,h('details',{...menu},h('summary',null,'Options'),h('form',{onSubmit:e=>{e.preventDefault();submit()}},h('input',{'aria-label':'Retained menu draft',value:text,onChange:e=>setText(e.target.value)}))),h('button',null,'Elsewhere'));
}
it('closes outside without discarding edits or submitting and does not steal focus',()=>{
 const submit=vi.fn(),view=render(h(Menu,{submit})),details=view.container.querySelector('details')!;
 details.open=true;fireEvent.change(screen.getByLabelText('Retained menu draft'),{target:{value:'keep this edit'}});
 const outside=screen.getByRole('button',{name:'Elsewhere'});outside.focus();fireEvent.pointerDown(outside);
 expect(details.open).toBe(false);expect(document.activeElement).toBe(outside);details.open=true;
 expect(screen.getByLabelText('Retained menu draft')).toHaveProperty('value','keep this edit');expect(submit).not.toHaveBeenCalled();
});
it('keeps clicks and focus inside the menu open',()=>{
 const view=render(h(Menu)),details=view.container.querySelector('details')!;details.open=true;const input=screen.getByLabelText('Retained menu draft');
 fireEvent.pointerDown(input);input.focus();expect(details.open).toBe(true);
 fireEvent.pointerDown(document.body);expect(details.open).toBe(false);
});
it('returns focus to the summary on Escape without submitting',()=>{
 const submit=vi.fn(),view=render(h(Menu,{submit})),details=view.container.querySelector('details')!;details.open=true;
 const input=screen.getByLabelText('Retained menu draft');input.focus();fireEvent.keyDown(input,{key:'Escape'});
 expect(details.open).toBe(false);expect(document.activeElement).toBe(view.container.querySelector('summary'));expect(submit).not.toHaveBeenCalled();
});
it('dismisses when keyboard focus moves outside, retaining the mounted input',()=>{
 const view=render(h(Menu)),details=view.container.querySelector('details')!;details.open=true;screen.getByLabelText('Retained menu draft').focus();
 screen.getByRole('button',{name:'Elsewhere'}).focus();expect(details.open).toBe(false);expect(screen.getByLabelText('Retained menu draft')).toBeTruthy();
});
it.each([{isComposing:true},{keyCode:229}])('preserves menu draft and focus on composing Escape (%j)',signal=>{
 const submit=vi.fn(),view=render(h(Menu,{submit})),details=view.container.querySelector('details')!;details.open=true;
 const input=screen.getByLabelText('Retained menu draft');fireEvent.change(input,{target:{value:'未確定'}});input.focus();
 const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,...signal});fireEvent(input,event);
 expect(event.defaultPrevented).toBe(false);expect(details.open).toBe(true);expect(document.activeElement).toBe(input);expect(input).toHaveProperty('value','未確定');expect(submit).not.toHaveBeenCalled();
});
