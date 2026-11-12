import {afterEach,it,expect,vi} from 'vitest';
import {createCurrentPlatformAuthority} from '../currentAuthority';
import {preparePlatformLinkedInPost} from '@/lib/growth/linkedin/platformPostingPlan';
import type {PlatformTransaction} from '../actionStore';
const now=Date.parse('2026-11-12T00:00:00Z');
function fixture(){
 const draft={id:'draft',title:'Title',hook:'Hook',body:'Body',cta:null,hashtags:[],imageUrn:null,status:'approved',scheduledFor:null,updatedAt:new Date(now-1000)};
 const connection={id:'connection',linkedinUrn:'urn:li:person:abc',organizationUrn:null,scopes:'w_member_social',status:'connected',expiresAt:new Date(now+60000),updatedAt:new Date(now-1000)};
 const effect=preparePlatformLinkedInPost(draft,connection,'202605',now).effect,readGrowthPostingSource=vi.fn(async()=>({draft,connection}));
 return {draft,connection,effect,readGrowthPostingSource,tx:{now:async()=>now,readGrowthPostingSource} as unknown as PlatformTransaction};
}
afterEach(()=>vi.unstubAllEnvs());
it('final source assertion binds exact current rendered payload and connection under the claimed transaction',async()=>{
 vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');const f=fixture(),authority=createCurrentPlatformAuthority(()=>[]);
 await authority.assertEffectCurrent!(f.tx,f.effect);expect(f.readGrowthPostingSource).toHaveBeenCalledWith('draft','connection');
});
it('changed content, account revision or posting policy refuses the final send',async()=>{
 for(const cause of ['content','revision','disabled']){
  vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');const f=fixture();if(cause==='content')f.draft.body='changed';if(cause==='revision')f.connection.updatedAt=new Date(now);if(cause==='disabled')vi.stubEnv('LINKEDIN_POSTING_ENABLED','false');
  await expect(createCurrentPlatformAuthority(()=>[]).assertEffectCurrent!(f.tx,f.effect)).rejects.toThrow();
 }
});
