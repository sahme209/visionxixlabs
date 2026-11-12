import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),transaction:vi.fn(),credential:vi.fn(),decrypt:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{$transaction:m.transaction,linkedInAccountConnection:{findUnique:m.credential}}}));
vi.mock('../platformDeletionSource',()=>({readPlatformDeletionSource:m.read}));
vi.mock('@/lib/security/credentialVault',()=>({decryptCredential:m.decrypt}));
vi.mock('../../audit',()=>({writeGrowthAudit:m.audit}));
import {deletePlatformLinkedInPost} from '../platformDeletion';
import {preparePlatformLinkedInDeletion} from '../platformDeletionPlan';
import {deletionFixture} from './fixtures/platformDeletion';
import {bindPlatformExecution} from '@/lib/governance/platform/effectExecution';
let source:ReturnType<typeof deletionFixture>;
const now=Date.parse('2026-11-12T00:00:00Z');
function binding(){const effect=preparePlatformLinkedInDeletion(source,'202605',now).effect,service={actorUserId:'requester',claimNextEffect:vi.fn(async()=>({effect,proof:{}})),beforeEffectSend:vi.fn(async()=>{}),observeEffect:vi.fn(async()=>{})};return {value:bindPlatformExecution(service,'fixture-delete-action'),service}}
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(now);vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');vi.stubEnv('LINKEDIN_REST_VERSION','202605');source=deletionFixture();m.read.mockResolvedValue(source);m.transaction.mockImplementation(async fn=>fn({}));m.credential.mockResolvedValue({accessToken:'synthetic-encrypted',updatedAt:source.connection.updatedAt});m.decrypt.mockReturnValue('synthetic-token');});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals()});
it('unadmitted or forged deletion cannot read a source or credential',async()=>{
 for(const platformExecution of [undefined,{}])expect(await deletePlatformLinkedInPost({draftId:'draft',connectionId:'connection',platformExecution})).toEqual({kind:'governance_required'});
 expect(m.read).not.toHaveBeenCalled();expect(m.credential).not.toHaveBeenCalled();
});
it('deletes the exact recorded URN once without resetting the published draft',async()=>{
 const b=binding(),http=vi.fn(async()=>new Response(null,{status:204}));vi.stubGlobal('fetch',http);
 expect(await deletePlatformLinkedInPost({draftId:'draft',connectionId:'connection',platformExecution:b.value})).toEqual({kind:'deleted'});
 expect(http).toHaveBeenCalledWith('https://api.linkedin.com/rest/posts/urn%3Ali%3Ashare%3A123',expect.objectContaining({method:'DELETE',redirect:'error',headers:expect.objectContaining({Authorization:'Bearer synthetic-token'})}));
 expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'confirmed');expect(http).toHaveBeenCalledTimes(1);
 expect(m.credential).toHaveBeenCalledWith({where:{id:'connection'},select:{accessToken:true,updatedAt:true}});
});
it('effect mismatch and final revoked authority prevent provider access',async()=>{
 for(const mode of ['mismatch','revoked']){const b=binding(),http=vi.fn();vi.stubGlobal('fetch',http);m.credential.mockClear();if(mode==='mismatch')source.draft.updatedAt=new Date(now);else b.service.beforeEffectSend.mockRejectedValueOnce(Error('revoked'));
 expect(await deletePlatformLinkedInPost({draftId:'draft',connectionId:'connection',platformExecution:b.value})).toEqual({kind:'outcome_unknown'});expect(http).not.toHaveBeenCalled();if(mode==='mismatch')expect(m.credential).not.toHaveBeenCalled();}
});
it('lost response preserves unknown and cannot be resent using the consumed action',async()=>{
 const b=binding(),http=vi.fn(async()=>{throw Error('lost response')});vi.stubGlobal('fetch',http);const input={draftId:'draft',connectionId:'connection',platformExecution:b.value};
 expect(await deletePlatformLinkedInPost(input)).toEqual({kind:'outcome_unknown'});expect(await deletePlatformLinkedInPost(input)).toEqual({kind:'governance_required'});expect(http).toHaveBeenCalledTimes(1);expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'unknown');
});
it('mutable caller input cannot replace the approved credential after source lookup',async()=>{
 const b=binding(),http=vi.fn(async()=>new Response(null,{status:204}));vi.stubGlobal('fetch',http);
 const input={draftId:'draft',connectionId:'connection',platformExecution:b.value};
 m.read.mockImplementationOnce(async()=>{input.connectionId='other-account';input.draftId='other-draft';return source});
 expect(await deletePlatformLinkedInPost(input)).toEqual({kind:'deleted'});
 expect(m.credential).toHaveBeenCalledWith({where:{id:'connection'},select:{accessToken:true,updatedAt:true}});
 expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({targetId:'draft'}));
});
