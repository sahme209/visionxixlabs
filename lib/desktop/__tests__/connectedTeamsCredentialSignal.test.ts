import {it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const io=vi.hoisted(()=>({phase:false,controller:new AbortController(),beforeCredential:vi.fn(),lateDecrypt:vi.fn(),intent:{} as any}));
vi.mock('@/lib/integrations/connectedActionStore',()=>({createConnectedActionStore:()=>({get:async()=>({intent:io.intent}),claim:async()=>({claimed:true,record:{intent:io.intent}})})}));
vi.mock('@/lib/governance/intelligence/uncoveredMutationStore',()=>({fenceUncoveredMutationStore:(s:unknown)=>s}));
vi.mock('@/lib/governance/intelligence/teamsOutboundDrain',()=>({createTeamsOutboundDrain:()=>({assertAvailable:()=>{},beforeCredential:io.beforeCredential,beforeSubmission:()=>{}})}));
vi.mock('@/lib/integrations/connectedActionDiscovery',()=>({readConnectedActionTargets:async()=>({workspaceId:'11111111-1111-4111-8111-111111111111'}),connectedTargetDigest:()=>''}));
vi.mock('@/lib/integrations/connectedActionTransport',()=>({createConnectedActionTransport:(ports:any)=>({execute:async()=>{io.phase=true;await ports.readCredential(io.intent,io.controller.signal);throw Error('SIMULATED callback unexpectedly resolved')}})}));
import {createConnectedActionsHttp} from '../connectedActionsHttp';
it('propagates the shorter transport credential signal and refuses plaintext decrypt after connection-read cancellation (simulated composition)',async()=>{
 io.phase=false;io.controller=new AbortController();io.beforeCredential.mockReset();io.lateDecrypt.mockReset();io.intent={provider:'teams',kind:'teams_channel_message',teamId:'11111111-1111-4111-8111-111111111111'};
 const h=createConnectedActionsHttp({repo:{} as any,readPrincipal:async()=>({id:'s',userId:'owner',organizationId:'signal-test',credentialKind:'desktop_session',capabilities:['connections:manage']}),enabled:()=>true,
 readConnection:async()=>{if(io.phase)io.controller.abort(Error('SIMULATED inner timeout'));return{id:'c',organizationId:'signal-test',provider:'teams',status:'active',revokedAt:null,consentedByUserId:'owner',externalAccountId:'11111111-1111-4111-8111-111111111111',updatedAt:new Date(0),lastValidatedAt:new Date(),encryptedCredential:'synthetic',scopesJson:[]}},
 decrypt:()=>{if(io.phase)io.lateDecrypt();return JSON.stringify({accessToken:'SIMULATED',expiresAt:Date.now()+60000})}});
 const response=await h(new NextRequest('https://visionxixlabs.com/api/desktop/integrations/teams/actions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'execute',id:'connected_action_'+'a'.repeat(64),expectedVersion:1})}),'teams');
 expect(response.status).toBe(409);expect(io.beforeCredential).toHaveBeenCalledWith(io.intent,io.controller.signal);expect(io.lateDecrypt).not.toHaveBeenCalled();
});
