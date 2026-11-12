import 'server-only';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema} from '../contracts';
import {assertCurrentPlatformPrincipal} from '../currentAuthority';
import {createSettingsArtifactStore,type SettingsArtifactRepository} from './settingsArtifactStore';
interface Ports{
 repo:SettingsArtifactRepository;
 source:Parameters<typeof createSettingsArtifactStore>[2];
 verifyDesktopToken(token:string):{sessionId:string};
 readAdminEmails():readonly string[];
}
const fail=():never=>{throw Error('settings_artifact_request_unavailable')};
/** Private server composition only; no public route, principal JSON, cookie,
 * API-key fallback, credential export or provider execution. */
export async function createSettingsArtifactRequestComposition(request:{headers:Headers},ports:Ports){
 function session(){const token=bearerFromHeader(request.headers.get('authorization'));if(!token||token.length>4096)return fail();try{const result=ports.verifyDesktopToken(token);if(typeof result.sessionId!=='string'||!result.sessionId||result.sessionId.length>256)return fail();return result.sessionId}catch{return fail()}}
 const sessionId=session(),principal=await ports.repo.transaction(async tx=>{
  await tx.lock('platform-settings-auth:'+sessionId);const p=platformPrincipalSchema.parse(await tx.readSessionPrincipal(sessionId));
  if(p.sessionId!==sessionId||session()!==sessionId)return fail();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);if(session()!==sessionId)return fail();return p;
 });
 const possessed=()=>{if(session()!==principal.sessionId)return fail()};
 const store=createSettingsArtifactStore(ports.repo,{async assertCurrent(tx,p){possessed();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);possessed()}},ports.source);
 return Object.freeze({
  async save(id:string,index:number,value:unknown){possessed();return store.save(id,index,principal,value)},
  async review(id:string,version:number,planDigest:string){possessed();return store.review(id,version,planDigest,principal)},
 });
}
