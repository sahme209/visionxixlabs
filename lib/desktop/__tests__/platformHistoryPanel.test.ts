// @vitest-environment jsdom
import type {PlatformHistoryPage} from '../../governance/platform/historyContract';
import type {ReleasePlanResult} from '../../../desktop/src/lib/releaseOperationPlanTransport';
import {createElement} from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
const context=vi.hoisted(()=>({revision:0,config:{}}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{subscribeContext:()=>()=>{},getContextRevision:()=>context.revision,get config(){return context.config}}}));
import {PlatformHistoryPanel} from '../../../desktop/src/components/PlatformHistoryPanel';
afterEach(()=>{cleanup();context.revision=0});
const id='platform_action_11111111-1111-4111-8111-111111111111';
const entry:PlatformHistoryPage['entries'][number]={actionId:id,createdAt:'2026-11-12T00:00:00.000Z',status:'unknown',version:3,attemptCount:1,requesterUserId:'requester',reviewerUserId:'reviewer',planDigest:'a'.repeat(64),expiresAt:'2026-11-12T01:00:00.000Z',effectKinds:['growth.post.publish']};
const page:PlatformHistoryPage={entries:[entry],nextCursor:null,authority:'history_only',sourceValidation:'not_checked'};
it('loads history only on request and opens the saved reference without offering actions',async()=>{
 const list=vi.fn(async()=>({ok:true as const,data:page})),onSelect=vi.fn();render(createElement(PlatformHistoryPanel,{client:{list},onSelect}));expect(list).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Load saved actions'}));await screen.findByText('unknown');fireEvent.click(screen.getByRole('button',{name:'Inspect saved action'}));expect(onSelect).toHaveBeenCalledExactlyOnceWith(id);expect(screen.queryByRole('button',{name:/approve|execute|retry/i})).toBeNull();
});
it('discards a response after account context changes',async()=>{
 let resolve!:(v:ReleasePlanResult<PlatformHistoryPage>)=>void;const list=vi.fn(()=>new Promise<ReleasePlanResult<PlatformHistoryPage>>(r=>{resolve=r})),onSelect=vi.fn();render(createElement(PlatformHistoryPanel,{client:{list},onSelect}));fireEvent.click(screen.getByRole('button',{name:'Load saved actions'}));context.revision++;resolve({ok:true,data:page});await waitFor(()=>expect(list).toHaveBeenCalledTimes(1));expect(screen.queryByText('unknown')).toBeNull();expect(onSelect).not.toHaveBeenCalled();
});
