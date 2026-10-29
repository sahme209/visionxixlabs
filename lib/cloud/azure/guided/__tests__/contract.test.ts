import {it,expect} from 'vitest';
import {azureGuidedStatusSchema,azureGuidedStartSchema} from '../contract';
it('allows truthful existing Reader connection without an invented OAuth attempt',()=>{expect(azureGuidedStatusSchema.parse({available:false,status:'connected_read_only',connection:{id:'owned',resourceId:'9f19c344-c8a4-4eeb-8c1b-d38c567f8b46',version:1,authMode:'service_principal'}}).status).toBe('connected_read_only')});
it('rejects caller authority/secrets and malformed subscription selections',()=>{expect(()=>azureGuidedStartSchema.parse({tenantId:'attacker'})).toThrow();expect(()=>azureGuidedStatusSchema.parse({available:true,status:'selection_required',resources:[{id:'not-uuid',label:'Fake',tenantId:'not-uuid'}]})).toThrow()});
