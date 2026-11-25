// @vitest-environment jsdom
import {createElement} from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
vi.mock('next/link',()=>({default:({href,children,...props}:any)=>createElement('a',{...props,href},children)}));
vi.mock('framer-motion',()=>({
 AnimatePresence:({children}:any)=>children,
 motion:new Proxy({}, {get(target,tag:string) {
  if (!Reflect.has(target,tag)) {
   Reflect.set(target,tag,({children,initial,animate,exit,transition,...props}:any)=>createElement(tag,props,children));
  }
  return Reflect.get(target,tag);
 }}),
}));
import {ContactClient} from '../ContactClient';
import ContactPage from '../page';
import {stageSupportContactDraft} from '@/lib/support/contactDraft';
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
 expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Your message was durably accepted.'}));
 expect(fetch).toHaveBeenCalledTimes(1);
});

it('selects Security when opening the security review link',async()=>{
 render(await ContactPage({searchParams:Promise.resolve({topic:'security'})}));
 expect(screen.getByRole('button',{name:'Security'}).getAttribute('aria-pressed')).toBe('true');
});

it('allows one pending submission and permits a manual retry after refusal',async()=>{
 let refuse: (response: {ok: boolean; json: () => Promise<object>}) => void = () => {};
 const pending = new Promise<{ok: boolean; json: () => Promise<object>}>((resolve)=>{refuse=resolve;});
 const fetch=vi.fn().mockReturnValueOnce(pending).mockResolvedValue({ok:false,json:async()=>({error:'Retry also refused'})});
 vi.stubGlobal('fetch',fetch);
 fill();
 const submit=screen.getByRole('button',{name:'Sending…'});
 fireEvent.submit(submit.closest('form')!);
 expect(fetch).toHaveBeenCalledTimes(1);
 refuse({ok:false,json:async()=>({error:'First request refused'})});
 await screen.findByText('First request refused');
 expect((screen.getByLabelText('What went wrong?') as HTMLTextAreaElement).readOnly).toBe(false);
 fireEvent.submit(screen.getByRole('button',{name:'Send →'}).closest('form')!);
 await screen.findByText('Retry also refused');
 expect(fetch).toHaveBeenCalledTimes(2);
});
it('preserves the message on an error response without automatically resubmitting',async()=>{
 const fetch=vi.fn(async()=>({ok:false,json:async()=>({error:'Synthetic server refusal'})}));vi.stubGlobal('fetch',fetch);fill();
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Synthetic server refusal'));
 expect((screen.getByLabelText('What went wrong?') as HTMLTextAreaElement).value).toContain('Synthetic recording check');
 expect(fetch).toHaveBeenCalledTimes(1);
});

it('opens the Support topic with an editable one-time draft and leaves submission to the visitor', () => {
 const fetch = vi.fn();
 vi.stubGlobal('fetch', fetch);
 stageSupportContactDraft("How do I find the failed step?");
 const view = render(createElement(ContactClient, {intent: 'ask-axiom'}));
 const message = screen.getByLabelText('What went wrong?') as HTMLTextAreaElement;
 expect(screen.getByRole('button', {name: 'Support'}).getAttribute('aria-pressed')).toBe('true');
 expect(message.value).toContain("How do I find the failed step?");
 expect(document.activeElement).toBe(message);
 fireEvent.change(message, {target: {value: 'I found the failed step and need help reading it.'}});
 expect(message.value).toBe('I found the failed step and need help reading it.');
 expect(fetch).not.toHaveBeenCalled();
 view.unmount();
 render(createElement(ContactClient, {intent: 'ask-axiom'}));
 expect((screen.getByLabelText('What went wrong?') as HTMLTextAreaElement).value).toBe('');
});

it('opens older escalations with the Support topic and ignores questions in the URL', async () => {
 const query = {topic: 'ask-axiom', question: 'Private text from an old URL'};
 render(await ContactPage({searchParams: Promise.resolve(query)}));
 expect(screen.getByRole('button', {name: 'Support'}).getAttribute('aria-pressed')).toBe('true');
 expect((screen.getByLabelText('What went wrong?') as HTMLTextAreaElement).value).toBe('');
});
