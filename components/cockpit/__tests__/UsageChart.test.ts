/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {UsageChart} from '../UsageChart';
const totals={calls:2,inputTokens:200,outputTokens:50,settledCents:7,pendingCalls:1};
const data={month:'2026-10',group:'model',totals,days:[{day:'2026-10-02',...totals},{day:'2026-10-03',calls:0,inputTokens:0,outputTokens:0,settledCents:0,pendingCalls:0}],groups:[{label:'example-model',...totals}],groupsLimited:false};
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('renders month totals, inspectable daily activity and verified provider grouping',async()=>{
 const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify({ok:true,data:url.includes('group=provider')?{...data,group:'provider',groups:[{label:'gateway',...totals}]}:data}),{status:200}));vi.stubGlobal('fetch',fetcher);
 render(createElement(UsageChart,{month:'2026-10',status:'pending',revision:0}));await screen.findByText('example-model');expect(fetcher.mock.calls[0][0]).toContain('view=analytics');expect(fetcher.mock.calls[0][0]).toContain('status=pending');
 fireEvent.click(screen.getByRole('button',{name:'Inspect usage for 2026-10-02'}));expect(screen.getByRole('status').textContent).toContain('1 awaiting settlement');fireEvent.keyDown(screen.getByRole('button',{name:'Inspect usage for 2026-10-02'}),{key:'ArrowRight'});expect(document.activeElement?.getAttribute('aria-label')).toBe('Inspect usage for 2026-10-03');
 fireEvent.click(screen.getByRole('button',{name:'Settled debit'}));expect(screen.getByRole('button',{name:'Settled debit'}).getAttribute('aria-pressed')).toBe('true');
 fireEvent.change(screen.getByLabelText('Group usage by'),{target:{value:'provider'}});await screen.findByText('gateway');expect(fetcher.mock.calls.at(-1)![0]).toContain('group=provider');
});
it('distinguishes unavailable analytics from zero usage and permits retry',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({ok:true,data}),{status:200}));vi.stubGlobal('fetch',fetcher);render(createElement(UsageChart,{month:'',status:'',revision:0}));await screen.findByRole('alert');expect(screen.queryByText('No usage matches this selection.')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Refresh chart'}));await screen.findByText('example-model')});
it('aborts stale month responses',async()=>{const requests:Array<{signal:AbortSignal,resolve:(r:Response)=>void}>=[];vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise<Response>(resolve=>requests.push({signal:options.signal,resolve}))));const view=render(createElement(UsageChart,{month:'2026-09',status:'',revision:0}));await waitFor(()=>expect(requests).toHaveLength(1));view.rerender(createElement(UsageChart,{month:'2026-10',status:'',revision:0}));await waitFor(()=>expect(requests).toHaveLength(2));expect(requests[0].signal.aborted).toBe(true);requests[1].resolve(new Response(JSON.stringify({ok:true,data}),{status:200}));await screen.findByText('example-model')});
