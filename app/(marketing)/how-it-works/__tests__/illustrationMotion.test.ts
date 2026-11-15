// @vitest-environment jsdom
import {createElement} from 'react';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const preference=vi.hoisted(()=>({reduce:false}));
vi.mock('framer-motion',async()=>{
 const React=await import('react');const cache=new Map();
 return {useReducedMotion:()=>preference.reduce,motion:new Proxy({}, {get:(_target,tag:string)=>{
  if(!cache.has(tag))cache.set(tag,({children,initial,animate,transition,whileInView,whileHover,viewport,...props}:any)=>React.createElement(tag,props,children));return cache.get(tag);
 }})};
});
import {HowItWorksClient} from '../HowItWorksClient';
beforeEach(()=>{preference.reduce=false;vi.useFakeTimers();});
afterEach(()=>{cleanup();vi.useRealTimers();});
const selected=()=>Array.from(screen.getByRole('list',{name:'Agent responsibilities'}).children).find(e=>e.className.includes('bg-zinc-500/10'))?.textContent;
it('shows static architecture with no timer or player controls',()=>{
 render(createElement(HowItWorksClient));
 expect(vi.getTimerCount()).toBe(0);
 expect(screen.queryByRole('button',{name:/illustration/})).toBeNull();
 const before=screen.getByRole('list',{name:'Agent responsibilities'}).textContent;
 act(()=>vi.advanceTimersByTime(30000));
 expect(screen.getByRole('list',{name:'Agent responsibilities'}).textContent).toBe(before);
 cleanup();expect(vi.getTimerCount()).toBe(0);
});
it('shows every agent responsibility without a timer under reduced motion',()=>{
 preference.reduce=true;render(createElement(HowItWorksClient));
 expect(vi.getTimerCount()).toBe(0);
 expect(screen.queryByRole('button',{name:/illustration/})).toBeNull();
 const rows=within(screen.getByRole('list',{name:'Agent responsibilities'})).getAllByRole('listitem');
 expect(rows).toHaveLength(10);
 expect(rows.every(row=>!row.className.includes('opacity-50'))).toBe(true);
 expect(screen.getByText(/Conceptual communication diagram, not live deployment activity/)).toBeDefined();
});
