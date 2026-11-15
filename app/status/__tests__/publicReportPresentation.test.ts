// @vitest-environment jsdom
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
const {build}=vi.hoisted(()=>({build:vi.fn()}));
vi.mock('@/lib/status/publicStatusBuilder',()=>({buildPublicStatus:build}));
vi.mock('@/components/Navigation',()=>({Navigation:()=>null}));
vi.mock('@/components/Footer',()=>({Footer:()=>null}));
vi.mock('next/link',()=>({default:({href,children,...props}:any)=>createElement('a',{...props,href},children)}));
import StatusPage from '../page';
afterEach(()=>{cleanup();vi.clearAllMocks();});
it.each([
 ['operational','All systems operational'],
 ['degraded','Partial degradation'],
 ['down','Major outage'],
 ['unknown','Status unknown'],
] as const)('preserves the report verdict %s and independent component evidence',async(overall,label)=>{
 const components=[
  {id:'store',label:'Store',verdict:'unknown',detail:'The store could not be queried.'},
  {id:'notifications',label:'Notifications',verdict:'down',detail:'The reported sends failed.'},
  {id:'scheduler',label:'Scheduler',verdict:'operational',detail:'The scheduler check passed.'},
 ];
 build.mockResolvedValue({generatedAt:'2026-11-14T20:00:00.000Z',overall,components});
 render(await StatusPage());
 expect(build).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('heading',{level:1,name:label})).toBeDefined();
 expect(screen.getByRole('heading',{level:2,name:'Components · 3'})).toBeDefined();
 const rows=screen.getAllByRole('article');
 expect(rows).toHaveLength(3);
 components.forEach((component,index)=>{
  expect(within(rows[index]).getByRole('heading',{level:3,name:component.label})).toBeDefined();
  expect(within(rows[index]).getByText(component.verdict)).toBeDefined();
  expect(within(rows[index]).getByText(component.detail)).toBeDefined();
 });
 expect(document.querySelector('time')?.dateTime).toBe('2026-11-14T20:00:00.000Z');
 expect(screen.getByRole('link',{name:'/api/status'}).getAttribute('href')).toBe('/api/status');
 expect(screen.getByRole('link',{name:'Docs'}).getAttribute('href')).toBe('/docs/surfaces');
 expect(screen.getByRole('link',{name:'Pricing'}).getAttribute('href')).toBe('/plans');
 expect(screen.getByRole('link',{name:'Release notes'}).getAttribute('href')).toBe('https://github.com/sahme209/visionxixlabs/releases');
});
