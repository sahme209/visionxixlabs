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
 expect(screen.getByRole('img',{name:/Deployment constellation/}).getAttribute('data-selected-stage')).toBe('3');
 expect(screen.getByRole('region',{name:'Separate requester execution'})).toBeTruthy();
 expect(screen.getByRole('img',{name:/Deployment constellation/}).getAttribute('data-inspected-object')).toBe('staging');
 fireEvent.click(screen.getByRole('button',{name:'Inspect layers'}));
 expect(screen.getByRole('img',{name:/Deployment constellation/}).getAttribute('data-view')).toBe('inspect');
 fireEvent.click(screen.getByRole('button',{name:'Camera right'}));
 expect(stages[3].getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(screen.getByRole('button',{name:'Assemble layers'}));
 expect(screen.getByRole('img',{name:/Deployment constellation/}).getAttribute('data-view')).toBe('assembled');
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

it('keeps Home balanced: a centred hero with route, limits and product, then the shared assembly in its own section',()=>{
 render(createElement(Home));
 const [first]=Array.from(screen.getByRole('main').querySelectorAll<HTMLElement>(':scope > section'));
 const second=screen.getByRole('main').querySelector<HTMLElement>(':scope > section[aria-label="Inside a deployment decision"]')!;
 expect(within(first).getByRole('link',{name:'Explore Axiom'}).getAttribute('href')).toBe('/product');
 expect(within(first).getByText(/Complete Governance enforcement and activation are not established/)).toBeTruthy();
 expect(within(first).getByText('Existing media fixture')).toBeTruthy();
 expect(within(first).getByText(/^A governed workspace for deployments and connected operational changes/)).toBeTruthy();
 expect(within(first).queryByRole('list',{name:'Conceptual workflow'})).toBeNull();
 expect(within(second).getByRole('list',{name:'Conceptual workflow'})).toBeTruthy();
 expect(within(second).getByRole('img',{name:/Deployment constellation/})).toBeTruthy();
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
it('keeps the compact hero object and essential limits visible while details open deliberately',()=>{
 render(createElement(GovernanceAssembly,{compact:true}));
 const disclosure=screen.getByText('Read the selected record').closest('details')!;
 expect(disclosure.open).toBe(false);
 expect(screen.getByRole('img',{name:/Deployment constellation/})).toBeTruthy();
 expect(screen.getByText(/Governance Intelligence remains incomplete/).closest('details')).toBeNull();
 expect(screen.getByText(/no actions are performed/).closest('details')).toBeNull();
 const stages=within(screen.getByRole('list',{name:'Conceptual workflow'})).getAllByRole('button');
 fireEvent.click(stages[2]);expect(disclosure.open).toBe(true);
 expect(screen.getByRole('region',{name:'Independent review'})).toBeTruthy();
 expect(screen.getByRole('img',{name:/Deployment constellation/}).getAttribute('data-view')).toBe('inspect');
});

it('previews a physical object on hover/focus, restores on leave, and commits the same inspection by touch click',()=>{
 render(createElement(GovernanceAssembly));
 const scene=screen.getByRole('img',{name:/Deployment constellation/});
 const artifact=scene.querySelector('[data-hit-target="artifact"]')!;
 fireEvent.pointerOver(artifact);expect(scene.getAttribute('data-inspected-object')).toBe('artifact');
 fireEvent.pointerOut(artifact);expect(scene.getAttribute('data-inspected-object')).toBe('repository');
 const gate=screen.getByRole('button',{name:'Inspect Review gate'});
 fireEvent.focus(gate);expect(scene.getAttribute('data-inspected-object')).toBe('gate');
 fireEvent.blur(gate);expect(scene.getAttribute('data-inspected-object')).toBe('repository');
 fireEvent.click(screen.getByRole('button',{name:'Inspect Production · held'}));
 expect(scene.getAttribute('data-inspected-object')).toBe('production');expect(scene.getAttribute('data-selected-stage')).toBe('3');
 fireEvent.pointerOver(artifact);fireEvent.pointerOut(artifact);expect(scene.getAttribute('data-inspected-object')).toBe('production');
 const held=scene.querySelector('[data-route="production"]')!;expect(held.getAttribute('data-held')).toBe('true');expect(held.querySelectorAll('path')).toHaveLength(2);
});
it('server renders seven distinct deployment objects and their named equivalent controls',()=>{
 const markup=renderToStaticMarkup(createElement(GovernanceAssembly,{compact:true}));const doc=new DOMParser().parseFromString(markup,'text/html');
 expect(doc.querySelectorAll('[data-object]')).toHaveLength(7);expect(doc.querySelectorAll('[data-hit-target]')).toHaveLength(7);
 const fallback=doc.querySelector('noscript')!;expect(fallback.querySelectorAll('ul > li')).toHaveLength(7);
 expect(fallback.textContent).toContain('Production · held');expect(fallback.textContent).toContain('does not run or authorize a deployment');
});

it('commits a touch choice over an earlier focus preview even without a blur event',()=>{
 render(createElement(GovernanceAssembly));
 fireEvent.focus(screen.getByRole('button',{name:'Inspect Review gate'}));
 const scene=screen.getByRole('img',{name:/Deployment constellation/});
 expect(scene.getAttribute('data-inspected-object')).toBe('gate');
 const production=screen.getByRole('button',{name:'Inspect Production · held'});
 fireEvent.click(production);
 expect(production.getAttribute('aria-pressed')).toBe('true');
 expect(scene.getAttribute('data-inspected-object')).toBe('production');
 expect(screen.getByRole('region',{name:'Separate requester execution'})).toBeTruthy();
});
