import {it,expect} from 'vitest';
import {serviceNowTerminalPolicySchema,ticketReleaseAssociationSchema} from '../ticketGovernanceReviewContract';
const policy={kind:'servicenow_terminal_policy',organizationId:'org',requesterUserId:'admin',executorUserId:'admin',expiresAt:'2030-01-01T00:15:00.000Z',connectionId:'sn',connectionRevision:'2030-01-01T00:00:00.000Z',instanceOrigin:'https://dev123.service-now.com',nativeProcess:{kind:'model',modelSysId:'a'.repeat(32)},modelDigest:'b'.repeat(64),provenance:'administrator_declared',sourceReferences:[{reference:'approved-instance-runbook',digest:'c'.repeat(64)}],terminalStates:[{value:'3',label:'Closed',outcome:'closed'}],fields:[{name:'close_notes',label:'Close notes',required:true,writable:true,type:'string',maxBytes:8192}]};
it('preserves administrator-declared provenance instead of claiming provider terminal authority',()=>{expect(serviceNowTerminalPolicySchema.parse(policy).provenance).toBe('administrator_declared');expect(serviceNowTerminalPolicySchema.safeParse({...policy,provenance:'provider_verified'}).success).toBe(false)});
it.each([
 {terminalStates:[...policy.terminalStates,...policy.terminalStates]},
 {fields:[...policy.fields,...policy.fields]},
 {fields:[{...policy.fields[0],name:'state'}]},
 {fields:[{...policy.fields[0],writable:false}]},
 {fields:[{...policy.fields[0],name:'close_code'}]},
 {fields:[{...policy.fields[0],choices:[{value:'a',label:'A'}]}]},
 {sourceReferences:[]},
 {sourceReferences:[...policy.sourceReferences,...policy.sourceReferences]},
 {instanceOrigin:'https://attacker.example'},
])('refuses ambiguous or unsupported policy configuration %j',delta=>{expect(serviceNowTerminalPolicySchema.safeParse({...policy,...delta}).success).toBe(false)});
it('does not accept an arbitrary run URL as a reviewed deployment association',()=>{expect(ticketReleaseAssociationSchema.safeParse({kind:'ticket_release_association',organizationId:'org',url:'https://github.com/company/app/actions/runs/123'}).success).toBe(false)});
