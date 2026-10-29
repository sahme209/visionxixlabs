import 'server-only';
import {prisma} from '@/lib/db';
import {readDesktopCommercialAccess} from '@/lib/desktop/desktopCommercialAccess';
import {cloudCredentialContext} from '../enrollment/policy';
import {encryptScopedCredential,decryptScopedCredential} from '@/lib/security/credentialVault';
import {createAwsEnrollmentService,type EnrollmentRepo} from '../enrollment/service';
import {loadAwsGuidedRegistry} from './registry';
import {createAwsGuidedCallbackVerifier} from './callbackProof';
import {validateGuidedAwsRole} from './validateRole';
import {createAwsGuidedService,type AwsGuidedRepo,type AwsGuidedPorts} from './service';
/** No registry, callback attestor or policy is installed by source compilation.
 * Activation requires a separate reviewed immutable artifact and genuine account choices. */
export function createAwsGuidedRuntime(overrides?:Pick<AwsGuidedPorts,'readConfiguration'|'verifyCallbackProof'>){
 const repo=prisma as unknown as AwsGuidedRepo;
 const configured=async(s:Parameters<AwsGuidedPorts['readConfiguration']>[0])=>loadAwsGuidedRegistry(process.env.AWS_GUIDED_REGISTRY_JSON,s);
 const ports:AwsGuidedPorts={
  assertCurrent:async(tx,s,mode)=>{
   const members=await tx.$queryRaw<Array<{role:string;acceptedAt:Date|null}>>`SELECT "role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${s.userId} FOR SHARE`;
   if(!members[0]?.acceptedAt||!['owner','admin'].includes(members[0].role))throw Error('aws_guided_authority_required');
   if(mode==='manage'&&!(await readDesktopCommercialAccess(s.organizationId)).allowed)throw Error('aws_guided_authority_required');
   const sessions=await tx.$queryRaw<Array<{live:boolean}>>`SELECT ("revokedAt" IS NULL AND "expiresAt">clock_timestamp()) AS live FROM "DesktopSessionRecord" WHERE "id"=${s.sessionId} AND "organizationId"=${s.organizationId} AND "userId"=${s.userId} FOR SHARE`;
   if(!sessions[0]?.live)throw Error('aws_guided_authority_required');
  },
  readConfiguration:overrides?.verifyCallbackProof&&overrides.readConfiguration?overrides.readConfiguration:configured,
  verifyCallbackProof:overrides?.verifyCallbackProof??(async(row,body,signal)=>{if(!await configured({organizationId:row.organizationId,userId:row.userId,sessionId:row.sessionId}))throw Error('aws_guided_callback_verifier_unavailable');return createAwsGuidedCallbackVerifier()(row,body,signal)}),
  startEnrollment:async(tx,s,input)=>{const challenge=await createAwsEnrollmentService(tx as unknown as EnrollmentRepo).start(s,input);return{attemptId:challenge.attemptId,externalId:challenge.externalId,expiresAt:challenge.expiresAt}},
  completeEnrollment:async(s,id,external,signal)=>createAwsEnrollmentService(prisma as unknown as EnrollmentRepo,{validate:input=>validateGuidedAwsRole(input,signal)}).complete(s,id,external),
  readCanonicalConnection:async(tx,s,b)=>{const rows=await tx.$queryRaw<Array<{externalAccountId:string;regions:string[];enabled:boolean;version:number;revokedAt:Date|null;encryptedConfiguration:string}>>`SELECT a."externalAccountId",a."regions",a."enabled",c."version",c."revokedAt",c."encryptedConfiguration" FROM "CloudAccount" a JOIN "CloudAccountCredential" c ON c."id"=a."id" AND c."organizationId"=a."organizationId" WHERE a."id"=${b.id} AND a."organizationId"=${s.organizationId} AND a."provider"='aws' AND a."credentialRef"=${'cloud-v2:'+b.id} FOR SHARE OF a,c`;const r=rows[0];if(!r||r.enabled||r.externalAccountId!==b.accountId||!r.regions.includes(b.region)||r.version!==b.version||r.revokedAt)return false;try{const x=JSON.parse(decryptScopedCredential(r.encryptedConfiguration,cloudCredentialContext({organizationId:s.organizationId,accountId:b.id,version:b.version})));return x.expectedAccountId===b.accountId&&x.roleArn===b.roleArn&&x.region===b.region&&x.externalId===b.externalId}catch{return false}},
  seal:encryptScopedCredential,open:decryptScopedCredential,
 };
 return createAwsGuidedService(repo,ports);
}
