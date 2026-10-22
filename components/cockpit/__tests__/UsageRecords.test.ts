/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {UsageRecords} from '../UsageRecords';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
const row={id:'one',createdAt:'2026-10-22T12:00:00Z',provider:'gateway',model:'example',status:'pending',inputTokens:20,outputTokens:4,settledCents:null};
function reply(offset=0){return {ok:true,data:{month:'2026-10',offset,hasMore:offset===0,rows:[{...row,id:offset?'two':'one',model:offset?'second':'example'}]}}}
it('filters and pages the server ledger without presenting pending usage as zero cost',async()=>{
 const fetcher=vi.fn(async(input: string)=>new Response(JSON.stringify(reply(input.includes('offset=50')?50:0)),{status:200}));vi.stubGlobal('fetch',fetcher);
 render(createElement(UsageRecords));await screen.findByText('example');expect(screen.getByText('Awaiting settlement')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Export this page'}).getAttribute('href')).toContain('format=csv');
 fireEvent.click(screen.getByRole('button',{name:'Older records'}));await screen.findByText('second');
 fireEvent.change(screen.getByLabelText('Usage settlement'),{target:{value:'settled'}});await screen.findByText('example');
 expect(fetcher.mock.calls.at(-1)![0]).toContain('status=settled');expect(fetcher.mock.calls.at(-1)![0]).not.toContain('offset=50');
});
it('distinguishes a failed read from an empty result and recovers on refresh',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({ok:true,data:{month:'2026-10',offset:0,hasMore:false,rows:[]}}),{status:200}));vi.stubGlobal('fetch',fetcher);
 render(createElement(UsageRecords));await screen.findByRole('alert');expect(screen.queryByText('No usage records match these filters.')).toBeNull();
 expect(screen.queryByRole('link',{name:'Export this page'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Refresh usage'}));await screen.findByText('No usage records match these filters.');
});
it('cancels stale reads when filters change',async()=>{
 const requests:Array<{signal:AbortSignal,resolve:(value:Response)=>void}>=[];vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise<Response>(resolve=>requests.push({signal:options.signal,resolve}))));
 render(createElement(UsageRecords));await waitFor(()=>expect(requests).toHaveLength(1));fireEvent.change(screen.getByLabelText('Usage settlement'),{target:{value:'pending'}});await waitFor(()=>expect(requests).toHaveLength(2));expect(requests[0].signal.aborted).toBe(true);
 requests[1].resolve(new Response(JSON.stringify(reply()),{status:200}));await screen.findByText('example');
});
