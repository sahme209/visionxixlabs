import "server-only";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { bytesDigest } from "./savedPlanArtifact";
import type { SavedPlanDatabase, SavedPlanStorageReadiness } from "./savedPlanStore";
import { parseCustomerPlanProfile, type CustomerPlanProfile } from "./customerPlanContract";

export const CUSTOMER_PLAN_PROPOSAL_CHECKSUM = "887efd506bc3af13d2725784f94811f33c7e1a3e372ae3c95b35682e1990240b";
const expectedColumns = [
 "TerraformCustomerPlanCurrent:deploymentRequestId:text:true",
 "TerraformCustomerPlanCurrent:environmentId:text:true",
 "TerraformCustomerPlanCurrent:id:text:true",
 "TerraformCustomerPlanCurrent:organizationId:text:true",
 "TerraformCustomerPlanCurrent:revision:integer:true",
 "TerraformCustomerPlanCurrent:status:text:true",
 "TerraformCustomerPlanCurrent:updatedAt:timestamp(3) without time zone:true",
 "TerraformCustomerPlanFeature:proposalChecksum:text:true",
 "TerraformCustomerPlanFeature:version:integer:true",
 "TerraformCustomerPlanProfile:actorUserId:text:true",
 "TerraformCustomerPlanProfile:createdAt:timestamp(3) without time zone:true",
 "TerraformCustomerPlanProfile:deploymentRequestId:text:true",
 "TerraformCustomerPlanProfile:environmentId:text:true",
 "TerraformCustomerPlanProfile:id:text:true",
 "TerraformCustomerPlanProfile:organizationId:text:true",
 "TerraformCustomerPlanProfile:profileDigest:text:true",
 "TerraformCustomerPlanProfile:profileJson:jsonb:true",
 "TerraformCustomerPlanProfile:requestVersion:integer:true",
 "TerraformCustomerPlanProfile:revision:integer:true",
 "TerraformCustomerPlanProvenance:artifactId:text:true",
 "TerraformCustomerPlanProvenance:attestationDigest:text:true",
 "TerraformCustomerPlanProvenance:binaryDigest:text:true",
 "TerraformCustomerPlanProvenance:bindingDigest:text:true",
 "TerraformCustomerPlanProvenance:createdAt:timestamp(3) without time zone:true",
 "TerraformCustomerPlanProvenance:deploymentRequestId:text:true",
 "TerraformCustomerPlanProvenance:encryptedProof:text:true",
 "TerraformCustomerPlanProvenance:organizationId:text:true",
 "TerraformCustomerPlanProvenance:profileId:text:true",
 "TerraformCustomerPlanProvenance:profileRevision:integer:true",
 "TerraformCustomerPlanProvenance:receiptDigest:text:true",
 "TerraformCustomerPlanProvenance:requestVersion:integer:true",
 "TerraformCustomerPlanProvenance:showDigest:text:true",
 "TerraformCustomerPlanProvenance:trustDigest:text:true"
];
const expectedConstraints: Record<string,string> = {
 "tfcp_feature_pk": "primarykeyversion",
 "tfcp_feature_version": "checkversion=2",
 "tfcp_feature_checksum": "checkproposalchecksum~'^[a-f0-9]{64}$'",
 "tfcp_profile_revision": "checkrevision>0",
 "tfcp_profile_version": "checkrequestversion>0",
 "tfcp_profile_digest": "checkprofiledigest~'^[a-f0-9]{64}$'",
 "tfcp_profile_pk": "primarykeyid,revision",
 "tfcp_profile_scope": "uniqueid,revision,organizationid,deploymentrequestid",
 "tfcp_profile_request": "foreignkeydeploymentrequestidreferencestaurideploymentrequestid",
 "tfcp_profile_environment": "foreignkeyenvironmentidreferencesenvironmentid",
 "tfcp_current_pk": "primarykeyid",
 "tfcp_current_revision": "checkrevision>0",
 "tfcp_current_status": "checkstatus=anyarray['active','revoked']",
 "tfcp_current_scope": "uniqueorganizationid,deploymentrequestid",
 "tfcp_current_profile": "foreignkeyid,revision,organizationid,deploymentrequestidreferencesterraformcustomerplanprofileid,revision,organizationid,deploymentrequestid",
 "tfcp_provenance_pk": "primarykeyartifactid",
 "tfcp_provenance_version": "checkrequestversion>0",
 "tfcp_provenance_binding": "checkbindingdigest~'^[a-f0-9]{64}$'",
 "tfcp_provenance_binary": "checkbinarydigest~'^[a-f0-9]{64}$'",
 "tfcp_provenance_show": "checkshowdigest~'^[a-f0-9]{64}$'",
 "tfcp_provenance_receipt": "checkreceiptdigest~'^[a-f0-9]{64}$'",
 "tfcp_provenance_attestation": "checkattestationdigest~'^sha256:[a-f0-9]{64}$'",
 "tfcp_provenance_trust": "checktrustdigest~'^[a-f0-9]{64}$'",
 "tfcp_provenance_artifact": "foreignkeyartifactidreferencesterraformsavedplanartifactid",
 "tfcp_provenance_profile": "foreignkeyprofileid,profilerevision,organizationid,deploymentrequestidreferencesterraformcustomerplanprofileid,revision,organizationid,deploymentrequestid"
};
const expectedFunctions: Record<string,string> = {
 "axiom_customer_plan_profile_guard_v2": "b8d2768de20f344cccbe287db1589d4538780a154987d739655bee5f5de2914b",
 "axiom_customer_plan_current_guard_v2": "910ab2f8fe29502d75077deb7c5be691306748e48967fb4c629fd72154d59deb",
 "axiom_customer_plan_provenance_guard_v2": "3fbfe2d888ab4fda8b26b2312edfb3e9915bbfe9638a11f41ee5f14daec5e72b"
};
const tables = ["TerraformCustomerPlanFeature","TerraformCustomerPlanProfile","TerraformCustomerPlanCurrent","TerraformCustomerPlanProvenance"];
const normalizeConstraint = (value: string) => value.replace(/::text/g, "").replace(/public\./g, "").replace(/[\s"()]/g, "").toLowerCase();
interface Catalog { columns:string[]; constraints:Record<string,string>; functions:Record<string,string>; triggers:string[] }
/** Exact optional schema contract, never an installer or implicit adoption. */
export async function readCustomerPlanStorageReadiness(db: SavedPlanDatabase): Promise<SavedPlanStorageReadiness> {
 try {
  const [presence] = await db.$queryRawUnsafe<Array<{feature:boolean;profile:boolean;current:boolean;provenance:boolean}>>(`SELECT
   to_regclass('public."TerraformCustomerPlanFeature"') IS NOT NULL AS feature,
   to_regclass('public."TerraformCustomerPlanProfile"') IS NOT NULL AS profile,
   to_regclass('public."TerraformCustomerPlanCurrent"') IS NOT NULL AS current,
   to_regclass('public."TerraformCustomerPlanProvenance"') IS NOT NULL AS provenance`);
  if (!presence) return "unavailable";
  const flags=[presence.feature,presence.profile,presence.current,presence.provenance];
  if (flags.every(v=>v===false)) return "not_installed";
  if (!flags.every(v=>v===true)) return "drift";
  const marker=await db.$queryRawUnsafe<Array<{version:number;proposalChecksum:string}>>('SELECT "version","proposalChecksum" FROM public."TerraformCustomerPlanFeature" LIMIT 2');
  if (marker.length!==1 || marker[0].version!==2 || marker[0].proposalChecksum!==CUSTOMER_PLAN_PROPOSAL_CHECKSUM) return "drift";
  const [catalog]=await db.$queryRawUnsafe<Catalog[]>(`SELECT
   ARRAY(SELECT c.relname||':'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1) AS columns,
   (SELECT jsonb_object_agg(k.conname,pg_get_constraintdef(k.oid)) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])) AS constraints,
   (SELECT jsonb_object_agg(p.proname,p.prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.pronargs=0 AND p.proname=ANY($2::text[])) AS functions,
   ARRAY(SELECT c.relname||':'||t.tgname||':'||t.tgtype::text||':'||t.tgenabled::text||':'||pn.nspname||'.'||p.proname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal ORDER BY 1) AS triggers`,tables,Object.keys(expectedFunctions));
  if (!catalog || !Array.isArray(catalog.columns) || JSON.stringify([...catalog.columns].sort())!==JSON.stringify(expectedColumns)) return "drift";
  if (!catalog.constraints || Object.keys(catalog.constraints).length!==Object.keys(expectedConstraints).length || !Object.entries(expectedConstraints).every(([k,v])=>typeof catalog.constraints[k]==="string" && normalizeConstraint(catalog.constraints[k])===v)) return "drift";
  if (!catalog.functions || Object.keys(catalog.functions).length!==3 || !Object.entries(expectedFunctions).every(([k,v])=>typeof catalog.functions[k]==="string" && bytesDigest(catalog.functions[k])===v)) return "drift";
  const triggers=["TerraformCustomerPlanProfile:axiom_customer_plan_profile_guard_v2:31:O:public.axiom_customer_plan_profile_guard_v2","TerraformCustomerPlanCurrent:axiom_customer_plan_current_guard_v2:31:O:public.axiom_customer_plan_current_guard_v2","TerraformCustomerPlanProvenance:axiom_customer_plan_provenance_guard_v2:31:O:public.axiom_customer_plan_provenance_guard_v2"].sort();
  if (!Array.isArray(catalog.triggers) || JSON.stringify([...catalog.triggers].sort())!==JSON.stringify(triggers)) return "drift";
  return "ready";
 } catch {return "unavailable";}
}
export interface CurrentCustomerProfile { profile:CustomerPlanProfile; status:"active"|"revoked" }
/** Internal read; caller must prove readiness first. No profile mutation. */
export async function readCurrentCustomerProfile(db:SavedPlanDatabase,scope:{organizationId:string;requestId:string},lock=false):Promise<CurrentCustomerProfile|null> {
 const rows=await db.$queryRawUnsafe<Array<{id:string;revision:number;status:string;profileJson:unknown;profileDigest:string}>>(`SELECT c."id",c."revision",c."status",p."profileJson",p."profileDigest" FROM public."TerraformCustomerPlanCurrent" c JOIN public."TerraformCustomerPlanProfile" p ON p."id"=c."id" AND p."revision"=c."revision" AND p."organizationId"=c."organizationId" AND p."deploymentRequestId"=c."deploymentRequestId" WHERE c."organizationId"=$1 AND c."deploymentRequestId"=$2 LIMIT 2${lock?" FOR UPDATE OF c,p":""}`,scope.organizationId,scope.requestId);
 if (rows.length===0) return null;
 if (rows.length!==1) throw new Error("customer_plan_profile_unavailable");
 const row=rows[0],profile=parseCustomerPlanProfile(row.profileJson);
 if (profile.organizationId!==scope.organizationId || profile.deploymentRequestId!==scope.requestId || profile.id!==row.id || profile.revision!==row.revision || sha256ContentHash(profile)!==row.profileDigest || !["active","revoked"].includes(row.status)) throw new Error("customer_plan_profile_unavailable");
 return {profile,status:row.status as "active"|"revoked"};
}
