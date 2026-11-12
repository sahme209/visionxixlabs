import {it,expect} from 'vitest';
import {decodeCustomerHostedTokenRow} from '../customerHostedTokenRepository';
const body={id:'customer_hosted_token_'+'a'.repeat(64),organizationId:'org',installationId:'install',actorId:'actor',requestDigest:'b'.repeat(64),modelId:'model',configDigest:'c'.repeat(64),windowId:'w',reservedTokens:100,status:'unknown',reportedTokens:null};
it('accepts content-free persisted token records and rejects scope/identity corruption',()=>{
 expect(decodeCustomerHostedTokenRow({id:body.id,organizationId:'org',stateJson:body},'org')).toEqual(body);
 for(const row of [{id:'other',organizationId:'org',stateJson:body},{id:body.id,organizationId:'other',stateJson:body},{id:body.id,organizationId:'org',stateJson:{...body,reservedTokens:-1}},{id:body.id,organizationId:'org',stateJson:{...body,prompt:'not permitted'}},{id:body.id,organizationId:'org',stateJson:{...body,status:'released'}}])expect(()=>decodeCustomerHostedTokenRow(row,'org')).toThrow();
});
