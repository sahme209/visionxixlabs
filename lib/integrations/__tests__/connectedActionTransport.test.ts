import {expect,it,vi} from 'vitest';
import {createConnectedActionTransport} from '../connectedActionTransport';
import {type ConnectedActionIntent} from '../connectedActionContract';
import {connectedActionId} from '../connectedActionIdentity';
const now=Date.parse('2030-01-01T00:00:00Z');
const team='11111111-1111-4111-8111-111111111111';
const intent:ConnectedActionIntent={kind:'linear_issue_create',provider:'linear',intentId:'22222222-2222-4222-8222-222222222222',organizationId:'org',requesterUserId:'owner',executorUserId:'owner',connectionId:'connection',connectionRevision:new Date(now-1000).toISOString(),workspaceId:team,targetEvidenceDigest:'a'.repeat(64),expiresAt:new Date(now+60000).toISOString(),teamId:team,title:'Acceptance',description:'No deployment performed.'};
function harness(overrides:Record<string,unknown>={}){
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:{issueCreate:{success:true,issue:{id:'33333333-3333-4333-8333-333333333333',identifier:'AX-1',url:'https://linear.app/axiom/issue/AX-1/acceptance',team:{id:team}}}}}));
 const credential={organizationId:'org',connectionId:'connection',connectionRevision:intent.connectionRevision,provider:'linear',workspaceId:intent.workspaceId,token:'synthetic-private-token',scopes:['read','issues:create'],expiresAt:now+120000};
 const readCredential=vi.fn().mockResolvedValue({...credential,...overrides});
 const assertCurrent=vi.fn().mockResolvedValue(undefined);
 const transport=createConnectedActionTransport({isEnabled:()=>true,readCredential,fetch:fetcher,now:()=>now});
 return{fetcher,readCredential,assertCurrent,run:(i=intent)=>transport.execute({operationId:connectedActionId(i),intent:i,signal:new AbortController().signal,assertCurrent})};
}
it('uses only the fixed Linear mutation and returns an exact-team provider receipt',async()=>{const h=harness();expect(await h.run()).toMatchObject({state:'confirmed',receipt:{provider:'linear',identifier:'AX-1'}});expect(h.fetcher).toHaveBeenCalledTimes(1);const[url,request]=h.fetcher.mock.calls[0];expect(url).toBe('https://api.linear.app/graphql');expect(request).toMatchObject({method:'POST',redirect:'error',credentials:'omit'});const body=JSON.parse(String(request?.body));expect(body.variables).toEqual({input:{teamId:team,title:'Acceptance',description:'No deployment performed.'}});expect(JSON.stringify(body)).not.toContain('synthetic-private-token');expect(h.assertCurrent.mock.calls.length).toBeGreaterThanOrEqual(3)});
it.each([{organizationId:'other'},{connectionId:'other'},{provider:'teams'},{connectionRevision:new Date(now).toISOString()},{scopes:['read']},{expiresAt:now+1000}])('refuses stale, foreign or underprivileged credentials before dispatch %j',async overrides=>{const h=harness(overrides);expect(await h.run()).toEqual({state:'refused'});expect(h.fetcher).not.toHaveBeenCalled()});
it('does not treat create-only scope as permission to update or close an issue',async()=>{const h=harness();const update={...intent,kind:'linear_issue_update' as const,issueId:team,title:'Updated'};delete update.description;expect(await h.run(update)).toEqual({state:'refused'});expect(h.fetcher).not.toHaveBeenCalled()});
it('returns unknown after a dispatched network failure and never retries',async()=>{const h=harness();h.fetcher.mockRejectedValue(Error('private upstream error'));expect(await h.run()).toEqual({state:'unknown'});expect(h.fetcher).toHaveBeenCalledTimes(1)});
it('refuses revoked approval before any provider request',async()=>{const h=harness();h.assertCurrent.mockRejectedValue(Error('revoked'));expect(await h.run()).toEqual({state:'refused'});expect(h.fetcher).not.toHaveBeenCalled()});
it('does not accept a receipt for a different team',async()=>{const h=harness();h.fetcher.mockResolvedValue(Response.json({data:{issueCreate:{success:true,issue:{id:team,identifier:'AX-1',url:'https://linear.app/axiom/issue/AX-1/test',team:{id:'44444444-4444-4444-8444-444444444444'}}}}}));expect(await h.run()).toEqual({state:'unknown'});expect(h.fetcher).toHaveBeenCalledTimes(1)});
it('does not accept redirects or arbitrary result hosts as provider evidence',async()=>{const h=harness();h.fetcher.mockResolvedValue(Response.json({data:{issueCreate:{success:true,issue:{id:team,identifier:'AX-1',url:'https://unrelated.example/AX-1',team:{id:team}}}}}));expect(await h.run()).toEqual({state:'unknown'})});

it('honors an explicitly recorded Linear write grant for issue creation',async()=>{const h=harness({scopes:['read','write']});expect(await h.run()).toMatchObject({state:'confirmed'});expect(h.fetcher).toHaveBeenCalledTimes(1)});
