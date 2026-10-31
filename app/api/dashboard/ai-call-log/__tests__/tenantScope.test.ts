import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({context:vi.fn(),findMany:vi.fn(),groupBy:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:m.context}));
vi.mock('@/lib/db',()=>({prisma:{aiCallLog:{findMany:m.findMany,groupBy:m.groupBy}}}));
vi.mock('@/lib/billing/aiCallCostAttribution',()=>({rollupAiCallCost:async()=>({attributedCallCount:0,unattributedCallCount:0,totalCents:0,perModel:[]}),formatCents:()=>'$0.00'}));
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw new Error('REDIRECT:'+url)}}));
import {GET as list} from '../route';
import {GET as csv} from '../export.csv/route';
import enginePage from '@/app/dashboard/ai-call-log/[engine]/page';
afterEach(()=>vi.unstubAllGlobals());
beforeEach(()=>{vi.stubGlobal("React",React);vi.resetAllMocks();m.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-a',roles:['OWNER']});m.findMany.mockResolvedValue([]);m.groupBy.mockResolvedValue([])});
it.each([list,csv])('refuses global scope before any database read even for an org owner',async handler=>{
 const result=await handler(new NextRequest('http://localhost/api/dashboard/ai-call-log?scope=global'));
 expect(result.status).toBe(403);expect(m.findMany).not.toHaveBeenCalled();
});
it.each([list,csv])('always binds ordinary log reads to the authenticated organization',async handler=>{
 const result=await handler(new NextRequest('http://localhost/api/dashboard/ai-call-log?organizationId=org-b'));
 expect(result.status).toBe(200);expect(m.findMany).toHaveBeenCalled();
 for(const [query] of m.findMany.mock.calls)expect(query.where.organizationId).toBe('org-a');
});
it('refuses a direct global engine page before database access',async()=>{
 await expect(enginePage({params:Promise.resolve({engine:'council_voter'}),searchParams:Promise.resolve({scope:'global'})})).rejects.toThrow('REDIRECT:/dashboard/ai-call-log');
 expect(m.findMany).not.toHaveBeenCalled();expect(m.groupBy).not.toHaveBeenCalled();
});

it('redacts historical diagnostic credentials in CSV output',async()=>{
 const secret='ghp_'+'a'.repeat(36);
 m.findMany.mockResolvedValue([{id:'fixture',organizationId:'org-a',engineName:'ad_hoc',model:secret,outcome:'error',errorMessage:secret,latencyMs:1,promptTokens:null,completionTokens:null,totalTokens:null,startedAt:new Date('2026-10-31T00:00:00Z')}]);
 const response=await csv(new NextRequest('http://localhost/api/dashboard/ai-call-log/export.csv'));
 const text=await response.text();expect(text).not.toContain(secret);expect(text).toContain('[REDACTED-GITHUB-PAT]');
});
it('redacts historical engine diagnostics before truncation and rendering',async()=>{
 const secret='ghp_'+'b'.repeat(36);
 m.findMany.mockResolvedValue([{id:'fixture',organizationId:'org-a',engineName:'ad_hoc',model:secret,outcome:'error',errorMessage:'x'.repeat(100)+' '+secret,latencyMs:1,promptTokens:null,completionTokens:null,totalTokens:null,startedAt:new Date('2026-10-31T00:00:00Z')}]);
 const html=renderToStaticMarkup(await enginePage({params:Promise.resolve({engine:'ad_hoc'}),searchParams:Promise.resolve({})}));
 expect(html).not.toContain('ghp_');expect(html).toContain('[REDACTED-GITHUB-PAT]');
 for(const [query] of m.findMany.mock.calls)expect(query.where.organizationId).toBe('org-a');
});
it.each(['=1+1','+SUM(1)','-SUM(1)','@SUM(1)',' \t=1+1','\tplain text','＝1+1','＋1+1','－1+1','＠SUM(1)','=HYPERLINK("https://example.invalid","x")'])('neutralizes a common spreadsheet-formula text prefix: %s',async model=>{
 m.findMany.mockResolvedValue([{id:'fixture',organizationId:'org-a',engineName:'ad_hoc',model,outcome:'ok',errorMessage:null,latencyMs:1,promptTokens:0,completionTokens:0,totalTokens:0,startedAt:new Date('2026-10-31T00:00:00Z')}]);
 const response=await csv(new NextRequest('http://localhost/api/dashboard/ai-call-log/export.csv'));
 const text=await response.text();expect(text).toContain(',ad_hoc,"\t'+model.replace(/"/g,'""')+'",ok,');
 expect(text).toContain(',1,0,0,0,org-a');
});
it('retains ordinary quoted CSV text and numeric values',async()=>{
 m.findMany.mockResolvedValue([{id:'fixture',organizationId:'org-a',engineName:'ad_hoc',model:'ordinary, "model"',outcome:'ok',errorMessage:null,latencyMs:1,promptTokens:0,completionTokens:0,totalTokens:0,startedAt:new Date('2026-10-31T00:00:00Z')}]);
 const text=await (await csv(new NextRequest('http://localhost/api/dashboard/ai-call-log/export.csv'))).text();
 expect(text).toContain(',ad_hoc,"ordinary, ""model""",ok,');expect(text).toContain(',1,0,0,0,org-a');
});
it('does not turn an unavailable export into a successful empty audit file',async()=>{
 m.findMany.mockRejectedValue(new Error('synthetic-private-database-diagnostic'));
 const response=await csv(new NextRequest('http://localhost/api/dashboard/ai-call-log/export.csv'));
 expect(response.status).toBe(503);
 expect(response.headers.get('Content-Disposition')).toBeNull();
 expect(await response.json()).toEqual({ok:false,error:'export_unavailable'});
});
