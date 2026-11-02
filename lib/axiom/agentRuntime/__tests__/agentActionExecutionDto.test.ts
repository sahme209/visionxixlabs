import {describe,it,expect} from 'vitest';
import {agentActionExecutionDtoSchema as schema} from '../agentActionExecutionContract';
const base={id:'agent_execution_'+'a'.repeat(64),proposalId:'p',toolName:'create_github_branch',state:'prepared',version:0,attemptCount:0,createdAt:'2030-01-01T00:00:00.000Z',expiresAt:'2030-01-01T00:01:00.000Z',observedAt:'2030-01-01T00:00:01.000Z',recoveryState:'not_started'};
describe('public Agent execution metadata',()=>{
 it('accepts prepared metadata without private authority',()=>expect(schema.safeParse(base).success).toBe(true));
 it.each(['args','token','leaseOwner','claim'])('rejects private field %s',key=>expect(schema.safeParse({...base,[key]:'secret'}).success).toBe(false));
 it('refuses a receipt before any attempt',()=>expect(schema.safeParse({...base,receipt:{code:'action_completed'}}).success).toBe(false));
 it('requires a matching terminal receipt',()=>{
 const terminal={...base,state:'unknown',version:2,attemptCount:1,recoveryState:'unknown'};
 expect(schema.safeParse(terminal).success).toBe(false);
 expect(schema.safeParse({...terminal,receipt:{code:'action_completed'}}).success).toBe(false);
 expect(schema.safeParse({...terminal,receipt:{code:'provider_outcome_unknown'}}).success).toBe(true);
 });
});
