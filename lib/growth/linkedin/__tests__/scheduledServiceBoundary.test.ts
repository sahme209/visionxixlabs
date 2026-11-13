import {afterEach,it,expect,vi} from 'vitest';import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({due:vi.fn(async()=>[]),publish:vi.fn(),audit:vi.fn()}));vi.mock('@/lib/growth/draftStore',()=>({listDueScheduledDrafts:m.due}));vi.mock('@/lib/growth/linkedin/posting',()=>({publishDraft:m.publish}));vi.mock('@/lib/growth/audit',()=>({writeGrowthAudit:m.audit}));
import {POST} from '../../../../app/api/cron/linkedin-publish/route';
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs()});
it('a cron secret alone cannot scan or attempt scheduled provider work',async()=>{
 vi.stubEnv('CRON_SECRET','synthetic-cron');const result=await POST(new NextRequest('https://fixture.test/cron',{method:'POST',headers:{authorization:'Bearer synthetic-cron'}}));expect(result.status).toBe(503);expect(await result.json()).toMatchObject({ok:false,reason:'platform_scheduled_service_authority_unavailable'});expect(m.due).not.toHaveBeenCalled();expect(m.publish).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled();
});
it('retains missing-secret and unauthenticated refusals',async()=>{
 vi.stubEnv('CRON_SECRET','');expect((await POST(new NextRequest('https://fixture.test/cron',{method:'POST'}))).status).toBe(503);vi.stubEnv('CRON_SECRET','synthetic-cron');expect((await POST(new NextRequest('https://fixture.test/cron',{method:'POST'}))).status).toBe(401);
});
