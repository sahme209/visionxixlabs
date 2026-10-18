import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { verifyCustomerPlanProducer } from "../customerPlanProvenance";
import { customerProfile, backendState, hash } from "./customerPlanFixtures";
import { bytesDigest } from "../savedPlanArtifact";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { directBytes, directBinding, directProfile, directNow } from "@/lib/releaseops/ecsReleaseV2/__tests__/fixtures/directWorkflowFixture";

it("does not relabel a genuine OCI attestation as a Terraform binary/show/receipt tuple",async()=>{
 const p=customerProfile();p.repository.remoteId=directBinding.repositoryId;p.repository.fullName=directBinding.repositoryFullName;p.repository.sourceSha=directBinding.sourceSha;p.repository.sourceRef=directBinding.sourceRef;
 p.producer.workflowPath=directBinding.workflowPath;p.producer.workflowSha=directBinding.workflowSha;
 const binary=Buffer.from("synthetic-not-real-tfplan"),show=Buffer.from(JSON.stringify({format_version:"1.2",terraform_version:"1.9.8",resource_changes:[]}));
 const createdAt=new Date(directNow.getTime()-1000).toISOString(),expiresAt=new Date(directNow.getTime()+60_000).toISOString();
 const receipt=Buffer.from(JSON.stringify({schema:"axiom.terraform.plan-receipt.v2",profileDigest:sha256ContentHash(p),requestContentHash:hash("request"),targetDigest:hash("target"),
  producer:{repositoryId:p.repository.remoteId,repositoryFullName:p.repository.fullName,sourceRef:p.repository.sourceRef,sourceSha:p.repository.sourceSha,workflowPath:p.producer.workflowPath,workflowSha:p.producer.workflowSha,runId:directBinding.runId,runAttempt:directBinding.runAttempt,roleArn:p.producer.planRoleArn},
  backendIdentityDigest:sha256ContentHash(p.backend),workspace:"default",stateBefore:backendState(),stateAfter:backendState(),lock:"released",configurationDigest:p.configuration.treeDigest,providerLockDigest:p.configuration.providerLockDigest,
  terraformVersion:"1.9.8",executableDigest:hash("cli"),binary:{digest:bytesDigest(binary),bytes:binary.length},show:{digest:bytesDigest(show),bytes:show.length},createdAt,expiresAt}));
 expect(await verifyCustomerPlanProducer({profile:p,requestContentHash:hash("request"),targetDigest:hash("target"),run:{id:directBinding.runId,attempt:directBinding.runAttempt},binary,show,receipt,bundle:directBytes,
  trust:{publicProfile:directProfile,digest:hash("trust"),terraformVersion:"1.9.8",executableDigest:hash("cli"),reviewExpiresAt:directProfile.reviewExpiresAt,downloadPolicy:[]},now:directNow,authorize:async()=>true})).toMatchObject({kind:"unavailable"});
 // The published bundle remains exact evidence for its actual OCI subjects.
 expect(bytesDigest(directBytes)).toBe(bytesDigest(readFileSync("lib/releaseops/ecsReleaseV2/__tests__/fixtures/direct-workflow-oci/bundle.sigstore.json")));
});
