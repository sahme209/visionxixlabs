// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import {createElement} from 'react';
import {existsSync} from 'node:fs';
import path from 'node:path';
import Page from '../page';
afterEach(cleanup);
it('offers four distinct task paths with meaningful canonical guide links',()=>{
 render(createElement(Page));
 for(const title of ['Get started','Complete a task','Look up a control','Resolve a problem']){
  const region=screen.getByRole('region',{name:title});
  expect(within(region).getAllByRole('link').length).toBeGreaterThan(1);
 }
 for(const link of screen.getAllByRole('region').flatMap(region=>within(region).getAllByRole('link'))){
  const href=link.getAttribute('href');
  expect(href).toMatch(/^\/docs\//);
  expect(existsSync(path.join(process.cwd(),'app',href!,'page.tsx'))).toBe(true);
  expect(link.textContent!.trim().length).toBeGreaterThan(8);
  expect(link.getAttribute('tabindex')).not.toBe('-1');
 }
});
it('keeps version and uncertainty boundaries visible without blanket completeness claims',()=>{
 render(createElement(Page));
 expect(screen.getByText('Version and scope')).toBeTruthy();
 expect(screen.getByText(/installed version/)).toBeTruthy();
 expect(screen.getByText(/Do not resend an uncertain or consumed action/)).toBeTruthy();
 expect(document.body.textContent).not.toContain('Every product flow');
 expect(document.body.textContent).not.toContain('Every flow is documented');
});
it('provides visible keyboard focus treatment on guide links and preserves feedback',()=>{
 render(createElement(Page));
 const links=screen.getAllByRole('region').flatMap(region=>within(region).getAllByRole('link'));
 for(const link of links){expect(link.className).toContain('focus-visible:');link.focus();expect(document.activeElement).toBe(link)}
 expect(screen.getByText(/Still blocked/)).toBeTruthy();
});
