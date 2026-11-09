/** @vitest-environment jsdom */
import { createElement } from 'react';
import { existsSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const route=vi.hoisted(()=>({pathname:'/'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.pathname}));
// Decorative icon imports are simulated; actual navigation and focus handlers render.
vi.mock('@heroicons/react/24/outline',()=>({Bars3Icon:()=>null,XMarkIcon:()=>null}));
import { Navigation } from '../Navigation';
import { Footer } from '../Footer';
const width=window.innerWidth;
beforeEach(()=>{route.pathname='/';Object.defineProperty(window,'innerWidth',{configurable:true,value:1400});vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{fn(0);return 0;});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();Object.defineProperty(window,'innerWidth',{configurable:true,value:width});});
const primary=[['Product','/product'],['Integrations','/integrations'],['Security','/security'],['Docs','/docs'],['Demo','/demo']];
const secondary=[['Get started','/plans'],['Support (account required)','/account/help'],['Status','/status'],['Contact','/contact']];
it('keeps the five approved primary destinations and quiet account/download links visible',()=>{
 render(createElement(Navigation));
 for(const[label,href]of [...primary,['Sign in','/auth/signin'],['Download','/download']])expect(screen.getByRole('link',{name:label}).getAttribute('href')).toBe(href);
 expect(screen.queryByRole('link',{name:'Get started'})).toBeNull();expect(screen.queryByRole('link',{name:'Support Axiom'})).toBeNull();
 expect(screen.getByRole('button',{name:'More'}).getAttribute('aria-expanded')).toBe('false');
});
it('opens More deliberately, supports keyboard focus and Escape return, outside close and route close',()=>{
 const view=render(createElement(Navigation));const trigger=screen.getByRole('button',{name:'More'});
 trigger.focus();fireEvent.keyDown(trigger,{key:'ArrowDown'});
 const links=screen.getByRole('group',{name:'More destinations'});
 for(const[label,href]of secondary)expect(within(links).getByRole('link',{name:label}).getAttribute('href')).toBe(href);
 expect(document.activeElement).toBe(within(links).getByRole('link',{name:'Get started'}));
 fireEvent.keyDown(document,{key:'Escape'});expect(screen.queryByRole('group',{name:'More destinations'})).toBeNull();expect(document.activeElement).toBe(trigger);
 fireEvent.click(trigger);fireEvent.pointerDown(document.body);expect(screen.queryByRole('group',{name:'More destinations'})).toBeNull();
 fireEvent.click(trigger);route.pathname='/product';view.rerender(createElement(Navigation));expect(screen.queryByRole('group',{name:'More destinations'})).toBeNull();
});
it('mobile includes every conceptual destination and preserves focus trapping, close and scroll recovery',()=>{
 Object.defineProperty(window,'innerWidth',{configurable:true,value:390});document.body.style.overflow='auto';
 render(createElement(Navigation));fireEvent.click(screen.getByRole('button',{name:'Open navigation menu'}));
 const dialog=screen.getByRole('dialog',{name:'Site navigation'});
 for(const[label,href]of [...primary,...secondary,['Founding Supporters','/support'],['Sign in','/auth/signin'],['Download','/download']])expect(within(dialog).getByRole('link',{name:label}).getAttribute('href')).toBe(href);
 const close=within(dialog).getByRole('button',{name:'Close navigation menu'});expect(document.activeElement).toBe(close);
 const links=within(dialog).getAllByRole('link');links.at(-1)!.focus();fireEvent.keyDown(document,{key:'Tab'});expect(document.activeElement).toBe(close);
 fireEvent.keyDown(document,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(links.at(-1));
 const docs=within(dialog).getByRole('link',{name:'Docs'});docs.addEventListener('click',event=>event.preventDefault());fireEvent.click(docs);expect(screen.queryByRole('dialog')).toBeNull();expect(document.body.style.overflow).toBe('auto');
});
it('footer distinguishes account support from Founding Supporters with real destinations',()=>{
 render(createElement(Footer));
 expect(screen.getByRole('link',{name:'Support (account required)'}).getAttribute('href')).toBe('/account/help');
 const supporters=screen.getAllByRole('link',{name:'Founding Supporters'});expect(supporters.length).toBeGreaterThan(0);for(const link of supporters)expect(link.getAttribute('href')).toBe('/support');
 expect(screen.getByRole('link',{name:'Docs'}).getAttribute('href')).toBe('/docs');expect(screen.queryByRole('link',{name:'Support Axiom'})).toBeNull();
 expect(screen.getByRole('link',{name:'Contact'}).getAttribute('href')).toBe('/contact');
 expect(screen.getByRole('link',{name:'Download'}).getAttribute('href')).toBe('/download');
});

it('all approved destinations resolve to existing pages and mobile outside close releases scroll lock',()=>{
 for(const route of [...primary,...secondary,['Founding Supporters','/support']].map(([,href])=>href))expect(existsSync(`app${route}/page.tsx`)||existsSync(`app/(marketing)${route}/page.tsx`)).toBe(true);
 Object.defineProperty(window,'innerWidth',{configurable:true,value:390});render(createElement(Navigation));fireEvent.click(screen.getByRole('button',{name:'Open navigation menu'}));
 fireEvent.pointerDown(document.body);expect(screen.queryByRole('dialog')).toBeNull();expect(document.body.style.overflow).not.toBe('hidden');
});

it('mobile modal owns its visible Close control and returns focus without a duplicate outside toggle',()=>{
 Object.defineProperty(window,'innerWidth',{configurable:true,value:375});render(createElement(Navigation));const open=screen.getByRole('button',{name:'Open navigation menu'});fireEvent.click(open);
 const dialog=screen.getByRole('dialog',{name:'Site navigation'});const close=within(dialog).getByRole('button',{name:'Close navigation menu'});
 expect(screen.getAllByRole('button',{name:'Close navigation menu'})).toHaveLength(1);expect(document.activeElement).toBe(close);
 expect(close.className).toContain('min-h-11');expect(dialog.className).toContain('inset-0');
 fireEvent.click(close);expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(open);
});
