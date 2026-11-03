// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {createElement} from 'react';
vi.mock('@heroicons/react/24/outline',()=>({ArrowRightIcon:()=>null,ShieldCheckIcon:()=>null}));
vi.mock('@/components/Navigation',()=>({Navigation:()=>null}));
vi.mock('@/components/Footer',()=>({Footer:()=>null}));
vi.mock('@/components/marketing/CinematicAxiomDemo',()=>({CinematicAxiomDemo:()=>createElement('section',{'data-testid':'existing-tour'},'Existing tour controls')}));
import Page from '../page';
afterEach(cleanup);
it('classifies the scripted tour before interaction and distinguishes missing authentic recordings',()=>{
 render(createElement(Page));
 const label=screen.getByText('Scripted interactive tour');
 const start=screen.getByRole('link',{name:'Start the scripted tour'});
 expect(label.compareDocumentPosition(start)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getByText(/Recorded product walkthroughs are not available on this page/)).toBeTruthy();
 expect(screen.getByTestId('existing-tour')).toBeTruthy();
});
it('uses scoped guide cards rather than claiming verified released outcomes or automatic recovery',()=>{
 render(createElement(Page));
 const text=document.body.textContent!;
 for(const misleading of ['released desktop and service behavior','Implemented workflows','recovery armed','no production action can run from this website'])expect(text).not.toContain(misleading);
 expect(screen.getByText(/Version-specific guide/)).toBeTruthy();
 expect(screen.getByText(/Implementation scope/)).toBeTruthy();
 expect(screen.getByText(/Provider-specific guide/)).toBeTruthy();
 expect(screen.getByRole('link',{name:/Check available downloads/}).getAttribute('href')).toBe('/download');
 expect(screen.getByRole('link',{name:/Read the approval guide/}).getAttribute('href')).toBe('/docs/approval-workflow');
});
it('limits no-action and no-credential promises to this tour',()=>{
 render(createElement(Page));
 expect(screen.getByText(/This scripted tour does not request connector credentials, call AI services or run provider actions/)).toBeTruthy();
 expect(document.querySelector('video,iframe')).toBeNull();
});
