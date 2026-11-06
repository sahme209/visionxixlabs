// @vitest-environment jsdom
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {GovernanceAssembly} from '../GovernanceAssembly';
import {renderToStaticMarkup} from 'react-dom/server';
import {ASSEMBLY_STAGES} from '../governanceAssemblyModel';
vi.mock('@/components/Navigation',()=>({Navigation:()=>null}));
vi.mock('@/components/Footer',()=>({Footer:()=>null}));
vi.mock('@/components/marketing/HomepageMediaShowcase',()=>({HomepageMediaShowcase:()=>createElement('div',null,'Existing media fixture')}));
vi.mock('@/components/marketing/CinematicAxiomDemo',()=>({CinematicAxiomDemo:()=>null}));
vi.mock('next/link',()=>({default:({href,children,...props}:any)=>createElement('a',{...props,href},children)}));
import Home from '@/app/page';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('uses the same selected record in the scene and semantic explanation',()=>{
 render(createElement(GovernanceAssembly));
 const list=screen.getByRole('list',{name:'Conceptual workflow'});
 const stages=within(list).getAllByRole('button');
 fireEvent.click(stages[3]);
 expect(screen.getByRole('img',{name:/Evidence assembly/}).getAttribute('data-selected-stage')).toBe('3');
 expect(screen.getByRole('region',{name:'Separate requester execution'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Inspect layers'}));
 expect(screen.getByRole('img',{name:/Evidence assembly/}).getAttribute('data-view')).toBe('inspect');
 fireEvent.click(screen.getByRole('button',{name:'Camera right'}));
 expect(stages[3].getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(screen.getByRole('button',{name:'Assemble layers'}));
 expect(screen.getByRole('img',{name:/Evidence assembly/}).getAttribute('data-view')).toBe('assembled');
});
it('keeps modified/composing keyboard input untouched and separates instances',()=>{
 render(createElement('div',null,createElement(GovernanceAssembly),createElement(GovernanceAssembly)));
 const lists=screen.getAllByRole('list',{name:'Conceptual workflow'});const stages=within(lists[0]).getAllByRole('button');
 stages[0].focus();fireEvent.keyDown(stages[0],{key:'End',ctrlKey:true});expect(stages[0].getAttribute('aria-pressed')).toBe('true');
 fireEvent.keyDown(stages[0],{key:'End'});expect(document.activeElement).toBe(stages[4]);
 expect(within(lists[1]).getAllByRole('button')[0].getAttribute('aria-pressed')).toBe('true');
 const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);expect(new Set(ids).size).toBe(ids.length);
});
it('shows all three possible outcomes and has no network, timer or storage operation',()=>{
 const request=vi.fn();vi.stubGlobal('fetch',request);const interval=vi.spyOn(globalThis,'setInterval');
 render(createElement(GovernanceAssembly));
 for(const button of screen.getAllByRole('button'))fireEvent.click(button);
 expect(screen.getByText('Confirmed evidence')).toBeTruthy();expect(screen.getByText('Refused')).toBeTruthy();expect(screen.getByText('Unknown')).toBeTruthy();
 expect(screen.getByText(/no actions are performed/)).toBeTruthy();expect(request).not.toHaveBeenCalled();expect(interval).not.toHaveBeenCalled();interval.mockRestore();
});

it('mounts the actual shared assembly in Home first screen without losing its primary route or availability limits',()=>{
 render(createElement(Home));
 const first=screen.getByRole('main').querySelector('section')!;
 expect(within(first).getByRole('list',{name:'Conceptual workflow'})).toBeTruthy();
 expect(within(first).getByRole('link',{name:'Explore Axiom'}).getAttribute('href')).toBe('/product');
 expect(within(first).getByText(/Complete Governance enforcement and activation are not established/)).toBeTruthy();
 expect(within(first).getByText('Existing media fixture')).toBeTruthy();
});

it('server renders a complete ordered no-JavaScript reading of every record and boundary',()=>{
 const markup=renderToStaticMarkup(createElement(GovernanceAssembly));
 const doc=new DOMParser().parseFromString(markup,'text/html');
 const fallback=doc.querySelector('noscript');expect(fallback).not.toBeNull();
 expect(fallback!.textContent).toContain('Interactive controls require JavaScript');
 const records=fallback!.querySelectorAll('ol > li');expect(records).toHaveLength(5);
 ASSEMBLY_STAGES.forEach((stage,index)=>{
  expect(records[index].textContent).toContain(stage.title);
  expect(records[index].textContent).toContain(stage.detail);
  expect(records[index].textContent).toContain(stage.boundary);
 });
});
