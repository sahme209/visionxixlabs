/** @vitest-environment jsdom */
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {InvoicePanel} from '../InvoicePanel';
const fetcher=vi.fn();
const row={id:'in_one',number:'INV-1',status:'paid',currency:'usd',totalMinor:2900,paidMinor:2900,dueMinor:2900,createdAt:'2026-10-22T00:00:00Z',hostedUrl:'https://invoice.stripe.com/i/fixture',pdfUrl:'https://pay.stripe.com/invoice/fixture/pdf'};
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('fetch',fetcher);fetcher.mockImplementation(async(url:string)=>new Response(JSON.stringify({ok:true,data:{state:'verified',invoices:[url.includes('after=')?{...row,id:'in_two',number:'INV-2'}:row],hasMore:!url.includes('after='),nextCursor:url.includes('after=')?null:'in_one'}}),{status:200}))});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('renders verified invoices and supports next, previous and filter reset',async()=>{
 render(createElement(InvoicePanel,{canRead:true}));await screen.findByText('INV-1');expect(screen.getByText('$29.00')).toBeTruthy();expect(screen.getByRole('link',{name:'View invoice INV-1'}).getAttribute('href')).toBe(row.hostedUrl);
 fireEvent.click(screen.getByRole('button',{name:'Older invoices'}));await screen.findByText('INV-2');expect(String(fetcher.mock.calls.at(-1)?.[0])).toContain('after=in_one');
 fireEvent.click(screen.getByRole('button',{name:'Newer invoices'}));await screen.findByText('INV-1');
 fireEvent.change(screen.getByRole('combobox',{name:'Invoice status'}),{target:{value:'paid'}});await waitFor(()=>expect(String(fetcher.mock.calls.at(-1)?.[0])).toContain('status=paid'));
 expect(String(fetcher.mock.calls.at(-1)?.[0])).not.toContain('after=');
});
it('does not request invoices without allowed financial access',()=>{render(createElement(InvoicePanel,{canRead:false}));expect(fetcher).not.toHaveBeenCalled();expect(screen.getByText(/owner or administrator/)).toBeTruthy()});
it('distinguishes provider failure from no invoices',async()=>{fetcher.mockResolvedValue(new Response(JSON.stringify({ok:false,error:'private-error'}),{status:503}));render(createElement(InvoicePanel,{canRead:true}));await screen.findByRole('alert');expect(screen.queryByText('No invoices match this filter.')).toBeNull();expect(document.body.textContent).not.toContain('private-error')});
it('does not create invoices or infer payment when no billing customer exists',async()=>{fetcher.mockResolvedValue(new Response(JSON.stringify({ok:true,data:{state:'no_customer',invoices:[],hasMore:false,nextCursor:null}}),{status:200}));render(createElement(InvoicePanel,{canRead:true}));await screen.findByText('No billing customer is linked to this workspace.');expect(screen.queryByRole('button',{name:/pay|create/i})).toBeNull()});
