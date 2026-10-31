/** @vitest-environment jsdom */
import {createElement} from 'react';
import {it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,cleanup,act} from '@testing-library/react';
const mock=vi.hoisted(()=>({load:vi.fn(),revision:0,listeners:new Set<()=>void>()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{aiCallLog:mock.load,getContextRevision:()=>mock.revision,subscribeContext:(listener:()=>void)=>{mock.listeners.add(listener);return ()=>mock.listeners.delete(listener)}}}));
import {AiCallLogView} from '../../../desktop/src/views/AiCallLogView';
afterEach(cleanup);
beforeEach(()=>{mock.load.mockReset();mock.revision=0});
it('shows reported total-only usage without inferring a breakdown or treating missing data as zero',async()=>{
 mock.load.mockResolvedValue({ok:true,data:{generatedAt:'2026-10-31T00:00:00Z',engines:[],summary:{total:1,ok:1,error:0,timeout:0,shortCircuit:0,totalLatencyMs:10,totalPromptTokens:0,totalCompletionTokens:0},calls:[{id:'fixture',organizationId:'org',engineName:'ad_hoc',model:'fixture/model',outcome:'ok',errorMessage:null,latencyMs:10,promptTokens:null,completionTokens:0,totalTokens:1234,startedAtIso:'2026-10-31T00:00:00Z'}]}});
 render(createElement(AiCallLogView));
 expect(await screen.findByRole('columnheader',{name:'Input tokens'})).toBeTruthy();
 expect(screen.getByRole('columnheader',{name:'Output tokens'})).toBeTruthy();
 expect(screen.getByRole('columnheader',{name:'Total tokens'})).toBeTruthy();
 expect(screen.getByRole('cell',{name:'Not reported'})).toBeTruthy();
 expect(screen.getByRole('cell',{name:'0'})).toBeTruthy();
 expect(screen.getByRole('cell',{name:'1,234'})).toBeTruthy();
 expect(mock.load).toHaveBeenCalledTimes(1);
});

it('clears old workspace data immediately and discards a late previous-workspace response',async()=>{
 let finishOld!:(v:unknown)=>void;
 const data=(model:string)=>({ok:true,data:{generatedAt:'2026-10-31T00:00:00Z',engines:[],summary:{total:1,ok:1,error:0,timeout:0,shortCircuit:0,totalLatencyMs:1,totalPromptTokens:0,totalCompletionTokens:0},calls:[{id:model,organizationId:model,engineName:'ad_hoc',model,outcome:'ok',errorMessage:null,latencyMs:1,promptTokens:null,completionTokens:null,totalTokens:null,startedAtIso:'2026-10-31T00:00:00Z'}]}});
 mock.load.mockResolvedValueOnce(data('old-workspace-model')).mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve})).mockResolvedValueOnce(data('new-workspace-model'));
 render(createElement(AiCallLogView));
 expect(await screen.findByText('old-workspace-model')).toBeTruthy();
 await act(async()=>{screen.getByRole('button',{name:'Refresh'}).click()});
 expect(screen.queryByText('old-workspace-model')).toBeNull();
 await act(async()=>{mock.revision++;mock.listeners.forEach(listener=>listener())});
 expect(await screen.findByText('new-workspace-model')).toBeTruthy();
 await act(async()=>{finishOld(data('late-private-old-model'));await Promise.resolve()});
 expect(screen.queryByText('late-private-old-model')).toBeNull();
 expect(screen.getByText('new-workspace-model')).toBeTruthy();
});
