import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const io=vi.hoisted(()=>({session:vi.fn(),row:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{tauriDeploymentRequest:{findFirst:io.row}}}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:io.session}));
import {GET} from '../route';
import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
const intake={...completeReleaseIntake(),repositoryUrls:['https://github.com/team/service'],productionPrUrls:['https://github.com/team/service/pull/42']};
const row={id:intake.id,organizationId:intake.tenantId,version:3,status:'submitted',intakeJson:intake};
const call=(query='expectedVersion=3')=>GET(new NextRequest('https://axiom.invalid/api/desktop/deployments/'+row.id+'/merge-targets?'+query),{params:Promise.resolve({id:row.id})});
beforeEach(()=>{vi.clearAllMocks();io.session.mockResolvedValue({organizationId:intake.tenantId,userId:'reader'});io.row.mockResolvedValue(row)});
it('returns only canonical linked PR targets, not the full intake or execution authority',async()=>{
 const response=await call();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
 expect(await response.json()).toEqual({ok:true,data:{requestId:row.id,requestVersion:3,repositoryFullName:'team/service',targets:[{number:42,url:'https://github.com/team/service/pull/42'}]}});
 expect(io.session).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({requiredScope:'pipeline:read',requiredCapability:'workspace:read',allowApiKey:false}));
});
it('refuses unpaired readers before storage',async()=>{io.session.mockResolvedValue(null);expect((await call()).status).toBe(401);expect(io.row).not.toHaveBeenCalled()});
it.each(['expectedVersion=3&expectedVersion=3','expectedVersion=3&approved=true','expectedVersion=0'])('rejects malformed query %s',async query=>{expect((await call(query)).status).toBe(400);expect(io.row).not.toHaveBeenCalled()});
it.each([null,{...row,organizationId:'other'},{...row,status:'draft'},{...row,version:4},{...row,intakeJson:{...intake,noPrRequired:true}},{...row,intakeJson:{...intake,productionPrUrls:['https://github.com/other/service/pull/42']}},{...row,intakeJson:{...intake,productionPrUrls:[...intake.productionPrUrls,...intake.productionPrUrls]}}])('refuses wrong tenant/version/unsupported targets',async changed=>{io.row.mockResolvedValue(changed);expect((await call()).status).toBe(409)});
