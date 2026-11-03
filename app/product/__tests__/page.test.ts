// @vitest-environment jsdom
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
// Shared account navigation and animated sample scenes have their own behavior;
// these tests exercise Product's public guidance and the demo insertion boundary.
vi.mock('@/components/Navigation',()=>({Navigation:()=>null}));
vi.mock('@/components/Footer',()=>({Footer:()=>null}));
vi.mock('@/components/marketing/CinematicAxiomDemo',()=>({CinematicAxiomDemo:()=>createElement('button',null,'Sample playback')}));
import Page from '../page';
afterEach(cleanup);
it('offers actionable next steps to setup, review, integrations, demo and downloads',()=>{
 render(createElement(Page));
 for(const href of ['/docs/getting-started','/docs/approval-workflow','/integrations','/demo','/download']) {
  expect(screen.getAllByRole('link').some(link=>link.getAttribute('href')===href)).toBe(true);
 }
});
it('scopes the ordered workflow to supported versions and enabled controls',()=>{
 render(createElement(Page));
 const sequence=screen.getByRole('list',{name:/conceptual workflow/i});
 expect(within(sequence).getAllByRole('listitem')).toHaveLength(5);
 for(const name of [/repository context/i,/exact proposal/i,/independent review/i,/separate requester execution/i,/recorded outcome.*recovery/i]) {
  expect(within(sequence).getByRole('heading',{name})).toBeDefined();
 }
 expect(screen.getByText(/support depends on.*version.*enabled workflow/i)).toBeDefined();
 expect(screen.getByText(/full Governance.*coverage and activation are not complete/i)).toBeDefined();
});
it('labels the scripted preview before interaction and separates it from release evidence',()=>{
 render(createElement(Page));
 const label=screen.getByRole('heading',{name:/scripted interactive preview/i});
 expect(label.compareDocumentPosition(screen.getByRole('button',{name:'Sample playback'}))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getByText(/local previews.*shipped release/i)).toBeDefined();
 expect(document.body.textContent).not.toMatch(/never executes a write by itself|two members and ten|included at every tier/i);
});
