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
// The ordered 'conceptual workflow' section was intentionally removed in 4bf9082a; its assertions were retired.
// The no-overclaim disclaimer it also checked is still on the page and stays enforced here.
it('keeps the explicit not-complete Governance disclaimer',()=>{
 render(createElement(Page));
 expect(screen.getByText(/full Governance.*coverage and activation are not complete/i)).toBeDefined();
});
it('labels the scripted preview before interaction and separates it from release evidence',()=>{
 render(createElement(Page));
 const label=screen.getByRole('heading',{name:/scripted interactive preview/i});
 expect(label.compareDocumentPosition(screen.getByRole('button',{name:'Sample playback'}))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getByText(/local previews.*shipped release/i)).toBeDefined();
 expect(document.body.textContent).not.toMatch(/never executes a write by itself|two members and ten|included at every tier/i);
});
