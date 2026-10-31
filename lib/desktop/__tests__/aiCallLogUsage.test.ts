/** @vitest-environment jsdom */
import {createElement} from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
const mock=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{aiCallLog:mock.load}}));
import {AiCallLogView} from '../../../desktop/src/views/AiCallLogView';
afterEach(cleanup);
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
