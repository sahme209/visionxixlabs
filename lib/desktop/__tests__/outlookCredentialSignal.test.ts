import {it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const io=vi.hoisted(()=>({phase:false,controller:new AbortController(),lateDecrypt:vi.fn(),beforeCredential:vi.fn(),intent:{} as any}));
vi.mock('@/lib/integrations/connectedActionStore',()=>({createConnectedActionStore:()=>({get:async()=>({intent:io.intent}),claim:async()=>({claimed:true,record:{intent:io.intent}})})}));
vi.mock('@/lib/governance/intelligence/uncoveredMutationStore',()=>({fenceUncoveredMutationStore:(s:unknown)=>s}));
vi.mock('@/lib/governance/intelligence/outlookOutboundDrain',()=>({createOutlookMailOutboundDrain:()=>({assertAvailable:()=>{},beforeCredential:io.beforeCredential,beforeSubmission:()=>{}}),createOutlookEventOutboundDrain:()=>({assertAvailable:()=>{},beforeCredential:io.beforeCredential,beforeSubmission:()=>{}})}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async()=>({id:'s',userId:'owner',organizationId:'signal-test',credentialKind:'desktop_session',capabilities:['workspace:read','connections:manage']})}));
vi.mock('@/lib/desktop/desktopCommercialAccess',()=>({readDesktopCommercialAccess:async()=>({allowed:true})}));
vi.mock('@/lib/api/rateLimiter',()=>({consumeToken:()=>({allowed:true})}));
vi.mock('@/lib/db',()=>({prisma:{$transaction:async(fn:any)=>fn({$queryRaw:async()=>{if(io.phase)io.controller.abort(Error('SIMULATED inner timeout'));return[{id:'c',organizationId:'signal-test',provider:'outlook',status:'active',revokedAt:null,consentedByUserId:'owner',externalAccountId:'mailbox',updatedAt:new Date(0),lastValidatedAt:new Date(),encryptedCredential:'SIMULATED',scopesJson:['User.Read','Mail.ReadBasic','Mail.Send','Calendars.ReadWrite']}]}})}}));
vi.mock('@/lib/security/credentialVault',()=>({decryptScopedCredential:()=>{if(io.phase)io.lateDecrypt();return JSON.stringify({purpose:'outlook_actions_v1',accessToken:'SIMULATED',refreshToken:null,expiresAt:Date.now()+60000,account:{id:'mailbox',displayName:'Synthetic',email:'owner@example.com'},scopes:['User.Read','Mail.ReadBasic','Mail.Send','Calendars.ReadWrite']})}}));
vi.mock('@/lib/integrations/outlook/outlookActionTransport',()=>({createOutlookActionTransport:(ports:any)=>({dispatch:async()=>{io.phase=true;await ports.readCredential(io.intent,io.controller.signal);throw Error('SIMULATED callback unexpectedly resolved')}})}));
import {outlookActionsHttp} from '../outlookActionsHttp';
it('propagates transport child cancellation across database awaits before Outlook bearer decryption (simulated composition)',async()=>{
 io.phase=false;io.controller=new AbortController();io.beforeCredential.mockReset();io.lateDecrypt.mockReset();io.intent={provider:'outlook',kind:'outlook_mail_send',connectionId:'c',connectionRevision:new Date(0).toISOString()};
 vi.stubEnv('AXIOM_OUTLOOK_ACTIONS_ENABLED','true');vi.stubEnv('AXIOM_OUTLOOK_CONNECTIONS_ENABLED','true');
 try{const result=await outlookActionsHttp(new NextRequest('https://visionxixlabs.com/api/desktop/integrations/outlook/actions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'execute',id:'connected_action_'+'a'.repeat(64),expectedVersion:1})}));
 expect(result.status).toBe(409);expect(io.beforeCredential).toHaveBeenCalledWith(io.intent,io.controller.signal);expect(io.lateDecrypt).not.toHaveBeenCalled();
 }finally{vi.unstubAllEnvs()}
});
