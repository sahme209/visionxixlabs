import {it,expect} from 'vitest';
import {assertPlatformPrincipalTime} from '../principalTime';
const principal={userId:'requester',sessionId:'requester-session'};
const row={...principal,email:'requester@example.test',live:true,sessionIssuedAtMs:100,sessionExpiresAtMs:200};
const signal=()=>new AbortController().signal;
it.each([{earliest:99,latest:101},{earliest:199,latest:200}])('refuses session validity overlap despite database-live=true: %j',async interval=>{
 await expect(assertPlatformPrincipalTime({readPrincipal:async()=>row},principal,async()=>interval,signal())).rejects.toThrow('platform_principal_time_unavailable');
});
it('requires exact session identity and original timestamps without a point-clock fallback',async()=>{
 for(const r of [{...row,sessionIssuedAtMs:undefined},{...row,sessionExpiresAtMs:undefined},{...row,sessionId:'substitute'},{...row,live:false},{...row,sessionIssuedAtMs:201}])await expect(assertPlatformPrincipalTime({readPrincipal:async()=>r},principal,async()=>({earliest:100,latest:101}),signal())).rejects.toThrow();
});
it('accepts the whole interval only inside the exact locked session lifetime',async()=>{
 await expect(assertPlatformPrincipalTime({readPrincipal:async()=>row},principal,async()=>({earliest:100,latest:199}),signal())).resolves.toEqual({notBefore:100,expiresAt:200});
});
