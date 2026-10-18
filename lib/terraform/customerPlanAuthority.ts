import {hasDesktopCapability,type DesktopWorkspaceRole} from "@/lib/desktop/desktopAuthorization";
import {parseDeploymentIntake} from "@/lib/tauri/deploymentIntakeSchema";
import {sha256ContentHash} from "@/lib/tauri/contentHash";
import {parseCustomerPlanProfile,projectCustomerTarget,type CustomerPlanProfile,type CustomerTargetRows} from "./customerPlanContract";
export interface CustomerPlanPrincipal {organizationId:string;userId:string;sessionId:string}
export type CustomerPlanOperation="read"|"profile"|"import";
export interface CustomerPlanAuthorityRows extends CustomerTargetRows {
 device:{id:string;organizationId:string;userId:string;deviceFingerprint:string;expiresAt:Date;revokedAt:Date|null};
 membership:{userId:string;organizationId:string;role:string;acceptedAt:Date|null;updatedAt:Date};
 request:{id:string;organizationId:string;version:number;intakeJson:unknown};
 version:{organizationId:string;deploymentRequestId:string;version:number;intakeJson:unknown;contentHash:string};
 environment:CustomerTargetRows["environment"]&{slug:string;name:string;approvalPolicyId:string|null};
 policy:{id:string;organizationId:string;enabled:boolean;blockAction:boolean;updatedAt:Date}|null;
 repository:{id:string;organizationId:string;provider:string;remoteOwner:string;remoteName:string;remoteUrl:string;updatedAt:Date};
 installation:{id:string;organizationId:string;githubInstallationId:string;accountLogin:string;status:string;revokedAt:Date|null;suspendedAt:Date|null;updatedAt:Date};
}
export interface CurrentCustomerPlanContext {kind:"current_customer_plan_context";profile:CustomerPlanProfile;targetDigest:string;requestContentHash:string;contextDigest:string}
const stamp=(v:unknown):v is Date=>v instanceof Date&&Number.isFinite(v.getTime());
/** Current paired actor only; revocation can use this without asserting that
 * a disconnected connection or changed target is still reviewed/current. */
export function inspectCustomerPlanActor(rows:Pick<CustomerPlanAuthorityRows,"device"|"membership">,principal:CustomerPlanPrincipal,operation:CustomerPlanOperation,now:Date):DesktopWorkspaceRole|null{
 try{
  const {device:d,membership:m}=rows;
  if(!stamp(now)||d.id!==principal.sessionId||d.organizationId!==principal.organizationId||d.userId!==principal.userId||d.revokedAt!==null||!stamp(d.expiresAt)||d.expiresAt<=now||typeof d.deviceFingerprint!=="string"||!d.deviceFingerprint
   ||m.organizationId!==principal.organizationId||m.userId!==principal.userId||!stamp(m.acceptedAt)||!stamp(m.updatedAt)||!["owner","admin","operator","security_reviewer","finance_viewer","read_only"].includes(m.role))return null;
  const role=m.role as DesktopWorkspaceRole;
  if(!hasDesktopCapability(role,"workspace:read")||operation!=="read"&&(!["owner","admin"].includes(role)||!hasDesktopCapability(role,"connections:manage"))||operation==="profile"&&!hasDesktopCapability(role,"policy:manage"))return null;
  return role;
 }catch{return null;}
}
function repositoryName(value:string):string|null{
 try{const url=new URL(value);if(url.protocol!=="https:"||url.hostname!=="github.com"||url.port||url.username||url.password||url.search||url.hash)return null;
  const name=url.pathname.replace(/^\//,"").replace(/\/$/,"").replace(/\.git$/,"");return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)?name.toLowerCase():null;
 }catch{return null;}
}
/** Feature-local current-context decision only. Reuse current desktop
 * capabilities and the Terraform target projection; no new approval engine.
 * Call with independently loaded rows, then load/lock/recheck at commit. */
export function inspectCustomerPlanAuthority(profileInput:unknown,rowsInput:unknown,principal:CustomerPlanPrincipal,operation:CustomerPlanOperation,now:Date):CurrentCustomerPlanContext|null{
 try{
  const p=parseCustomerPlanProfile(profileInput),r=rowsInput as CustomerPlanAuthorityRows;
  const {device:d,membership:m,request:q,version:v,environment:e,repository:g,installation:i}=r;
  if(p.organizationId!==principal.organizationId||!inspectCustomerPlanActor(r,principal,operation,now))return null;
  if(q.id!==p.deploymentRequestId||q.organizationId!==principal.organizationId||q.version!==p.requestVersion||v.organizationId!==principal.organizationId||v.deploymentRequestId!==q.id||v.version!==q.version||!/^[a-f0-9]{64}$/.test(v.contentHash)
   ||sha256ContentHash(v.intakeJson)!==v.contentHash||sha256ContentHash(q.intakeJson)!==v.contentHash)return null;
  const parsed=parseDeploymentIntake(q.intakeJson);if(!parsed.ok||parsed.intake.tenantId!==principal.organizationId)return null;
  const name=p.repository.fullName.toLowerCase();
  if(e.id!==p.environmentId||e.organizationId!==principal.organizationId||![e.slug,e.name].includes(parsed.intake.targetEnvironment)
   ||g.id!==p.repository.recordId||g.organizationId!==principal.organizationId||g.provider!=="github"||`${g.remoteOwner}/${g.remoteName}`.toLowerCase()!==name||repositoryName(g.remoteUrl)!==name
   ||!parsed.intake.repositoryUrls.some(url=>repositoryName(url)===name)||!stamp(g.updatedAt)||!stamp(i.updatedAt)
   ||i.organizationId!==principal.organizationId||i.status!=="active"||i.revokedAt!==null||i.suspendedAt!==null||i.accountLogin.toLowerCase()!==g.remoteOwner.toLowerCase()||!/^[1-9]\d{0,15}$/.test(i.githubInstallationId)||!Number.isSafeInteger(Number(i.githubInstallationId)))return null;
  if(e.approvalPolicyId!==null){const policy=r.policy;if(!policy||policy.id!==e.approvalPolicyId||policy.organizationId!==principal.organizationId||typeof policy.enabled!=="boolean"||typeof policy.blockAction!=="boolean"||!stamp(policy.updatedAt))return null;}
  else if(r.policy!==null)return null;
  const target=projectCustomerTarget(p,r);if(!target)return null;
  // Explicit ISO fields prevent Date objects becoming empty objects in the
  // existing canonical JSON hash. No remote observation becomes a DB permit.
  const contextDigest=sha256ContentHash({schema:"axiom.terraform.current-context.v2",profileDigest:sha256ContentHash(p),targetDigest:target.digest,principal,
   device:{id:d.id,organizationId:d.organizationId,userId:d.userId,deviceFingerprint:d.deviceFingerprint,expiresAt:d.expiresAt.toISOString(),revokedAt:null},
   membership:{userId:m.userId,organizationId:m.organizationId,role:m.role,acceptedAt:m.acceptedAt!.toISOString(),updatedAt:m.updatedAt.toISOString()},
   request:{id:q.id,organizationId:q.organizationId,version:q.version,contentHash:v.contentHash},environment:{id:e.id,approvalPolicyId:e.approvalPolicyId,name:e.name,slug:e.slug,updatedAt:e.updatedAt.toISOString()},
   policy:r.policy?{...r.policy,updatedAt:r.policy.updatedAt.toISOString()}:null,repository:{...g,updatedAt:g.updatedAt.toISOString()},installation:{...i,updatedAt:i.updatedAt.toISOString()},
   connection:{id:r.account.id,version:r.credential.version}});
  return {kind:"current_customer_plan_context",profile:p,targetDigest:target.digest,requestContentHash:v.contentHash,contextDigest};
 }catch{return null;}
}
