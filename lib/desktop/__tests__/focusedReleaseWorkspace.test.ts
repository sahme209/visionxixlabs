/** @vitest-environment jsdom */
import {useState,createElement as h} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {FocusedReleaseWorkspace,type ReleaseWorkspaceItem} from '../../../desktop/src/components/FocusedReleaseWorkspace';
afterEach(cleanup);
const items:ReleaseWorkspaceItem[]=[{id:'a',title:'Release Alpha',status:'submitted',nextStep:'Review exact controls',attention:true,busy:false},{id:'b',title:'Release Beta',status:'draft',nextStep:'Complete scope',attention:false,busy:true}];
function Draft({name}:{name:string}){const [value,setValue]=useState('');return h('label',null,name+' note',h('input',{value,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>setValue(e.target.value)}))}
it('focuses one release while preserving hidden drafts and exposing attention and ongoing work in navigation',()=>{
 const mounted=vi.fn();function Panel({name}:{name:string}){mounted(name);return h(Draft,{name})}
 const view=render(h(FocusedReleaseWorkspace,{items,children:item=>h(Panel,{name:item.title})}));
 const first=screen.getByRole('button',{name:/Release Alpha/}),second=screen.getByRole('button',{name:/Release Beta/});
 expect(first.getAttribute('aria-current')).toBe('true');expect(second.textContent).toContain('Working');expect(first.textContent).toContain('Needs attention');
 fireEvent.change(screen.getByLabelText('Release Alpha note'),{target:{value:'unsaved exact review'}});
 fireEvent.click(second);
 expect(view.container.querySelector('section:not([hidden])')?.textContent).toContain('Release Beta note');
 expect((screen.getByLabelText('Release Alpha note') as HTMLInputElement).value).toBe('unsaved exact review');
 fireEvent.click(first);expect((screen.getByLabelText('Release Alpha note') as HTMLInputElement).value).toBe('unsaved exact review');
});
it('keeps selection attached to the release ID when reordered and falls back safely when removed',()=>{
 const view=render(h(FocusedReleaseWorkspace,{items,children:item=>h(Draft,{name:item.title})}));
 fireEvent.click(screen.getByRole('button',{name:/Release Beta/}));
 view.rerender(h(FocusedReleaseWorkspace,{items:[...items].reverse(),children:item=>h(Draft,{name:item.title})}));
 expect(screen.getByRole('button',{name:/Release Beta/}).getAttribute('aria-current')).toBe('true');
 view.rerender(h(FocusedReleaseWorkspace,{items:[items[0]],children:item=>h(Draft,{name:item.title})}));
 expect(screen.getByRole('button',{name:/Release Alpha/}).getAttribute('aria-current')).toBe('true');
});
it('gives each visible workspace its navigation label without creating execution or approval controls',()=>{
 const view=render(h(FocusedReleaseWorkspace,{items,children:item=>h('p',null,item.title+' context')}));
 const button=screen.getByRole('button',{name:/Release Alpha/});const panel=view.container.querySelector('section:not([hidden])');
 expect(panel?.getAttribute('id')).toBe(button.getAttribute('aria-controls'));expect(panel?.getAttribute('aria-labelledby')).toBe(button.id);
 expect(screen.getAllByRole('button')).toHaveLength(2);
});
