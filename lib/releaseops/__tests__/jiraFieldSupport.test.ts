import {describe,it,expect} from 'vitest';
import {classifyJiraDiscoveredField} from '../jiraFieldSupport';
const scope={connectionId:'connection-1',revision:'2026-10-24T19:00:00.000Z',projectId:'10001',issueTypeId:'10002'};
const field=(id:string,schemaType:string|null,canSet=true)=>({id,name:id,required:true,hasDefaultValue:false,canSet,schemaType});
const input=(id='project',type:string|null='project',canSet=true)=>({field:field(id,type,canSet),discovery:{...scope},selection:{...scope}});
describe('read-only Jira field support',()=>{
 it.each([['project','project','10001'],['issuetype','issuetype','10002']])('recognizes exact %s selected context only',(id,type,selectedId)=>{expect(classifyJiraDiscoveredField(input(id,type))).toMatchObject({kind:'selected_context',selectedId,authority:'discovery_only',publishReady:false,writabilityVerified:false,providerSetOperation:'advertised'});});
 it('retains the blocked set-operation signal even with known selection',()=>{expect(classifyJiraDiscoveredField(input('project','project',false))).toMatchObject({kind:'selected_context',providerSetOperation:'not_advertised',publishReady:false,writabilityVerified:false});});
 it.each(['connectionId','revision','projectId','issueTypeId'] as const)('refuses stale or mismatched %s',key=>{const v=input();v.selection[key]='other';expect(classifyJiraDiscoveredField(v).kind).toBe('unsupported_metadata');});
 it('requires verified provider identity for reporter without substituting a selected ID',()=>{const result=classifyJiraDiscoveredField(input('reporter','user'));expect(result.kind).toBe('requires_verified_provider_identity');expect(result).not.toHaveProperty('selectedId');expect(result.publishReady).toBe(false);});
 it('does not guess a system field from its display name',()=>{const v=input('customfield_10000','project');v.field.name='Project';expect(classifyJiraDiscoveredField(v).kind).toBe('encoding_review_required');});
 it.each(['string','number','boolean','array',null])('does not grant an encoder for %s schema alone',type=>{expect(classifyJiraDiscoveredField(input('description',type)).kind).toBe('encoding_review_required');});
 it('does not treat a default-presence flag as a resolved value',()=>{const v=input('customfield_10000','string');v.field.hasDefaultValue=true;expect(classifyJiraDiscoveredField(v).kind).toBe('encoding_review_required');});
 it('preserves non-settable ordinary fields',()=>{expect(classifyJiraDiscoveredField(input('summary','string',false))).toMatchObject({kind:'not_settable',providerSetOperation:'not_advertised'});});
 it.each([null,{}, {...input(),extra:true},{...input(),field:{...field('project','project'),canSet:'true'}},{...input(),discovery:{...scope,projectId:'unknown id'}},{...input(),selection:{...scope,revision:'not-a-date'}}])('fails closed for malformed input %#',v=>{expect(classifyJiraDiscoveredField(v)).toEqual({kind:'unsupported_metadata',authority:'discovery_only',publishReady:false,writabilityVerified:false,providerSetOperation:'unknown'});});
 it('returns immutable output without mutating caller data',()=>{const v=input();const snapshot=JSON.stringify(v);const r=classifyJiraDiscoveredField(v);expect(Object.isFrozen(r)).toBe(true);expect(JSON.stringify(v)).toBe(snapshot);});
});
