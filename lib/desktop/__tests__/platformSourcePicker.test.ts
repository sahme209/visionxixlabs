/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import type {PlatformSourceClient} from '../../../desktop/src/lib/platformReview';
const context=vi.hoisted(()=>({revision:0,config:{}}));vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{getContextRevision:()=>context.revision,subscribeContext:()=>()=>{},get config(){return context.config}}}));
import {PlatformSourcePicker} from '../../../desktop/src/components/PlatformSourcePicker';
const draft={kind:'drafts' as const,entries:[{id:'draft',label:'Selected draft',labelTruncated:false,status:'drafted',updatedAt:'2026-11-12T00:00:00Z'}],nextCursor:null,authority:'selection_metadata_only' as const};
afterEach(()=>{cleanup();context.revision=0});
it('reads metadata only on request and selects an exact source without saving',async()=>{
 const list=vi.fn<PlatformSourceClient['list']>().mockResolvedValue({ok:true,data:draft}),onSelect=vi.fn();render(createElement(PlatformSourcePicker,{client:{list},onSelect,disabled:false}));expect(list).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Find drafts'}));await screen.findByText('Selected draft');fireEvent.click(screen.getByRole('button',{name:'Select draft'}));expect(onSelect).toHaveBeenCalledExactlyOnceWith('drafts','draft');expect(list).toHaveBeenCalledExactlyOnceWith('drafts',null,expect.any(AbortSignal));
});
it('refuses metadata for the wrong catalog',async()=>{
 const list=vi.fn<PlatformSourceClient['list']>().mockResolvedValue({ok:true,data:draft}),onSelect=vi.fn();render(createElement(PlatformSourcePicker,{client:{list},onSelect,disabled:false}));fireEvent.click(screen.getByRole('button',{name:'Find accounts'}));await screen.findByText(/Source metadata could not be verified/);expect(screen.queryByText('Selected draft')).toBeNull();expect(onSelect).not.toHaveBeenCalled();
});
it('does not select expired or disconnected account metadata',async()=>{
 const list=vi.fn<PlatformSourceClient['list']>().mockResolvedValue({ok:true,data:{kind:'accounts',entries:[{id:'account',label:'Account',labelTruncated:false,status:'connected',author:'urn:li:person:author',updatedAt:'2026-11-12T00:00:00Z',expiresAt:'2020-01-01T00:00:00Z'}],nextCursor:null,authority:'selection_metadata_only'}}),onSelect=vi.fn();render(createElement(PlatformSourcePicker,{client:{list},onSelect,disabled:false}));fireEvent.click(screen.getByRole('button',{name:'Find accounts'}));await screen.findByText('urn:li:person:author');expect((screen.getByRole('button',{name:'Select account'}) as HTMLButtonElement).disabled).toBe(true);expect(onSelect).not.toHaveBeenCalled();
});

it('discards delayed metadata after the account context changes',async()=>{
 let resolve!:(v:Awaited<ReturnType<PlatformSourceClient['list']>>)=>void;const list=vi.fn<PlatformSourceClient['list']>().mockImplementation(()=>new Promise(r=>{resolve=r})),onSelect=vi.fn();render(createElement(PlatformSourcePicker,{client:{list},onSelect,disabled:false}));fireEvent.click(screen.getByRole('button',{name:'Find drafts'}));context.revision++;resolve({ok:true,data:draft});await waitFor(()=>expect(list).toHaveBeenCalledTimes(1));expect(screen.queryByText('Selected draft')).toBeNull();expect(onSelect).not.toHaveBeenCalled();
});
it('lead mode selects metadata without treating package presence as source validation',async()=>{
 const list=vi.fn<PlatformSourceClient['list']>().mockResolvedValue({ok:true,data:{kind:'leads',entries:[{id:'lead',label:'Company',labelTruncated:false,status:'package_ready',updatedAt:'2026-11-12T00:00:00Z',hasSavedPackage:true},{id:'empty',label:'No package',labelTruncated:false,status:'created',updatedAt:'2026-11-12T00:00:00Z',hasSavedPackage:false}],nextCursor:null,authority:'selection_metadata_only'}}),onSelect=vi.fn();render(createElement(PlatformSourcePicker,{client:{list},onSelect,disabled:false,mode:'leads'}));expect(list).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Find existing leads'}));await screen.findByText('Company');const buttons=screen.getAllByRole('button',{name:'Select lead'});expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);fireEvent.click(buttons[0]);expect(onSelect).toHaveBeenCalledExactlyOnceWith('leads','lead');expect(screen.getByText(/Package presence is not validation/)).toBeTruthy();
});
