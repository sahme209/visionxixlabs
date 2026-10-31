import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({context:vi.fn(),findMany:vi.fn(),groupBy:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:m.context}));
vi.mock('@/lib/db',()=>({prisma:{aiCallLog:{findMany:m.findMany,groupBy:m.groupBy}}}));
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw new Error('REDIRECT:'+url)}}));
import {GET as list} from '../route';
import {GET as csv} from '../export.csv/route';
import enginePage from '@/app/dashboard/ai-call-log/[engine]/page';
beforeEach(()=>{vi.resetAllMocks();m.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-a',roles:['OWNER']});m.findMany.mockResolvedValue([]);m.groupBy.mockResolvedValue([])});
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
