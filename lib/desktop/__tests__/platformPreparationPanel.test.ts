/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const context=vi.hoisted(()=>({revision:0,config:{}}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{getContextRevision:()=>context.revision,subscribeContext:()=>()=>{},get config(){return context.config}}}));
import {PlatformPreparationPanel} from '../../../desktop/src/components/PlatformPreparationPanel';
const requestId='11111111-1111-4111-8111-111111111111',actionId='platform_action_22222222-2222-4222-8222-222222222222';
function fixture(){const client={prepare:vi.fn(),lookup:vi.fn()},onSaved=vi.fn();return {client,onSaved,props:{client,onSaved,canPrepare:true}}}
function selectSource(){fireEvent.change(screen.getByLabelText('Draft ID'),{target:{value:'draft'}});fireEvent.change(screen.getByLabelText('Connected account ID'),{target:{value:'connection'}});fireEvent.change(screen.getByLabelText('Review expiry (UTC ISO time)'),{target:{value:'2099-01-01T00:00:00.000Z'}});fireEvent.click(screen.getByRole('button',{name:'Keep exact proposal reference'}));}
afterEach(()=>{cleanup();vi.unstubAllGlobals();context.revision=0});
it('retains a reference and exact selection before one save, then recovers only by lookup',async()=>{
 vi.stubGlobal('crypto',{randomUUID:()=>requestId});const f=fixture();f.client.prepare.mockResolvedValue({ok:false,error:'lost response',outcomeUnconfirmed:true});f.client.lookup.mockResolvedValue({ok:true,data:{requestId,found:true,actionId,authority:'history_only'}});
 render(createElement(PlatformPreparationPanel,f.props));selectSource();expect(screen.getByLabelText('Original proposal reference')).toHaveProperty('value',requestId);expect(f.client.prepare).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Save this exact proposal'}));await screen.findByText(/Saving is unconfirmed/);
 expect(f.client.prepare).toHaveBeenCalledExactlyOnceWith({operation:'publish',draftId:'draft',connectionId:'connection',expiresAt:'2099-01-01T00:00:00.000Z'},requestId,expect.any(AbortSignal));expect((screen.getByRole('button',{name:'Save this exact proposal'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByLabelText('Draft ID') as HTMLInputElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Look up this original reference'}));await waitFor(()=>expect(f.onSaved).toHaveBeenCalledExactlyOnceWith(actionId));expect(f.client.prepare).toHaveBeenCalledTimes(1);
});
it('a missing lookup never permits resubmission or creates a replacement reference',async()=>{
 vi.stubGlobal('crypto',{randomUUID:()=>requestId});const f=fixture();f.client.prepare.mockRejectedValue(Error('lost'));f.client.lookup.mockResolvedValue({ok:true,data:{requestId,found:false,authority:'history_only'}});render(createElement(PlatformPreparationPanel,f.props));selectSource();fireEvent.click(screen.getByRole('button',{name:'Save this exact proposal'}));await screen.findByText(/Saving is unconfirmed/);fireEvent.click(screen.getByRole('button',{name:'Look up this original reference'}));await screen.findByText(/No saved reference was found/);expect((screen.getByRole('button',{name:'Save this exact proposal'}) as HTMLButtonElement).disabled).toBe(true);expect(f.onSaved).not.toHaveBeenCalled();
});
it('rejects a mismatched save reply',async()=>{
 vi.stubGlobal('crypto',{randomUUID:()=>requestId});const f=fixture();f.client.prepare.mockResolvedValue({ok:true,data:{requestId:'33333333-3333-4333-8333-333333333333',actionId,historical:false,authority:'proposal_reference_only'}});render(createElement(PlatformPreparationPanel,f.props));selectSource();fireEvent.click(screen.getByRole('button',{name:'Save this exact proposal'}));await screen.findByText(/Saving is unconfirmed/);expect(f.onSaved).not.toHaveBeenCalled();
});

it('discards a delayed save after account context changes',async()=>{
 vi.stubGlobal('crypto',{randomUUID:()=>requestId});const f=fixture();let resolve!:(value:unknown)=>void;f.client.prepare.mockImplementation(()=>new Promise(r=>{resolve=r}));render(createElement(PlatformPreparationPanel,f.props));selectSource();fireEvent.click(screen.getByRole('button',{name:'Save this exact proposal'}));context.revision++;resolve({ok:true,data:{requestId,actionId,historical:false,authority:'proposal_reference_only'}});await waitFor(()=>expect(f.client.prepare).toHaveBeenCalledTimes(1));expect(f.onSaved).not.toHaveBeenCalled();
});
it('allows editing an unsent local selection but never after a save attempt',async()=>{
 vi.stubGlobal('crypto',{randomUUID:()=>requestId});const f=fixture();f.client.prepare.mockResolvedValue({ok:false,error:'unknown',outcomeUnconfirmed:true});render(createElement(PlatformPreparationPanel,f.props));selectSource();fireEvent.click(screen.getByRole('button',{name:'Edit unsent selection'}));expect((screen.getByLabelText('Draft ID') as HTMLInputElement).disabled).toBe(false);expect(f.client.prepare).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Keep exact proposal reference'}));fireEvent.click(screen.getByRole('button',{name:'Save this exact proposal'}));await screen.findByText(/Saving is unconfirmed/);expect(screen.queryByRole('button',{name:'Edit unsent selection'})).toBeNull();
});
it('retains the selected ready upload inside this exact proposal, without saving or changing the draft automatically',async()=>{
 vi.stubGlobal('crypto',{randomUUID:()=>requestId});const f=fixture();f.client.prepare.mockResolvedValue({ok:false,error:'lost',outcomeUnconfirmed:true});render(createElement(PlatformPreparationPanel,f.props));fireEvent.change(screen.getByLabelText(/Confirmed image upload reference/),{target:{value:actionId}});selectSource();expect((screen.getByLabelText(/Confirmed image upload reference/) as HTMLInputElement).disabled).toBe(true);expect(f.client.prepare).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Save this exact proposal'}));await screen.findByText(/Saving is unconfirmed/);expect(f.client.prepare).toHaveBeenCalledExactlyOnceWith({operation:'publish',draftId:'draft',connectionId:'connection',imageUploadActionId:actionId,expiresAt:'2099-01-01T00:00:00.000Z'},requestId,expect.any(AbortSignal));
});
