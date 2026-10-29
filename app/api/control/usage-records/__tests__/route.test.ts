import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const io=vi.hoisted(()=>({context:vi.fn(),findMany:vi.fn(),query:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:io.context}));
vi.mock('@/lib/db',()=>({prisma:{usageEvent:{findMany:io.findMany},$queryRaw:io.query}}));
import {GET} from '../route';
const req=(q='')=>new NextRequest('https://fixture.test/api/control/usage-records'+q);
beforeEach(()=>{vi.resetAllMocks();io.context.mockResolvedValue({isAuthenticated:true,userId:'user',organizationId:'current-org',roles:['read_only']});io.findMany.mockResolvedValue([]);io.query.mockResolvedValue([])});
it('rejects unauthenticated readers',async()=>{io.context.mockResolvedValue({isAuthenticated:false});expect((await GET(req())).status).toBe(401);expect(io.findMany).not.toHaveBeenCalled()});
it.each([{roles:[]},{roles:['platform_admin']},{roles:['unknown']}])('requires a current workspace role $roles',async ({roles})=>{io.context.mockResolvedValue({isAuthenticated:true,userId:'u',organizationId:'o',roles});expect((await GET(req())).status).toBe(403);expect(io.findMany).not.toHaveBeenCalled()});
it('reads only the current workspace with no active subscription gate',async()=>{const r=await GET(req('?organizationId=another&customer=cus_wrong'));expect(r.status).toBe(200);expect(io.findMany.mock.calls[0][0].where.organizationId).toBe('current-org');expect(r.headers.get('cache-control')).toContain('no-store')});
it('does not disguise storage failures as an empty ledger',async()=>{io.findMany.mockRejectedValue(Error('private-connection'));const r=await GET(req());expect(r.status).toBe(503);expect(await r.text()).not.toContain('private-connection')});
it('rejects invalid filters before storage reads',async()=>{expect((await GET(req('?status=banana'))).status).toBe(400);expect(io.findMany).not.toHaveBeenCalled()});
it('returns only a bounded attachment with server-generated filename',async()=>{const r=await GET(req('?format=csv'));expect(r.headers.get('content-type')).toContain('text/csv');expect(r.headers.get('content-disposition')).toMatch(/^attachment; filename="axiom-usage-\d{4}-\d{2}-page-1.csv"$/);expect(await r.text()).toContain('Settled USD cents')});

it('returns full-month analytics through the same workspace read boundary',async()=>{const r=await GET(req('?view=analytics&group=provider&organizationId=another'));expect(r.status).toBe(200);const body=await r.json();expect(body.data.group).toBe('provider');expect(body.data.totals.calls).toBe(0);expect(io.findMany).not.toHaveBeenCalled();expect(io.query).toHaveBeenCalledTimes(2);for(const [sql] of io.query.mock.calls)expect(sql.values).toContain('current-org')});
it.each(['?view=other','?view=analytics&format=csv','?view=analytics&group=unknown'])('rejects unsupported analytics selection %s',async q=>{expect((await GET(req(q))).status).toBe(400);expect(io.findMany).not.toHaveBeenCalled();expect(io.query).not.toHaveBeenCalled()});
it('does not display a zero chart when aggregation fails',async()=>{io.query.mockRejectedValue(Error('private database'));const r=await GET(req('?view=analytics'));expect(r.status).toBe(503);expect(await r.text()).not.toContain('private database')});
