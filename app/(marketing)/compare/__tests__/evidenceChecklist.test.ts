// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('next/link',()=>({default:({children,href,...props}:any)=>createElement('a',{...props,href},children)}));
import {CompareClient} from '../CompareClient';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('shows evidence questions for all alternatives without publishing invented rankings or benchmarks',()=>{
 const request=vi.fn();vi.stubGlobal('fetch',request);render(createElement(CompareClient));
 for(const [choice,count,question] of [['A team',9,'Availability'],['AI tools',10,'Decision rules'],['A SaaS stack',9,'Execution and recovery']] as const){
  fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${choice}$`)}));
  expect(screen.getByRole('button',{name:new RegExp(`^${choice}$`)}).getAttribute('aria-pressed')).toBe('true');
  const table=screen.getByRole('table');expect(within(table).getAllByRole('row')).toHaveLength(count);
  expect(within(table).getByRole('rowheader',{name:new RegExp(`^${question}$`)})).toBeDefined();
  expect(document.body.textContent).not.toMatch(/100% recall|24\/7 coverage|2\.96M|26-person|months of hiring|covered|missing|best-in-class/i);
 }
 expect(screen.getByText(/not a measured benchmark or a claim of feature parity/)).toBeDefined();
 expect(screen.getByRole('region',{name:'Evaluation checklist'}).getAttribute('tabindex')).toBe('0');
 expect(screen.getByRole('link',{name:'See plans'}).getAttribute('href')).toBe('/plans');
 expect(screen.getByRole('link',{name:'Read the FAQ'}).getAttribute('href')).toBe('/faq');
 expect(request).not.toHaveBeenCalled();
});

it('lets a focused overflowing checklist reach every column without taking over vertical or modified keys',()=>{
 render(createElement(CompareClient));
 const frame=screen.getByRole('region',{name:'Evaluation checklist'});
 Object.defineProperties(frame,{scrollWidth:{value:680,configurable:true},clientWidth:{value:342,configurable:true}});
 expect(fireEvent.keyDown(frame,{key:'ArrowRight'})).toBe(false);
 expect(frame.scrollLeft).toBe(80);
 fireEvent.keyDown(frame,{key:'End'});expect(frame.scrollLeft).toBe(338);
 fireEvent.keyDown(frame,{key:'ArrowRight'});expect(frame.scrollLeft).toBe(338);
 fireEvent.keyDown(frame,{key:'ArrowLeft'});expect(frame.scrollLeft).toBe(258);
 fireEvent.keyDown(frame,{key:'Home'});expect(frame.scrollLeft).toBe(0);
 fireEvent.keyDown(frame,{key:'ArrowLeft'});expect(frame.scrollLeft).toBe(0);
 for(const event of [{key:'PageDown'},{key:'ArrowDown'},{key:'ArrowRight',ctrlKey:true},{key:'ArrowRight',metaKey:true},{key:'ArrowRight',altKey:true},{key:'ArrowRight',shiftKey:true},{key:'ArrowRight',isComposing:true},{key:'ArrowRight',keyCode:229}]){
  expect(fireEvent.keyDown(frame,event)).toBe(true);expect(frame.scrollLeft).toBe(0);
 }
 expect(fireEvent.keyDown(within(frame).getByRole('table'),{key:'ArrowRight'})).toBe(true);
 expect(frame.scrollLeft).toBe(0);
 Object.defineProperty(frame,'clientWidth',{value:680});
 expect(fireEvent.keyDown(frame,{key:'End'})).toBe(true);
 expect(frame.scrollLeft).toBe(0);
});
