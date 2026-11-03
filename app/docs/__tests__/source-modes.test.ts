// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import {createElement} from 'react';
vi.mock('next/navigation',()=>({redirect:()=>{throw Error('source guide must render instead of redirecting')}}));
import Page from '../source-modes/page';
afterEach(cleanup);
it('renders its own source guide and distinguishes local, connected and preview evidence',()=>{
 render(createElement(Page));
 expect(screen.getByRole('heading',{level:1,name:'Know which source you are using.'})).toBeTruthy();
 for(const title of ['Local files on your computer','Connected GitHub repository','Preview, live and recorded evidence'])expect(screen.getByRole('heading',{name:title})).toBeTruthy();
 expect(screen.getByText(/current local preview/)).toBeTruthy();
});
it('explains exact repository controls and the separate AI send boundary',()=>{
 render(createElement(Page));
 for(const label of ['Local repositories folder','Clone source · GitHub','Refresh connected repositories','Ask Agent'])expect(screen.getAllByText(label).length).toBeGreaterThan(0);
 expect(screen.getByText(/unsent Agent draft/)).toBeTruthy();
 expect(screen.getByText(/Choosing Send later/)).toBeTruthy();
 expect(screen.getByText(/not a verified GitHub snapshot/)).toBeTruthy();
});
it('gives the next safe action for unavailable access and avoids readiness or provider claims',()=>{
 render(createElement(Page));
 expect(screen.getByText(/Existing local files remain usable/)).toBeTruthy();
 expect(screen.getByText(/Do not resend an uncertain or consumed action/)).toBeTruthy();
 expect(screen.getByText(/GitLab connector or GitLab sign-in/)).toBeTruthy();
 for(const href of ['/docs/integration-setup','/docs/permissions-model','/docs/approval-workflow'])expect(screen.getAllByRole('link').some(link=>link.getAttribute('href')===href)).toBe(true);
 expect(document.body.textContent).not.toContain('all source modes are production-ready');
});
