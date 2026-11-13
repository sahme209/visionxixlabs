import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({draft:vi.fn(),connection:vi.fn(),credential:vi.fn(),imageSource:vi.fn(),updateDraft:vi.fn(),updateConnection:vi.fn(),run:vi.fn(),decrypt:vi.fn(),audit:vi.fn(async()=>{})}));
vi.mock('@/lib/db',()=>({prisma:{linkedInPostDraft:{findUnique:m.draft,updateMany:m.updateDraft},linkedInAccountConnection:{findUnique:m.connection,updateMany:m.updateConnection},linkedInPostPublishRun:{create:m.run}}}));
vi.mock('../platformImageSource',()=>({readDefaultImagePublicationSource:m.imageSource}));
vi.mock('@/lib/security/credentialVault',()=>({decryptCredential:m.decrypt}));
vi.mock('../../audit',()=>({writeGrowthAudit:m.audit}));
import {publishDraft} from '../posting';
import {preparePlatformLinkedInPost} from '../platformPostingPlan';
import {syntheticGrowthBinding} from '@/lib/governance/platform/__tests__/fixtures/syntheticGrowthNative';
let draft:ReturnType<typeof draftFixture>,connection:ReturnType<typeof connectionFixture>;
function draftFixture():Parameters<typeof preparePlatformLinkedInPost>[0]{return {id:'draft',title:'Title',hook:'Hook',body:'Body',cta:null,hashtags:[],imageUrn:null,status:'approved',scheduledFor:null,updatedAt:new Date(Date.now()-1000)}}
function connectionFixture(){return {id:'connection',linkedinUrn:'urn:li:person:abc',organizationUrn:null,scopes:'w_member_social',status:'connected',expiresAt:new Date(Date.now()+60000),updatedAt:new Date(Date.now()-1000)}}
function binding(imageLineage?:unknown){const effect=preparePlatformLinkedInPost(draft,connection,'202605',Date.now(),undefined,imageLineage).effect,service={actorUserId:'actual-requester',claimNextEffect:vi.fn(async()=>({effect,proof:{}})),beforeEffectSend:vi.fn(async()=>{}),observeEffect:vi.fn(async()=>{})};return {value:syntheticGrowthBinding(service,'fixture-action',connection.updatedAt.toISOString()),service}}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');vi.stubEnv('LINKEDIN_REST_VERSION','202605');draft=draftFixture();connection=connectionFixture();m.draft.mockImplementation(async()=>({...draft}));m.connection.mockImplementation(async args=>args.select?.accessToken?{accessToken:'stored-encrypted',updatedAt:connection.updatedAt}:{...connection});m.imageSource.mockResolvedValue(undefined);m.decrypt.mockReturnValue('synthetic-plaintext');m.updateDraft.mockResolvedValue({count:1});m.updateConnection.mockResolvedValue({count:1});m.run.mockResolvedValue({id:'run'});});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
it('unadmitted and invented execution cannot read account credentials or send',async()=>{
 const http=vi.fn();vi.stubGlobal('fetch',http);for(const platformExecution of [undefined,{}])expect(await publishDraft({draftId:'draft',triggeredBy:'untrusted-hint',connectionId:'connection',platformExecution})).toMatchObject({kind:'governance_required'});
 expect(m.connection).not.toHaveBeenCalled();expect(m.decrypt).not.toHaveBeenCalled();expect(http).not.toHaveBeenCalled();
});
it('an opaque generic binding without qualified growth runtime refuses before source or bookkeeping',async()=>{
 const {bindPlatformExecution}=await import('@/lib/governance/platform/effectExecution'),effect=preparePlatformLinkedInPost(draft,connection,'202605',Date.now()).effect,binding=bindPlatformExecution({claimNextEffect:async()=>({effect,proof:{}}),beforeEffectSend:async()=>{},observeEffect:async()=>{}},'original');
 expect(await publishDraft({draftId:draft.id,connectionId:connection.id,triggeredBy:'hint',platformExecution:binding})).toMatchObject({kind:'governance_required'});expect(m.draft).not.toHaveBeenCalled();expect(m.connection).not.toHaveBeenCalled();expect(m.run).not.toHaveBeenCalled();
});
it('posts only through exact connection/payload/final authorization and reports a real URN',async()=>{
 const b=binding(),http=vi.fn(async(_url:string,_init?:RequestInit)=>new Response('',{status:201,headers:{'x-restli-id':'urn:li:share:123'}}));vi.stubGlobal('fetch',http);
 expect(await publishDraft({draftId:'draft',triggeredBy:'invented-actor',connectionId:'connection',platformExecution:b.value})).toMatchObject({kind:'success',urn:'urn:li:share:123',recordingConfirmed:true});
 expect(http).toHaveBeenCalledTimes(1);expect(b.service.beforeEffectSend).toHaveBeenCalledTimes(1);expect(m.connection.mock.calls.every(([q])=>q.where.id==='connection')).toBe(true);expect(m.run.mock.calls[0][0].data.triggeredBy).toBe('user:actual-requester');
 const init=http.mock.calls[0]?.[1];if(!init||typeof init.body!=='string')throw Error('synthetic_request_required');expect(init.redirect).toBe('error');expect(JSON.parse(init.body).author).toBe(connection.linkedinUrn);
});
it('changed source after credential lookup refuses before transport',async()=>{
 const b=binding(),http=vi.fn();vi.stubGlobal('fetch',http);m.connection.mockImplementation(async args=>{if(args.select?.accessToken){draft.body='changed';return {accessToken:'stored-encrypted',updatedAt:connection.updatedAt}}return {...connection}});
 expect(await publishDraft({draftId:'draft',triggeredBy:'operator',connectionId:'connection',platformExecution:b.value})).toMatchObject({kind:'outcome_unknown'});expect(http).not.toHaveBeenCalled();
});
it('missing provider identity and thrown transport retain unknown rather than fabricate success',async()=>{
 for(const response of [async()=>new Response('{}',{status:201}),async()=>{throw Error('SECRET_PROVIDER_ERROR')}]){
  const b=binding(),http=vi.fn(response);vi.stubGlobal('fetch',http);const result=await publishDraft({draftId:'draft',triggeredBy:'operator',connectionId:'connection',platformExecution:b.value});expect(result.kind).toBe('outcome_unknown');expect(JSON.stringify(result)).not.toContain('SECRET_PROVIDER_ERROR');expect(http).toHaveBeenCalledTimes(1);expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'unknown');
 }
});
it('local recording failure never erases a known provider result or causes another send',async()=>{
 const b=binding(),http=vi.fn(async(_url:string,_init?:RequestInit)=>new Response('',{status:201,headers:{'x-restli-id':'urn:li:share:123'}}));vi.stubGlobal('fetch',http);m.updateDraft.mockRejectedValue(Error('local_recording_failure'));
 expect(await publishDraft({draftId:'draft',triggeredBy:'operator',connectionId:'connection',platformExecution:b.value})).toMatchObject({kind:'success',urn:'urn:li:share:123',recordingConfirmed:false});expect(http).toHaveBeenCalledTimes(1);expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'confirmed');
});
it('zero-row conditional connection bookkeeping is not reported confirmed',async()=>{
 const b=binding(),http=vi.fn(async()=>new Response('',{status:201,headers:{'x-restli-id':'urn:li:share:123'}}));vi.stubGlobal('fetch',http);m.updateConnection.mockResolvedValue({count:0});
 expect(await publishDraft({draftId:'draft',triggeredBy:'operator',connectionId:'connection',platformExecution:b.value})).toMatchObject({kind:'success',urn:'urn:li:share:123',recordingConfirmed:false});expect(http).toHaveBeenCalledTimes(1);expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'confirmed');
});
it('publishes a compatible confirmed-image snapshot and refuses a changed lineage after credentials before the final send',async()=>{
 const {compileImagePublicationLineage}=await import('@/lib/governance/platform/imagePublicationLineage'),{linkedInConnectionRevision}=await import('../platformPostingPlan'),d='a'.repeat(64);
 draft.imageUrn='urn:li:image:managed';const body={format:1,purpose:'platform_image_publication_lineage_v1',uploadActionId:'platform_action_11111111-1111-4111-8111-111111111111',uploadPlanDigest:d,bindingDigest:d,artifactId:'platform_image_artifact_11111111-1111-4111-8111-111111111111',bytesDigest:d,connectionId:connection.id,connectionRevision:linkedInConnectionRevision(connection),author:connection.linkedinUrn,providerImageReference:draft.imageUrn,grantReference:'platform_image_grant_'+d,putReceiptDigest:d};
 const lineage=compileImagePublicationLineage(body),b=binding(lineage),http=vi.fn(async(_url:unknown,_init?:RequestInit)=>new Response('',{status:201,headers:{'x-restli-id':'urn:li:share:managed'}}));vi.stubGlobal('fetch',http);m.imageSource.mockResolvedValue(lineage);
 expect(await publishDraft({draftId:draft.id,connectionId:connection.id,triggeredBy:'hint',platformExecution:b.value})).toMatchObject({kind:'success',urn:'urn:li:share:managed'});expect(JSON.parse(String(http.mock.calls[0]?.[1]?.body)).content.media.id).toBe(draft.imageUrn);
 http.mockClear();const next=binding(lineage);m.imageSource.mockResolvedValueOnce(lineage).mockResolvedValueOnce(compileImagePublicationLineage({...body,uploadPlanDigest:'b'.repeat(64)}));expect(await publishDraft({draftId:draft.id,connectionId:connection.id,triggeredBy:'hint',platformExecution:next.value})).toMatchObject({kind:'outcome_unknown'});expect(http).not.toHaveBeenCalled();
});
