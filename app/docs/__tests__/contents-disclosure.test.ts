// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {createElement} from 'react';
const route=vi.hoisted(()=>({path:'/docs/source-modes'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.path}));
vi.mock('@/components/Navigation',()=>({Navigation:()=>null}));
vi.mock('@/components/Footer',()=>({Footer:()=>null}));
import Layout from '../layout';
beforeEach(()=>vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false}))));
afterEach(()=>{cleanup();route.path='/docs/source-modes';vi.unstubAllGlobals()});
const page=()=>createElement(Layout,null,createElement('h1',null,'Source guide'),createElement('p',null,'Current-version limits remain visible.'));
it('starts compact on narrow screens while preserving desktop navigation and the article',()=>{
 render(page());const button=screen.getByRole('button',{name:'Documentation contents'});
 expect(button.tagName).toBe('BUTTON');expect(button.getAttribute('aria-expanded')).toBe('false');expect(button.className).toContain('lg:hidden');
 const panel=document.getElementById(button.getAttribute('aria-controls')!);expect(panel?.className).toContain('hidden');expect(panel?.className).toContain('lg:block');
 expect(screen.getByRole('main').textContent).toContain('Source guide');expect(screen.getByRole('main').textContent).toContain('Current-version limits remain visible.');
});
it('opens and closes through a native button with an exact controlled navigation panel',()=>{
 render(page());const button=screen.getByRole('button',{name:'Documentation contents'});button.focus();fireEvent.click(button);expect(button.getAttribute('aria-expanded')).toBe('true');
 const panel=document.getElementById(button.getAttribute('aria-controls')!);expect(panel?.contains(screen.getByRole('navigation',{name:'Documentation navigation'}))).toBe(true);expect(panel?.className.split(' ')).not.toContain('hidden');
 fireEvent.click(button);expect(button.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(button);
});
it('Escape from a guide link closes the disclosure and restores keyboard focus',()=>{
 render(page());const button=screen.getByRole('button',{name:'Documentation contents'});fireEvent.click(button);
 const link=screen.getByRole('link',{name:'Getting started'});link.focus();fireEvent.keyDown(link,{key:'Escape'});
 expect(button.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(button);
});
it('a client route change closes expanded contents without trapping focus in the collapsed panel',()=>{
 const view=render(page());const button=screen.getByRole('button',{name:'Documentation contents'});fireEvent.click(button);screen.getByRole('link',{name:'Getting started'}).focus();route.path='/docs/getting-started';view.rerender(page());
 expect(button.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(button);
});

it('desktop client navigation never sends focus to the narrow-only disclosure button',()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})));const view=render(page());const link=screen.getByRole('link',{name:'Getting started'});link.focus();route.path='/docs/getting-started';view.rerender(page());expect(document.activeElement).toBe(link);
});

it('Escape on the disclosure button also closes expanded contents',()=>{
 render(page());const button=screen.getByRole('button',{name:'Documentation contents'});button.focus();fireEvent.click(button);fireEvent.keyDown(button,{key:'Escape'});expect(button.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(button);
});
