import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({draft:vi.fn(),connection:vi.fn(),update:vi.fn(),audit:vi.fn(async()=>{}),transaction:vi.fn(),query:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{$transaction:m.transaction,linkedInPostDraft:{findUnique:m.draft,updateMany:m.update},linkedInAccountConnection:{findUnique:m.connection}}}));
vi.mock('../../audit',()=>({writeGrowthAudit:m.audit}));
import {schedulePlatformLinkedInDraft} from '../platformSchedule';
import {preparePlatformLinkedInSchedule} from '../platformPostingPlan';
import {bindPlatformExecution} from '@/lib/governance/platform/effectExecution';
let draft:ReturnType<typeof draftFixture>,connection:ReturnType<typeof connectionFixture>,when:Date;
function draftFixture(){return {id:'draft',title:'Title',hook:'Hook',body:'Body',cta:null,hashtags:[],imageUrn:null,status:'approved',scheduledFor:null,updatedAt:new Date(Date.now()-1000)}}
function connectionFixture(){return {id:'connection',linkedinUrn:'urn:li:person:abc',organizationUrn:null,scopes:'w_member_social',status:'connected',expiresAt:new Date(Date.now()+60000),updatedAt:new Date(Date.now()-1000)}}
function binding(){const effect=preparePlatformLinkedInSchedule(draft,connection,'202605',Date.now(),when).effect,service={actorUserId:'requester',claimNextEffect:vi.fn(async()=>({effect,proof:{}})),beforeEffectSend:vi.fn(async()=>{}),observeEffect:vi.fn(async()=>{})};return {value:bindPlatformExecution(service,'fixture-action'),service}}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');vi.stubEnv('LINKEDIN_REST_VERSION','202605');draft=draftFixture();connection=connectionFixture();when=new Date(Date.now()+30000);m.draft.mockImplementation(async()=>({...draft}));m.connection.mockImplementation(async()=>({...connection}));m.update.mockResolvedValue({count:1});m.query.mockImplementation(async(sql:string)=>sql.includes('clock_timestamp')?[{now:Date.now()}]:[{id:'draft'}]);m.transaction.mockImplementation(async fn=>fn({$queryRawUnsafe:m.query,linkedInPostDraft:{updateMany:m.update}}));});
afterEach(()=>vi.unstubAllEnvs());
it('unadmitted scheduling refuses before reading or changing any draft',async()=>{
 for(const platformExecution of [undefined,{}])expect(await schedulePlatformLinkedInDraft({draftId:'draft',connectionId:'connection',scheduledFor:when,platformExecution})).toMatchObject({kind:'governance_required'});
 expect(m.draft).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
});
it('binds exact future time and content; past, invalid and unapproved sources refuse',()=>{
 const p=preparePlatformLinkedInSchedule(draft,connection,'202605',Date.now(),when);expect(p.effect.target.scheduledFor).toBe(when.toISOString());
 expect(preparePlatformLinkedInSchedule({...draft,body:'changed'},connection,'202605',Date.now(),when).effect).not.toEqual(p.effect);
 for(const date of [new Date(0),new Date(NaN)])expect(()=>preparePlatformLinkedInSchedule(draft,connection,'202605',Date.now(),date)).toThrow();
 expect(()=>preparePlatformLinkedInSchedule({...draft,status:'failed'},connection,'202605',Date.now(),when)).toThrow();
});
it('delegates the schedule mutation to its original action owner without a second transaction',async()=>{
 const b=binding();expect(await schedulePlatformLinkedInDraft({draftId:'draft',connectionId:'connection',scheduledFor:when,platformExecution:b.value})).toMatchObject({kind:'scheduled'});
 expect(b.service.beforeEffectSend).toHaveBeenCalledTimes(1);expect(m.transaction).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
 expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'confirmed');
});
it('source change and final refusal prevent any schedule mutation',async()=>{
 for(const mode of ['changed','revoked']){m.update.mockClear();const b=binding();if(mode==='changed')draft.body='changed';else b.service.beforeEffectSend.mockRejectedValueOnce(Error('revoked'));
 expect(await schedulePlatformLinkedInDraft({draftId:'draft',connectionId:'connection',scheduledFor:when,platformExecution:b.value})).toMatchObject({kind:'outcome_unknown'});expect(m.update).not.toHaveBeenCalled();}
});
it('uncertain update consumes the binding without automatic replay',async()=>{
 const b=binding();b.service.beforeEffectSend.mockRejectedValueOnce(Error('lost original transaction acknowledgment'));const input={draftId:'draft',connectionId:'connection',scheduledFor:when,platformExecution:b.value};
 expect(await schedulePlatformLinkedInDraft(input)).toMatchObject({kind:'outcome_unknown'});expect(await schedulePlatformLinkedInDraft(input)).toMatchObject({kind:'governance_required'});expect(b.service.beforeEffectSend).toHaveBeenCalledTimes(1);expect(m.transaction).not.toHaveBeenCalled();
});

it('a fixed-time check after the original transaction cannot start a second update',async()=>{
 const b=binding(),clock=vi.spyOn(Date,'now');clock.mockReturnValue(when.getTime());
 try{expect(await schedulePlatformLinkedInDraft({draftId:'draft',connectionId:'connection',scheduledFor:when,platformExecution:b.value})).toEqual({kind:'outcome_unknown'});expect(m.transaction).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled()}finally{clock.mockRestore()}
});
