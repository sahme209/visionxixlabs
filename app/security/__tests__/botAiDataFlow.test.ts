/** @vitest-environment jsdom */
import {createElement} from 'react';
import {cleanup,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/components/Navigation',()=>({Navigation:()=>createElement('nav',null,'Site navigation')}));
vi.mock('@/components/Footer',()=>({Footer:()=>createElement('footer',null,'Site footer')}));
vi.mock('next/link',()=>({default:({href,children,...rest}:{href:string;children:React.ReactNode})=>createElement('a',{href,...rest},children)}));
import SecurityPage from '../page';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('mounts a semantic source-scoped Bot response flow on the real Security page',()=>{
 render(createElement(SecurityPage));
 const figure=screen.getByRole('figure',{name:'Axiom Bot prompt and response flow'});
 const stages=within(figure).getByRole('list',{name:'Bot response stages'});
 expect(within(stages).getAllByRole('listitem')).toHaveLength(4);
 for(const title of ['Unsent local draft','Saved workspace draft','Explicit AI request','Recorded outcome'])expect(within(stages).getByRole('heading',{name:title})).toBeTruthy();
 expect(within(figure).getByText(/Source-inspected illustration/)).toBeTruthy();
 expect(within(figure).getByText(/not a recording or connection inspection/)).toBeTruthy();
});
it('explains save, exact prompt data and uncertain results without suggesting automatic tool use',()=>{
 render(createElement(SecurityPage));
 const figure=screen.getByRole('figure',{name:'Axiom Bot prompt and response flow'});
 expect(within(figure).getByText(/Send first saves new or changed text/)).toBeTruthy();
 expect(within(figure).getByText(/title, instruction and context/)).toBeTruthy();
 expect(within(figure).getByText(/fixed instructions and a response-format schema/)).toBeTruthy();
 expect(within(figure).getByText(/release ID\/version/)).toBeTruthy();
 expect(within(figure).getByText(/request, metering and receipt metadata/)).toBeTruthy();
 expect(within(figure).getByText(/check that same request; do not resend/)).toBeTruthy();
 const lane=within(figure).getByRole('group',{name:'Separate reviewed app-action workflow'});
 expect(lane.textContent).toContain('different authorized human');
 expect(lane.textContent).toContain('requester');
 expect(lane.textContent).toContain('does not call app tools');
});
it('retains visible provider/privacy limits and exposes no action or network behavior',()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 render(createElement(SecurityPage));
 const figure=screen.getByRole('figure',{name:'Axiom Bot prompt and response flow'});
 expect(within(figure).getByText(/not a complete egress inventory/)).toBeTruthy();
 expect(screen.getByText(/no guarantee about provider retention or model training/)).toBeTruthy();
 expect(screen.getByText(/Redaction utilities on selected paths are not proof/)).toBeTruthy();
 expect(screen.getByText(/No independent certification is claimed/)).toBeTruthy();
 expect(figure.querySelector('button,input,select,textarea,form,video,iframe')).toBeNull();
 expect(fetch).not.toHaveBeenCalled();
});
