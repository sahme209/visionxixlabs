import {beforeEach,expect,it,vi} from 'vitest';
import {createServiceNowAssociatedNativePlan} from '../serviceNowAssociatedNativePlan';
import {associatedTicketFixture} from './fixtures/associatedTicket';
import {buildAssociatedTicketLink} from '@/lib/releaseops/associatedTicketCandidate';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const now=Date.parse('2030-01-01T00:00:00Z'),scope={organizationId:'org',actorUserId:'owner',sessionId:'session'};
const fixture=associatedTicketFixture('servicenow'),process={nativeProcess:{kind:'model',modelSysId:'1'.repeat(32),label:'Normal'},fields:[{name:'short_description',label:'Short description',required:true,writable:true,type:'string',maxBytes:160}]};
const original={...fixture.original,validationAuthority:'native_submission',schemaDigest:sha256ContentHash({nativeProcess:process.nativeProcess,fields:process.fields})};
const link=()=>buildAssociatedTicketLink(fixture.reference,fixture.binding,original,now);
const readOriginal=vi.fn(),readMetadata=vi.fn(),readCloseMetadata=vi.fn(),assertCurrent=vi.fn();
const validator=()=>createServiceNowAssociatedNativePlan({readOriginal,readMetadata,readCloseMetadata,assertCurrent},{now:()=>now});
const signal=()=>new AbortController().signal;
beforeEach(()=>{vi.resetAllMocks();readOriginal.mockResolvedValue(original);readMetadata.mockResolvedValue({organizationId:'org',connectionId:'servicenow',connectionRevision:fixture.binding.ticket.connectionRevision,instanceOrigin:'https://dev123.service-now.com',family:'change_request',validationAuthority:'native_submission',observedAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString(),processes:[{...process,label:'Normal'}]})});
it('revalidates only the original server-bound model without reusing its expired connection revision',async()=>{
 await expect(validator()(scope,link(),signal())).resolves.toBeUndefined();expect(readOriginal).toHaveBeenCalledTimes(1);expect(readMetadata).toHaveBeenCalledWith(scope,expect.objectContaining({connectionRevision:fixture.binding.ticket.connectionRevision,consentedByUserId:'owner'}),expect.any(AbortSignal));expect(assertCurrent).toHaveBeenCalledTimes(2);
});
it('refuses model drift, removed models, stale metadata and a foreign original ticket',async()=>{
 const c=link();for(const metadata of [{processes:[]},{processes:[{...process,label:'Normal',fields:[]}]},{expiresAt:new Date(now).toISOString()}]){readMetadata.mockResolvedValueOnce({...await readMetadata(),...metadata});await expect(validator()(scope,c,signal())).rejects.toThrow()}
 readOriginal.mockResolvedValue({...original,releaseId:'another'});await expect(validator()(scope,c,signal())).rejects.toThrow();
});
it('never accepts a publish action or missing association as an associated mutation',async()=>{await expect(validator()(scope,original,signal())).rejects.toThrow();await expect(validator()(scope,{...link(),association:undefined},signal())).rejects.toThrow()});
it('rechecks terminal metadata and refuses native conditions or close-field drift before dispatch',async()=>{
 const {buildServiceNowNativeClosePlan}=await import('../serviceNowTicketLifecyclePreparation'),linkCandidate=link();if(!('instanceOrigin' in linkCandidate)||linkCandidate.kind!=='link')throw Error('fixture');
 const policy={reviewId:'ticket_review_'+'d'.repeat(64),bindingDigest:'e'.repeat(64)},metadata={organizationId:'org',connectionId:'servicenow',connectionRevision:linkCandidate.connectionRevision,instanceOrigin:linkCandidate.instanceOrigin,issue:linkCandidate.issue,nativeProcess:process.nativeProcess,schemaDigest:'f'.repeat(64),observedAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString(),rawNextStates:{result:{available_states:['3'],state_transitions:[{sys_id:'9'.repeat(32),display_value:'Complete',from_state:'0',to_state:'3',transition_available:true,automatic_transition:false,conditions:[{passed:true}]}]}},verifiedTerminalStateValues:['3'],fields:[{name:'close_notes',label:'Notes',required:true,writable:true,type:'string',maxBytes:100}],targetStateLabels:{'3':'Closed'}};
 const native=buildServiceNowNativeClosePlan({...linkCandidate,consentedByUserId:'owner'},linkCandidate.issue,metadata,{transitionId:'9'.repeat(32),closeNotes:'Verified',clientRequestId:'11111111-1111-4111-8111-111111111111'},now);
 const {evidence:_,...base}=linkCandidate,candidate={...base,kind:'close',schemaDigest:native.schemaDigest,transition:native.transition,payload:native.payload,payloadDigest:native.payloadDigest,terminalPolicy:policy,linkedEvidenceActionId:'servicenow_action_'+'1'.repeat(64)};
 readCloseMetadata.mockResolvedValue(metadata);await expect(validator()(scope,candidate,signal())).resolves.toEqual({terminalStateValues:['3']});
 readCloseMetadata.mockResolvedValue({...metadata,rawNextStates:{result:{...metadata.rawNextStates.result,state_transitions:[{...metadata.rawNextStates.result.state_transitions[0],conditions:[{passed:false}]}]}}});await expect(validator()(scope,candidate,signal())).rejects.toThrow();
 readCloseMetadata.mockResolvedValue({...metadata,fields:[{...metadata.fields[0],maxBytes:2}]});await expect(validator()(scope,candidate,signal())).rejects.toThrow();
});
