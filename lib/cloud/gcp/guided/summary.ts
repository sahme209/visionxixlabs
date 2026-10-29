import 'server-only';
import {decryptScopedCredential} from '@/lib/security/credentialVault';
interface Row{id:string;organizationId:string;externalAccountId:string;credentialRef:string|null;enabled:boolean;autopilotMode:string;credential:{organizationId:string;version:number;revokedAt:Date|null;validatedAt:Date;encryptedConfiguration:string}|null}
interface Repo{cloudAccount:{findMany(input:{where:{organizationId:string;provider:"gcp";enabled:false;autopilotMode:"observe_only"};include:{credential:true};take:number}):Promise<Row[]>}}
/** Read-only status only. Caller must authorize the paired workspace read before
 * and after this bounded DB operation. No tokens or account identifiers escape. */
export async function readGcpGuidedSummary(repo:Repo,organizationId:string,open=decryptScopedCredential):Promise<{provider:'gcp';status:'read_only_connected'|'not_connected'|'unavailable';lastTransitionAt:string|null}>{
 try{const rows=await repo.cloudAccount.findMany({where:{organizationId,provider:'gcp',enabled:false,autopilotMode:'observe_only'},include:{credential:true},take:100});if(!Array.isArray(rows)||rows.length>100)throw new Error();let latest:string|null=null;
 for(const r of rows){const c=r.credential;if(!c||c.revokedAt)continue;if(r.organizationId!==organizationId||c.organizationId!==organizationId||r.enabled||r.autopilotMode!=='observe_only'||r.credentialRef!==`cloud-v2:${r.id}`||!Number.isSafeInteger(c.version)||c.version<1||!(c.validatedAt instanceof Date)||!Number.isFinite(c.validatedAt.getTime()))throw new Error();const value=JSON.parse(open(c.encryptedConfiguration,JSON.stringify(['gcp-guided-account-v1',organizationId,r.id,c.version])));if(!value||value.kind!=='gcp_guided_oauth_v1'||value.projectId!==r.externalAccountId||typeof value.refreshToken!=='string'||!value.refreshToken)throw new Error();const time=c.validatedAt.toISOString();if(!latest||time>latest)latest=time;}
 return{provider:'gcp',status:latest?'read_only_connected':'not_connected',lastTransitionAt:latest};
 }catch{return{provider:'gcp',status:'unavailable',lastTransitionAt:null}}
}
