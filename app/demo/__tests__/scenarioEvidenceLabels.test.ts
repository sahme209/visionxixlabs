// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {createElement} from 'react';
import type {DemoScenario} from '@/lib/demo/demoScenarios';
vi.mock('next/link',()=>({default:({children,...props}: {children:import('react').ReactNode;href:string})=>createElement('a',props,children)}));
vi.mock('@/components/marketing/SandboxNavigation',()=>({SandboxNavigation:()=>null}));
vi.mock('../[id]/StepVisual',()=>({StepVisual:()=>createElement('div',{'data-testid':'sample-visual'},'Sample workspace')}));
import {DemoScenarioClient} from '../[id]/DemoScenarioClient';
const scenario:DemoScenario={id:'devops_pipeline',title:'Sample deployment flow',pitch:'Inspect the example',description:'Local illustration',audience:'public',estimatedMinutes:2,lastReviewed:'2026-11-03',steps:[
 {id:'one',title:'Trigger pipeline',description:'Inspect the example pipeline request',approval:'two_person',expectedResult:'A sample run record'},
 {id:'two',title:'Poll status',description:'Inspect the example status',approval:'none',expectedResult:'An illustrative result'},
]};
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('identifies the illustrated interface and API payloads before they can be mistaken for recorded execution',()=>{
 render(createElement(DemoScenarioClient,{scenario}));
 expect(screen.getByText('Illustrative interface · not a product screenshot')).toBeTruthy();
 expect(screen.getByText('Illustrative API reference')).toBeTruthy();
 expect(screen.getByText('Example request body')).toBeTruthy();
 expect(screen.getByText('Example response')).toBeTruthy();
 expect(screen.getByText('No API request is sent by this walkthrough. These payloads are examples, not saved execution evidence.')).toBeTruthy();
 expect(screen.queryByText('api exercised')).toBeNull();
});
it('retains sample-only evidence labels after local navigation without network effects',()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 render(createElement(DemoScenarioClient,{scenario}));
 fireEvent.click(screen.getAllByRole('button',{name:'Next →'})[0]);
 expect(screen.getByRole('heading',{name:'Poll status'})).toBeTruthy();
 expect(screen.getByText('Illustrative interface · not a product screenshot')).toBeTruthy();
 expect(screen.getByText('Example response')).toBeTruthy();
 expect(screen.getByText(/No API request is sent by this walkthrough/)).toBeTruthy();
 expect(fetch).not.toHaveBeenCalled();
});
