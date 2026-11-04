// @vitest-environment jsdom
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
vi.mock('@/components/Navigation',()=>({Navigation:()=>null}));
vi.mock('@/components/Footer',()=>({Footer:()=>null}));
vi.mock('@/components/marketing/CinematicAxiomDemo',()=>({CinematicAxiomDemo:()=>createElement('div',null,'Scripted demo fixture')}));
vi.mock('next/link',()=>({default:({href,children,...props}:any)=>createElement('a',{...props,href},children)}));
import ProductPage from '@/app/product/page';
afterEach(cleanup);
it('explains deployment decisions and puts the conceptual workflow before the scripted preview',()=>{
 render(createElement(ProductPage));
 expect(screen.getByRole('heading',{level:1,name:/Deployment decisions.*Clear from the start/i})).toBeDefined();
 const main=screen.getByRole('main'),first=main.querySelector('section')!;
 const workflow=screen.getByRole('list',{name:'Conceptual workflow'});
 expect(first.contains(workflow)).toBe(true);
 expect(screen.getAllByRole('list',{name:'Conceptual workflow'})).toHaveLength(1);
 const demoHeading=screen.getByRole('heading',{name:'Scripted interactive preview'});
 expect(workflow.compareDocumentPosition(demoHeading)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(within(first).getByRole('link',{name:'Download Axiom Agent'}).getAttribute('href')).toBe('/download');
 expect(within(first).getByRole('link',{name:'Read the workflow guide'}).getAttribute('href')).toBe('/docs/approval-workflow');
});
it('keeps conceptual scope and incomplete Governance visible beside the first workflow',()=>{
 render(createElement(ProductPage));
 const first=screen.getByRole('main').querySelector('section')!;
 expect(within(first).getByText(/Conceptual illustration · local explanation only/)).toBeDefined();
 expect(within(first).getByText(/Check your installed version/)).toBeDefined();
 expect(within(first).getByText(/Governance Intelligence remains incomplete/)).toBeDefined();
 expect(screen.getByText(/This preview does not run provider actions/)).toBeDefined();
});
