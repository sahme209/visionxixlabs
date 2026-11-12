import {afterEach,it,expect,vi} from 'vitest';
import {prepareGrowthPlatformPlan} from '../growthPreparation';
import type {PlatformTransaction} from '../actionStore';
const now=Date.parse('2026-11-12T00:00:00Z');
function fixture(){const draft={id:'draft',title:'Title',hook:'Hook',body:'Exact text',cta:null,hashtags:[],imageUrn:null,status:'approved',scheduledFor:null,updatedAt:new Date(now-1000)},connection={id:'connection',linkedinUrn:'urn:li:person:author',organizationUrn:null,scopes:'w_member_social',status:'connected',expiresAt:new Date(now+60000),updatedAt:new Date(now-1000)},read=vi.fn(async()=>({draft,connection}));return {draft,connection,read,tx:{readGrowthPostingSource:read} as unknown as PlatformTransaction}}
const selection=()=>({operation:'publish',draftId:'draft',connectionId:'connection',expiresAt:new Date(now+30000).toISOString()});
afterEach(()=>vi.unstubAllEnvs());
it('derives the exact reviewed source and rendered preview on the server',async()=>{
 vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');const f=fixture(),result=await prepareGrowthPlatformPlan(f.tx,selection(),now);
 expect(result.plan.effects[0]).toMatchObject({kind:'growth.post.publish',target:{draftId:'draft',connectionId:'connection',author:'urn:li:person:author'}});expect(JSON.parse(result.preview.renderedPost!)).toMatchObject({commentary:'Hook\n\nExact text',author:'urn:li:person:author'});expect(f.read).toHaveBeenCalledWith('draft','connection');
 f.draft.body='changed';expect((await prepareGrowthPlatformPlan(f.tx,selection(),now)).plan.sourceDigest).not.toBe(result.plan.sourceDigest);
});
it('rejects caller-built hashes/actors, mismatched sources and expiry beyond current connection',async()=>{
 vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');const f=fixture();
 for(const input of [{...selection(),sourceDigest:'a'.repeat(64)},{...selection(),actor:'other'},{...selection(),expiresAt:new Date(now+60001).toISOString()}])await expect(prepareGrowthPlatformPlan(f.tx,input,now)).rejects.toThrow();
 f.connection.id='other';await expect(prepareGrowthPlatformPlan(f.tx,selection(),now)).rejects.toThrow();
});
it('a schedule proposal binds the new time but does not include a publication effect',async()=>{
 vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');const f=fixture(),result=await prepareGrowthPlatformPlan(f.tx,{...selection(),operation:'schedule',scheduledFor:new Date(now+20000).toISOString()},now);expect(result.plan.effects).toHaveLength(1);expect(result.plan.effects[0].kind).toBe('growth.schedule.change');
});
