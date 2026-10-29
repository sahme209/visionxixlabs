import {expect,it,vi} from 'vitest';
import {readJiraSelfIdentity} from '../jiraSelfIdentity';
const at=Date.parse('2030-01-01T00:00:00Z');
const binding={organizationId:'org',actorUserId:'owner',sessionId:'session',connectionId:'jira-connection',connectionRevision:new Date(at-1000).toISOString()};
function fixture(){
 let row:any={id:binding.connectionId,organizationId:'org',provider:'jira',status:'active',revokedAt:null,consentedByUserId:'owner',externalAccountId:'11111111-1111-4111-8111-111111111111',updatedAt:new Date(at-1000),lastValidatedAt:new Date(at-1000),encryptedCredential:'v2.synthetic',scopesJson:['read:jira-work','write:jira-work','offline_access','read:me']};
 let actor:any={organizationId:'org',userId:'owner',sessionId:'session',canManageConnections:true};
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({account_id:'712020:11111111-1111-4111-8111-111111111111',account_type:'atlassian',account_status:'active',name:'Connected Jira user',email:'discard@example.test',picture:'https://private.test/avatar'}));
 const ports={readActor:vi.fn(async()=>structuredClone(actor)),readConnection:vi.fn(async()=>structuredClone(row)),decrypt:vi.fn(()=>JSON.stringify({accessToken:'synthetic-only-token',refreshToken:'never-used',expiresAt:at+600000,cloudId:row.externalAccountId})),fetch:fetcher,now:()=>at};
 return{ports,fetcher,row,actor,changeConnection:()=>{row.updatedAt=new Date(at)},changeActor:()=>{actor.userId='other'}};
}
it('reads only the granted fixed self endpoint and returns a bound sanitized identity',async()=>{
 const f=fixture(),result=await readJiraSelfIdentity(binding,new AbortController().signal,f.ports);
 expect(result).toMatchObject({authority:'authenticated_jira_self',organizationId:'org',connectionId:binding.connectionId,connectionRevision:binding.connectionRevision,accountId:'712020:11111111-1111-4111-8111-111111111111',displayName:'Connected Jira user'});
 expect(JSON.stringify(result)).not.toMatch(/discard@example|synthetic-only-token|never-used|private.test/);
 expect(f.fetcher).toHaveBeenCalledTimes(1);expect(f.fetcher.mock.calls[0][0]).toBe('https://api.atlassian.com/me');expect(f.fetcher.mock.calls[0][1]).toMatchObject({method:'GET',credentials:'omit',redirect:'error'});
});
it('requires actual read:me consent without granting or refreshing anything',async()=>{
 const f=fixture();f.row.scopesJson=['read:jira-work','write:jira-work','offline_access'];await expect(readJiraSelfIdentity(binding,new AbortController().signal,f.ports)).rejects.toThrow('jira_reporter_permission_required');expect(f.fetcher).not.toHaveBeenCalled();expect(f.ports.decrypt).not.toHaveBeenCalled();
});
it('refuses another tenant or consenting user before using its credential',async()=>{
 for(const field of ['organizationId','consentedByUserId']){const f=fixture();f.row[field]='other';await expect(readJiraSelfIdentity(binding,new AbortController().signal,f.ports)).rejects.toThrow();expect(f.fetcher).not.toHaveBeenCalled()}
});
it('refuses revoked, expired and unsupported grants before provider access',async()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.row.revokedAt=new Date(at)},(f:ReturnType<typeof fixture>)=>{f.row.scopesJson.push('manage:jira-project')},(f:ReturnType<typeof fixture>)=>{f.ports.decrypt.mockReturnValue(JSON.stringify({accessToken:'synthetic',expiresAt:at,cloudId:f.row.externalAccountId}))}]){const f=fixture();change(f);await expect(readJiraSelfIdentity(binding,new AbortController().signal,f.ports)).rejects.toThrow();expect(f.fetcher).not.toHaveBeenCalled()}
});
it('ignores a late identity after actor or connection replacement',async()=>{
 for(const change of ['actor','connection']){const f=fixture();f.fetcher.mockImplementation(async()=>{change==='actor'?f.changeActor():f.changeConnection();return Response.json({account_id:'account-1',account_type:'atlassian',account_status:'active',name:'User'})});await expect(readJiraSelfIdentity(binding,new AbortController().signal,f.ports)).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledTimes(1)}
});
it('does not accept inactive, malformed or oversized profile responses or retry upstream failures',async()=>{
 for(const response of [Response.json({account_id:'account-1',account_type:'atlassian',account_status:'inactive',name:'User'}),Response.json({account_id:'bad/id',account_type:'atlassian',account_status:'active',name:'User'}),new Response('x',{headers:{'content-type':'application/json','content-length':'16385'}}),Response.json({error:'private error'},{status:401})]){const f=fixture();f.fetcher.mockResolvedValue(response);await expect(readJiraSelfIdentity(binding,new AbortController().signal,f.ports)).rejects.toThrow('jira_reporter_identity_unavailable');expect(f.fetcher).toHaveBeenCalledTimes(1)}
});
it('fails closed without all trusted ports or after caller cancellation',async()=>{
 const f=fixture();await expect(readJiraSelfIdentity(binding,new AbortController().signal,{})).rejects.toThrow();const c=new AbortController();c.abort();await expect(readJiraSelfIdentity(binding,c.signal,f.ports)).rejects.toThrow();expect(f.fetcher).not.toHaveBeenCalled();
});
