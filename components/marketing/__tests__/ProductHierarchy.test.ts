// @vitest-environment jsdom
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
vi.mock('next-auth',()=>({getServerSession:async()=>null}));
vi.mock('@/lib/auth',()=>({authOptions:{}}));
vi.mock('@/components/Navigation',()=>({Navigation:()=>null}));
vi.mock('@/components/Footer',()=>({Footer:()=>null}));
vi.mock('@/components/marketing/CinematicAxiomDemo',()=>({CinematicAxiomDemo:()=>createElement('div',null,'Scripted demo fixture')}));
vi.mock('next/link',()=>({default:({href,children,...props}:any)=>createElement('a',{...props,href},children)}));
import ProductPage from '@/app/product/page';
import Home from '@/app/page';
afterEach(() => {
 cleanup();
 window.history.replaceState(null, "", "/");
});
it('explains deployment decisions and puts the conceptual workflow before the scripted preview',()=>{
 render(createElement(ProductPage));
 expect(screen.getByRole('heading',{level:1,name:/Deployment decisions.*Clear from the start/i})).toBeDefined();
 const main=screen.getByRole('main'),first=main.querySelector('section')!;
 const workflow=within(first).getByRole('list',{name:'Conceptual workflow'});
 expect(first.contains(workflow)).toBe(true);
 expect(within(first).getAllByRole('list',{name:'Conceptual workflow'})).toHaveLength(1);
 const demoHeading=screen.getByRole('heading',{name:'Scripted interactive preview'});
 expect(workflow.compareDocumentPosition(demoHeading)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(within(first).getByRole('link',{name:'Download V19'}).getAttribute('href')).toBe('/download');
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
it('retains the detailed scenario controls and record inspection on Product behind native disclosures',()=>{
 render(createElement(ProductPage));
 const scenarios=screen.getByText('Inspect deployment scenarios and stages').closest('details')!;
 expect(scenarios.id).toBe('deployment-model');expect(scenarios.open).toBe(false);
 fireEvent.click(within(scenarios).getByText('Inspect deployment scenarios and stages'));
 expect(scenarios.open).toBe(true);
 expect(within(scenarios).getByRole('group',{name:'Scenario'})).toBeDefined();
 expect(within(scenarios).getByRole('group',{name:'Inspect a stage'}).querySelectorAll('button')).toHaveLength(8);
 fireEvent.click(within(scenarios).getByRole('button',{name:'Failed scan'}));
 expect(within(scenarios).getByRole('button',{name:'Failed scan'}).getAttribute('aria-pressed')).toBe('true');
 const records=screen.getByText('Inspect the records behind a decision').closest('details')!;
 expect(records.id).toBe('decision-records');expect(records.open).toBe(false);
 fireEvent.click(within(records).getByText('Inspect the records behind a decision'));
 expect(records.open).toBe(true);
 expect(within(records).getByRole('list',{name:'Conceptual workflow'}).querySelectorAll('button')).toHaveLength(5);
 expect(within(records).getByText(/no actions are performed/)).toBeDefined();
});

it('keeps the homepage scenario destination outside the sticky card containing block',async()=>{
 const view=render(await Home());
 const section=screen.getByRole('region',{name:/Frame the request\.\s*Follow the evidence\./});
 const link=screen.getByRole('link',{name:'Inspect deployment scenarios and stages'});
 expect(link.getAttribute('href')).toBe('/product#deployment-model');
 expect(section.contains(link)).toBe(false);
 expect(section.nextElementSibling?.contains(link)).toBe(true);
 expect(link.classList.contains('min-h-11')).toBe(true);
 expect(link.classList.contains('pt-6')).toBe(false);
 expect(section.compareDocumentPosition(link)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(view.container.querySelectorAll('.public-feature-panel')).toHaveLength(3);
});

it('opens and focuses only the disclosure named by the incoming Product link',()=>{
 window.history.replaceState(null, "", "/product#deployment-model");
 render(createElement(ProductPage));
 const summary=screen.getByText('Inspect deployment scenarios and stages');
 const records=screen.getByText('Inspect the records behind a decision').closest('details')!;
 expect(summary.closest('details')?.open).toBe(true);
 expect(document.activeElement).toBe(summary);
 expect(records.open).toBe(false);
 fireEvent.click(summary);
 expect(summary.closest('details')?.open).toBe(false);
 window.history.replaceState(null, "", "/product#decision-records");
 fireEvent(window,new HashChangeEvent("hashchange"));
 expect(records.open).toBe(true);
 expect(document.activeElement).toBe(records.querySelector('summary'));
 expect(summary.closest('details')?.open).toBe(false);
});
