// @vitest-environment jsdom
import {createElement} from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
vi.mock('next/link',()=>({default:({href,children,...props}:any)=>createElement('a',{...props,href},children)}));
vi.mock('framer-motion',()=>({
 AnimatePresence:({children}:any)=>children,
 motion:new Proxy({}, {get:(_target,tag:string)=>({children,initial,animate,exit,transition,...props}:any)=>createElement(tag,props,children)}),
}));
import {ContactClient} from '../ContactClient';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function fill(){
 render(createElement(ContactClient));
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Synthetic Contact'}});
 fireEvent.change(screen.getByLabelText('Work email'),{target:{value:'contact@example.invalid'}});
 fireEvent.change(screen.getByLabelText('What went wrong?'),{target:{value:'Synthetic recording check. No real support request.'}});
 fireEvent.submit(screen.getByRole('button',{name:'Send →'}).closest('form')!);
}
it.each([
 {success:true,accepted:false},
 {success:true,accepted:true},
 {success:true,referenceId:'synthetic-reference'},
])('does not claim durable recording from an unconfirmed 200 body: %j',async body=>{
 const fetch=vi.fn(async()=>({ok:true,json:async()=>body}));vi.stubGlobal('fetch',fetch);fill();
 const alert=await screen.findByRole('alert');
 expect(alert.textContent).toContain('could not confirm');
 expect(screen.queryByText('Your message was durably accepted.')).toBeNull();
 expect((screen.getByLabelText('What went wrong?') as HTMLTextAreaElement).value).toContain('Synthetic recording check');
 expect(fetch).toHaveBeenCalledTimes(1);
});
it.each(['sent','failed','not_configured'])('shows the saved reference separately from email status %s',async delivery=>{
 const fetch=vi.fn(async()=>({ok:true,json:async()=>({accepted:true,referenceId:'synthetic-reference',delivery})}));vi.stubGlobal('fetch',fetch);fill();
 const status=await screen.findByRole('status');
 expect(status.textContent).toContain('Your message was durably accepted.');
 expect(status.textContent).toContain('synthetic-reference');
 expect(status.textContent).toContain(delivery.replace('_',' '));
 expect(status.textContent).toContain('No response-time or support entitlement is implied.');
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('preserves the message on an error response without automatically resubmitting',async()=>{
 const fetch=vi.fn(async()=>({ok:false,json:async()=>({error:'Synthetic server refusal'})}));vi.stubGlobal('fetch',fetch);fill();
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Synthetic server refusal'));
 expect((screen.getByLabelText('What went wrong?') as HTMLTextAreaElement).value).toContain('Synthetic recording check');
 expect(fetch).toHaveBeenCalledTimes(1);
});
