/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const context=vi.hoisted(()=>({revision:0,config:{}}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{getContextRevision:()=>context.revision,subscribeContext:()=>()=>{},config:context.config}}));
import {PlatformReviewPanel} from '../../../desktop/src/components/PlatformReviewPanel';
import {platformInspectionSchema} from '../../governance/platform/viewContract';
const digest='a'.repeat(64),action=()=>platformInspectionSchema.parse({actionId:'platform_action_11111111-1111-4111-8111-111111111111',version:0,status:'proposed',attemptCount:0,requesterUserId:'requester',reviewerUserId:null,plan:{format:1,scope:'platform',digest,sourceDigest:digest,expiresAt:'2099-01-01T00:00:00Z',effects:[{id:'post',kind:'growth.post.publish',target:{draftId:'draft',connectionId:'connection',connectionRevision:digest,author:'urn:li:person:author',renderedPayloadDigest:digest}}]},expired:false,effects:[{id:'post',status:'not_started'}],authority:'history_only',sourceValidation:'not_checked'});
function fixture(user='reviewer'){const client={approve:vi.fn(),inspect:vi.fn(),preview:vi.fn(async()=>({ok:true as const,data:{actionId:action().actionId,planDigest:digest,sourceDigest:digest,effectId:'post',renderedPost:JSON.stringify({author:'urn:li:person:author',commentary:'Exact reviewed post text',visibility:'PUBLIC'}),authority:'review_preview_only' as const}}))},onRecorded=vi.fn();return {client,onRecorded,props:{action:action(),client,currentUserId:user,canApprove:true,onRecorded}}}
afterEach(()=>{cleanup();context.revision=0});
it('shows the exact operation and target without deciding automatically or permitting self-review',()=>{
 const f=fixture('requester');render(createElement(PlatformReviewPanel,f.props));expect(screen.getByText('Publish LinkedIn post')).toBeTruthy();expect(screen.getByText('urn:li:person:author')).toBeTruthy();expect((screen.getByRole('button',{name:'Record independent approval'}) as HTMLButtonElement).disabled).toBe(true);expect(f.client.approve).not.toHaveBeenCalled();
});
it('requires deliberate confirmation and holds an uncertain decision for explicit inspection',async()=>{
 const f=fixture();f.client.approve.mockResolvedValue({ok:false,error:'unconfirmed',outcomeUnconfirmed:true});render(createElement(PlatformReviewPanel,f.props));fireEvent.click(screen.getByRole('button',{name:'Load exact source preview'}));await screen.findByText('Exact reviewed post text');fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Record independent approval'}));
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('unconfirmed'));expect(f.client.approve).toHaveBeenCalledTimes(1);expect((screen.getByRole('button',{name:'Record independent approval'}) as HTMLButtonElement).disabled).toBe(true);expect(f.onRecorded).not.toHaveBeenCalled();
});
it('a changed desktop context discards a delayed decision response',async()=>{
 const f=fixture();let resolve!:(value:unknown)=>void;f.client.approve.mockImplementation(()=>new Promise(r=>{resolve=r}));render(createElement(PlatformReviewPanel,f.props));fireEvent.click(screen.getByRole('button',{name:'Load exact source preview'}));await screen.findByText('Exact reviewed post text');fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Record independent approval'}));context.revision++;
 resolve({ok:true,data:{...action(),status:'approved',version:1,reviewerUserId:'reviewer'}});await waitFor(()=>expect(f.client.approve).toHaveBeenCalledTimes(1));expect(f.onRecorded).not.toHaveBeenCalled();
});
it('unknown outcomes remain visible and offer inspection rather than another action',()=>{
 const f=fixture();f.props.action=platformInspectionSchema.parse({...action(),status:'unknown',version:3,attemptCount:1,reviewerUserId:'reviewer',effects:[{id:'post',status:'unknown'}]});render(createElement(PlatformReviewPanel,f.props));expect(screen.getByRole('alert').textContent).toContain('Do not resend');expect(screen.queryByRole('button',{name:'Record independent approval'})).toBeNull();
});
it('missing or mismatched source preview cannot enable independent approval',async()=>{
 const f=fixture();f.client.preview.mockResolvedValueOnce({ok:true,data:{actionId:action().actionId,planDigest:'b'.repeat(64),sourceDigest:digest,effectId:'post',renderedPost:JSON.stringify({author:'urn:li:person:author',commentary:'wrong plan',visibility:'PUBLIC'}),authority:'review_preview_only'}});
 render(createElement(PlatformReviewPanel,f.props));expect((screen.getByRole('button',{name:'Record independent approval'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Load exact source preview'}));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('does not match'));expect((screen.getByRole('button',{name:'Record independent approval'}) as HTMLButtonElement).disabled).toBe(true);expect(f.client.approve).not.toHaveBeenCalled();
});
