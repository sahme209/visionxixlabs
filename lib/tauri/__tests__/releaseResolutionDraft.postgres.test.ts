import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import {afterAll,beforeAll,beforeEach,describe,expect,it} from "vitest";
import {realpathSync,statSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {PrismaClient} from "@/lib/prismaClient";
import {createReleaseResolutionDraft} from "../releaseResolutionDraft";
import {reviseDeploymentRequest,type DeploymentRequestRepo} from "../deploymentRequestRepo";
import type {DeploymentIntake} from "../deploymentOperations";
const socket=process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
function intake(): DeploymentIntake {
    return {
        id: "dep-01",
        tenantId: "tenant-a",
        title: "Production configuration release",
        serviceImpactingNow: false,
        requestClass: "planned_release",
        windowStartUtc: "2026-10-10T18:00:00.000Z",
        windowEndUtc: "2026-10-10T20:00:00.000Z",
        displayTimeZone: "ET",
        changeTypes: ["configuration_change"],
        applications: ["Checkout"],
        clients: ["Client A"],
        deploymentContact: "operator@example.test",
        repositoryUrls: ["https://git.example.test/checkout"],
        productionPrUrls: ["https://git.example.test/checkout/pull/42"],
        noPrRequired: false,
        prApprovalStatus: "approved",
        sourceBranch: "release/42",
        targetBranch: "main",
        deploymentMethod: "GitHub Actions",
        workflowName: "Deploy Config",
        targetEnvironment: "Production",
        workflowInputs: { branch: "main", client: "Client A" },
        manualSteps: [],
        lowerEnvironmentTested: ["Stage"],
        lowerEnvironmentValidation: "yes",
        developmentReady: true,
        productionReady: true,
        validationSteps: [{
            id: "validate",
            instruction: "Confirm the approved configuration.",
            owner: "application_team",
            evidenceRequired: true,
            completed: false,
        }],
        expectedProductionResult: "Approved configuration is active.",
        validationOwner: "shared",
        rollbackAvailability: "yes",
        rollbackSteps: [{
            id: "rollback",
            instruction: "Redeploy the prior known-good version.",
            owner: "devops",
            evidenceRequired: true,
            completed: false,
        }],
        rollbackOwner: "operator@example.test",
        backupRequired: false,
        backupEvidenceIds: [],
        changeCreationMethod: "manual_servicenow",
        applicationContact: "owner@example.test",
        escalationContact: "incident@example.test",
        facts: [{
            id: "fact-01",
            classification: "confirmed",
            value: "Workflow dispatch is the production trigger.",
            sourceEvidenceId: "evidence-01",
            confirmedBy: "owner@example.test",
        }],
    };
}

describe.skipIf(!socket)("ticket resolution drafts on owned PostgreSQL",()=>{
 let db:PrismaClient;let org="";
 const input=()=>({organizationId:org,requesterUserId:"owned_user",actorRole:"requester",correlationId:"ticket",draft:{kind:"resolution_draft",schemaVersion:1,id:"owned_draft_"+randomUUID(),tenantId:org,title:"Ticket first",applications:["Checkout"],requestDetails:"Resolve the owning repository."}});
 beforeAll(async()=>{
  if(!socket||!/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||statSync(socket).uid!==process.getuid?.())throw Error("owned_private_socket_required");
  db=createDatabaseClient(`postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`);
  const [binding]=await db.$queryRawUnsafe<Array<{private:boolean}>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);if(!binding?.private)throw Error("owned_fixture_binding_required");
 });
 beforeEach(()=>{org="owned_resolution_"+randomUUID()});
 afterAll(async()=>{if(db)await db.$disconnect()});
 it("stores one unsubmitted draft, snapshot and audit across identical retries",async()=>{
  const request=input();const first=await createReleaseResolutionDraft(db as unknown as DeploymentRequestRepo,request);expect(first).toMatchObject({ok:true,replayed:false,request:{status:"draft",submittedAt:null}});
  expect(await createReleaseResolutionDraft(db as unknown as DeploymentRequestRepo,{...request,draft:{...request.draft,id:"another-generated-id"}})).toMatchObject({ok:true,replayed:true});
  expect(await db.tauriDeploymentRequest.count({where:{organizationId:org}})).toBe(1);expect(await db.tauriDeploymentRequestVersion.count({where:{organizationId:org}})).toBe(1);expect(await db.tauriAuditEvent.count({where:{organizationId:org}})).toBe(1);
 });
 it("rolls back both draft and version when audit insertion fails",async()=>{
  await db.$executeRawUnsafe(`CREATE FUNCTION public.axiom_owned_resolution_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned_audit_refused'; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER axiom_owned_resolution_refuse BEFORE INSERT ON "TauriAuditEvent" FOR EACH ROW WHEN (NEW.action='deployment_request.draft_created') EXECUTE FUNCTION public.axiom_owned_resolution_refuse()`);
  try{await expect(createReleaseResolutionDraft(db as unknown as DeploymentRequestRepo,input())).rejects.toThrow();expect(await db.tauriDeploymentRequest.count({where:{organizationId:org}})).toBe(0);expect(await db.tauriDeploymentRequestVersion.count({where:{organizationId:org}})).toBe(0);}finally{await db.$executeRawUnsafe(`DROP TRIGGER axiom_owned_resolution_refuse ON "TauriAuditEvent"`);await db.$executeRawUnsafe(`DROP FUNCTION public.axiom_owned_resolution_refuse()`)}
 });
 it("allows one complete version claim and preserves the original ticket",async()=>{
  const request=input();await createReleaseResolutionDraft(db as unknown as DeploymentRequestRepo,request);const complete={...intake(),id:request.draft.id,tenantId:org,workflowSource:{repositoryFullName:"owned/checkout",ref:"release/42",path:".github/workflows/release.yml",blobSha:"a".repeat(40)}};
  const revision={organizationId:org,requesterUserId:"owned_user",actorRole:"requester",correlationId:"complete",requestId:request.draft.id,expectedVersion:1,intake:complete};
  const results=await Promise.all([reviseDeploymentRequest(db as unknown as DeploymentRequestRepo,revision),reviseDeploymentRequest(db as unknown as DeploymentRequestRepo,{...revision,correlationId:"competing",intake:{...complete,title:"Competing complete intake"}})]);
  expect(results.filter(r=>r.ok)).toHaveLength(1);expect(results.filter(r=>!r.ok)).toHaveLength(1);
  const stored=await db.tauriDeploymentRequest.findUniqueOrThrow({where:{id:request.draft.id}});expect(stored).toMatchObject({status:"submitted",version:2,submittedAt:expect.any(Date)});
  const versions=await db.tauriDeploymentRequestVersion.findMany({where:{deploymentRequestId:stored.id},orderBy:{version:"asc"}});expect(versions).toHaveLength(2);expect(versions[1].intakeJson).toMatchObject({workflowSource:complete.workflowSource});expect(stored.intakeJson).toMatchObject({workflowSource:complete.workflowSource});expect(versions[0].intakeJson).toMatchObject({kind:"resolution_draft",requestDetails:"Resolve the owning repository."});
 });
 it("refuses another workspace before any storage mutation",async()=>{
  expect(await createReleaseResolutionDraft(db as unknown as DeploymentRequestRepo,{...input(),organizationId:"another_org"})).toMatchObject({ok:false,reason:"tenant_mismatch"});expect(await db.tauriDeploymentRequest.count({where:{organizationId:org}})).toBe(0);
 });
});
