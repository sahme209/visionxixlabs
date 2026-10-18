import type {CustomerPlanProfileView,CustomerPlanImported} from "../../../lib/terraform/customerPlanDto";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const strings=(v:unknown,keys:string[])=>object(v)&&keys.every(k=>typeof v[k]==="string"&&v[k].length>0&&v[k].length<=1024);
const positive=(v:unknown)=>Number.isSafeInteger(v)&&(v as number)>0&&(v as number)<=2147483647;
const hex=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
/** Defensive presentation guard only. The server reauthorizes every operation. */
export function isCustomerPlanProfileView(value:unknown,requestId:string):value is CustomerPlanProfileView{
 if(!object(value)||value.kind!=="customer_plan_profile"||value.approval!=="unavailable"||value.executionAllowed!==false||!["unconfigured","active","revoked"].includes(String(value.status))||!["not_observed","unavailable"].includes(String(value.currentTarget))||!object(value.permissions)||typeof value.permissions.configure!=="boolean"||typeof value.permissions.import!=="boolean")return false;
 const p=value.profile;
 if(p===null)return value.status==="unconfigured"&&value.currentTarget==="unavailable"&&value.profileExport===undefined;
 if(!object(p)||value.status==="unconfigured"||p.schema!=="axiom.terraform.customer-profile.v2"||p.deploymentRequestId!==requestId||!strings(p,["id","organizationId","environmentId"])||!positive(p.requestVersion)||!positive(p.revision)
  ||!strings(p.repository,["recordId","remoteId","fullName","sourceRef","sourceSha"])||!strings(p.producer,["workflowPath","workflowSha","workflowDigest","scriptPath","scriptDigest","trustProfileId","toolchainProfileId","planRoleArn"])||!strings(p.configuration,["root","treeDigest","providerLockDigest"])||!strings(p.backend,["kind","accountId","region","bucket","key","workspace","lockTable","lockKey"])||!strings(p.artifacts,["bucket","region","prefix","kmsKeyArn"])||!object(p.connection)||!strings(p.connection,["id"])||!positive(p.connection.version))return false;
 if(value.status==="revoked"&&value.currentTarget!=="unavailable")return false;
 if(value.profileExport!==undefined){const e=value.profileExport;if(value.status!=="active"||!object(e)||e.schema!=="axiom.terraform.profile-export.v2"||JSON.stringify(e.profile)!==JSON.stringify(p)||!hex(e.requestContentHash)||!hex(e.targetDigest)||!object(e.toolchain)||typeof e.toolchain.version!=="string"||!/^1\.\d+\.\d+$/.test(e.toolchain.version)||!hex(e.toolchain.executableDigest))return false;}
 return true;
}
export function isCustomerPlanImported(value:unknown):value is CustomerPlanImported{return object(value)&&value.kind==="customer_plan_imported"&&typeof value.artifactId==="string"&&/^tfcp_[a-f0-9]{64}$/.test(value.artifactId)&&typeof value.reused==="boolean"&&value.approval==="unavailable"&&value.executionAllowed===false;}
