import 'server-only';
import {createAgentGithubOutboundDrain} from '@/lib/governance/intelligence/agentGithubOutboundDrain';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {githubPullRequestReviewFromArgs} from '@/lib/tauri/agentGithubPullRequestReview';
import {pullRequestProposalReview} from '@/lib/cockpit/pullRequestProposalReview';
import {executeStoredAgentDeployment,agentDeploymentArgsSchema,type AgentDeploymentExecutionRepo} from './agentActionDeploymentExecution';
import {z} from 'zod';
import {buildEnvironmentCreateResponse,type EnvironmentCreateRepo,ALL_ENVIRONMENT_TIERS} from '@/lib/releaseops/environmentCreateResponder';
import {buildDeploymentTargetUpsertResponse,type DeploymentTargetRepo} from '@/lib/releaseops/deploymentTargetResponder';
import {buildIdentityProviderCreateResponse,type IdentityProviderRepo,ALL_ORG_ROLES} from '@/lib/identity/identityProviderResponder';
import type {NextRequest} from 'next/server';
import type {DesktopRequestPrincipal} from '@/lib/desktop/resolveRequestDesktopSession';
import {createCurrentGithubWriteGuard} from '@/lib/desktop/currentGithubWriteAuthority';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createBranch,commitFile,commitFiles,createPullRequest,getRepositoryDefaultBranch,isSafeRepositoryPath} from '@/lib/connectors/github/githubWriteClient';
import {parseRepositoryFullName} from '@/lib/connectors/github/resolveTenantScopedToken';
import {githubBranchReviewFromArgs,githubFileReviewFromArgs,githubFilesReviewFromArgs} from './proposalReview';
import {isSensitiveRepositoryEvidencePath} from './repositoryEvidencePolicy';
import {agentExecutionScopeSchema,type AgentExecutionScope} from './agentActionExecutionContract';
import type {createAgentActionExecutionStore} from './agentActionExecutionStore';

type Store=ReturnType<typeof createAgentActionExecutionStore>;
type GuardRepo=Parameters<typeof createCurrentGithubWriteGuard>[2];
const text=z.string().min(1).max(240).refine(v=>!/[\x00-\x1f\x7f]/.test(v));
const reference=text.refine(v=>!v.startsWith('-')&&!v.includes('..')&&!/[ ~^:?*\[\\]/.test(v)&&!v.endsWith('/')&&!v.endsWith('.lock'));
const path=text.refine(v=>isSafeRepositoryPath(v)&&!isSensitiveRepositoryEvidencePath(v));
const content=z.string().refine(v=>Buffer.byteLength(v,'utf8')<=200000);
const message=z.string().min(1).max(10000).refine(v=>!!v.trim());
const common={repositoryFullName:text};
const exactText=text.refine(v=>v.trim()===v);
const databaseSchemas={
 create_environment:z.object({slug:z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),name:exactText,tier:z.enum(ALL_ENVIRONMENT_TIERS)}),
 configure_deployment_target:z.object({environmentId:exactText,roleArn:exactText,region:exactText,ecsCluster:exactText,ecsService:exactText}),
 connect_identity_provider:z.object({protocol:z.enum(['oidc','saml']),issuerOrEntityId:exactText,metadataDocument:z.string().min(1).max(1000000),managedDomains:z.array(exactText).min(1).max(100),roleMapping:z.array(z.object({claimKey:exactText,claimValue:exactText,role:z.enum(ALL_ORG_ROLES)})).min(1).max(100),requireMfaClaim:z.boolean()}),
};
const schemas={
 create_github_branch:z.object({...common,baseBranch:reference,newBranchName:reference}),
 commit_github_file:z.object({...common,branch:reference,path,content,message}),
 commit_github_files:z.object({...common,branch:reference,files:z.array(z.object({path,content})).min(2).max(20),message}),
 open_github_pull_request:z.object({...common,head:reference,base:reference,title:message,body:z.string().max(100000).optional()}),
};
export function validateAgentActionExecutionInput(saved:Awaited<ReturnType<Store['inspectForExecution']>>){
 const args=z.record(z.string(),z.unknown()).parse(saved.args);
 if(saved.toolName==='trigger_aws_deploy'){agentDeploymentArgsSchema.parse(args);return args}
 if(Object.hasOwn(databaseSchemas,saved.toolName)){databaseSchemas[saved.toolName as keyof typeof databaseSchemas].parse(args);return args}
 if(!Object.hasOwn(schemas,saved.toolName))throw Error('agent_execution_tool_unavailable');
 const schema=schemas[saved.toolName as keyof typeof schemas];schema.parse(args);
 if(!parseRepositoryFullName(args.repositoryFullName as string))throw Error('agent_execution_source_unavailable');
 if(saved.toolName==='open_github_pull_request'&&(!githubPullRequestReviewFromArgs(args)||!pullRequestProposalReview(args)))throw Error('agent_execution_review_unavailable');
 if(saved.toolName==='create_github_branch'&&!githubBranchReviewFromArgs(args))throw Error('agent_execution_review_unavailable');
 if(saved.toolName==='commit_github_file'&&!githubFileReviewFromArgs(args))throw Error('agent_execution_review_unavailable');
 if(saved.toolName==='commit_github_files'){
  const review=githubFilesReviewFromArgs(args),files=args.files as Array<{path:string}>;
  if(!review||review.files.length!==files.length||new Set(files.map(f=>f.path)).size!==files.length||files.some((f,i)=>f.path!==review.files[i].path))throw Error('agent_execution_review_unavailable');
 }
 return args;
}
/** Partial fixed-transport core. Public entry separately qualifies source support.
 * Only stored operation input is executable; scope/principal come from paired
 * server authentication. Deployment uses fixed policy/reservation/dispatch. Source
 * Branch creation pins an immutable SHA; PR creation checks captured commits
 * before POST and in its response without claiming to freeze symbolic refs.
 * Workflow source binding remains incomplete;
 * this module does not complete the activation contract or enable execution. */
export function createAgentActionExecutionCoordinator(request:NextRequest,principal:DesktopRequestPrincipal,repo:GuardRepo&AgentDeploymentExecutionRepo,store:Store,rawScope:AgentExecutionScope){
 const scope=Object.freeze(agentExecutionScopeSchema.parse(rawScope));
 if(principal.credentialKind!=='desktop_session'||principal.id!==scope.sessionId||principal.userId!==scope.actorUserId||principal.organizationId!==scope.organizationId)throw Error('agent_execution_scope_unavailable');
 // No configurable responder/token resolver/transport or caller-provided guard.
 return Object.freeze({async execute(id:string){
  request.signal.throwIfAborted();
  const saved=await store.inspectForExecution(scope,id);
  const args=structuredClone(validateAgentActionExecutionInput(saved));
  if(saved.toolName==='trigger_aws_deploy')return executeStoredAgentDeployment(request,principal,repo,store,scope,id,saved);
  if(Object.hasOwn(databaseSchemas,saved.toolName)){
   const claimed=await store.claim(scope,id);if(!claimed.claimed)return claimed.operation;
   return store.applyDatabase(claimed.claim,async(tx,current)=>{
    if(current.toolName!==saved.toolName||sha256ContentHash(current.args)!==sha256ContentHash(args))throw Error('agent_execution_source_changed');
    request.signal.throwIfAborted();
    if(current.toolName==='create_environment'){
     const input=databaseSchemas.create_environment.parse(current.args);
     const result=await buildEnvironmentCreateResponse(tx as unknown as EnvironmentCreateRepo,{...input,organizationId:scope.organizationId});
     if(!result.body.ok)throw Error('agent_execution_database_unavailable');
     if(result.body.data.slug!==input.slug||result.body.data.name!==input.name||result.body.data.tier!==input.tier)throw Error('agent_execution_source_changed');
    }else if(current.toolName==='configure_deployment_target'){
     const input=databaseSchemas.configure_deployment_target.parse(current.args);
     const environments=await tx.$queryRaw<Array<{id:string;organizationId:string}>>`SELECT "id","organizationId" FROM "Environment" WHERE "id"=${input.environmentId} FOR SHARE`;
     if(environments.length!==1||environments[0].id!==input.environmentId||environments[0].organizationId!==scope.organizationId)throw Error('agent_execution_target_unavailable');
     const targets=await tx.$queryRaw<Array<{organizationId:string}>>`SELECT "organizationId" FROM "DeploymentTarget" WHERE "environmentId"=${input.environmentId} FOR UPDATE`;
     if(targets.length>1||targets.some(t=>t.organizationId!==scope.organizationId))throw Error('agent_execution_target_unavailable');
     const result=await buildDeploymentTargetUpsertResponse(tx as unknown as DeploymentTargetRepo,{...input,organizationId:scope.organizationId});
     if(!result.body.ok)throw Error('agent_execution_database_unavailable');
     const target=result.body.data as typeof result.body.data&{organizationId?:unknown};
     if(target.organizationId!==scope.organizationId||target.environmentId!==input.environmentId)throw Error('agent_execution_target_unavailable');
    }else{
     const input=databaseSchemas.connect_identity_provider.parse(current.args);
     const result=await buildIdentityProviderCreateResponse(tx as unknown as IdentityProviderRepo,{...input,organizationId:scope.organizationId,actorUserId:scope.actorUserId});
     if(!result.body.ok)throw Error('agent_execution_database_unavailable');
    }
    request.signal.throwIfAborted();
    return{code:'action_completed'};
   });
  }
  const parsed=parseRepositoryFullName(args.repositoryFullName as string)!;
  const guard=createCurrentGithubWriteGuard(request,principal,repo);
  await guard(); // Pin the current accepted connection before consuming claim.
  const singleWrite=saved.toolName==='create_github_branch'||saved.toolName==='open_github_pull_request';
  const outboundSignal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);
  const outbound=singleWrite?createAgentGithubOutboundDrain(repo as typeof repo&ReleaseOperationPlanRepo,request,scope,id,store,saved,guard.connectionBinding(),outboundSignal):undefined;
  outbound?.assertAvailable();
  const claimed=await store.claim(scope,id);if(!claimed.claimed)return claimed.operation;
  let dispatchPossible=false;
  let outcome:'confirmed'|'refused'|'unknown'='refused';
  let references:Array<{kind:'github_pull_request';id:string}>|undefined;
  try{
   if(outbound)await outbound.beforeCredential(claimed.claim);
   const token=await guard.resolveToken(parsed);if(!token.ok)throw Error('agent_execution_credentials_unavailable');
   const assertExact=async()=>{
    const current=await store.beforeDispatch(scope,claimed.claim);
    if(sha256ContentHash(current)!==sha256ContentHash(saved))throw Error('agent_execution_source_changed');
    request.signal.throwIfAborted();
   };
   const checkDefault=async()=>{
    if(saved.toolName!=='commit_github_file'&&saved.toolName!=='commit_github_files')return;
    const branch=await getRepositoryDefaultBranch({...parsed,installationToken:token.token});
    if(!branch.ok||branch.data===args.branch)throw Error('agent_execution_pull_request_cycle_required');
   };
   let intentFresh:(()=>void)|undefined;
   const beforeWrite=async()=>{
    await checkDefault();await assertExact();await guard();
    // Last authority await revalidates review, requester, policy and the exact
    // captured installation together. No subsequent guard/provider read may
    // reopen a stale-review window before the fixed transport starts its write.
    const current=await store.beforeGithubDispatch(scope,claimed.claim,guard.connectionBinding());
    if(sha256ContentHash(current)!==sha256ContentHash(saved))throw Error('agent_execution_source_changed');
    request.signal.throwIfAborted();
    // Conservatively consumed from this point, including malformed/lost replies
    // and multi-file object writes before a later guard refuses the ref update.
    if(outbound)intentFresh=await outbound.beforeSubmission();else dispatchPossible=true;
   };
   await checkDefault();await assertExact();await guard();
   const authority={...parsed,installationToken:token.token,beforeWrite};
   const singleAuthority={...authority,signal:outboundSignal,beforeFetch:()=>{outboundSignal.throwIfAborted();if(!outbound||typeof intentFresh!=='function')throw Error('agent_github_final_authority_unavailable');guard.assertFresh();intentFresh();dispatchPossible=true}};
   let result:{ok:boolean;data?:unknown};
   if(saved.toolName==='create_github_branch')result=await createBranch({...singleAuthority,baseBranch:args.baseBranch as string,newBranchName:args.newBranchName as string,expectedBaseSha:githubBranchReviewFromArgs(args)!.baseSha});
   else if(saved.toolName==='commit_github_file')result=await commitFile({...authority,branch:args.branch as string,path:args.path as string,content:args.content as string,message:args.message as string,expectedSha:githubFileReviewFromArgs(args)!.baseSha});
   else if(saved.toolName==='commit_github_files'){
    const review=githubFilesReviewFromArgs(args)!;
    const files=(args.files as Array<{path:string;content:string}>).map((f,i)=>({...f,expectedSha:review.files[i].baseSha}));
    result=await commitFiles({...authority,branch:args.branch as string,files,message:args.message as string});
   }else result=await createPullRequest({...singleAuthority,head:args.head as string,base:args.base as string,title:args.title as string,expectedHeadSha:githubPullRequestReviewFromArgs(args)!.headSha,expectedBaseSha:githubPullRequestReviewFromArgs(args)!.baseSha,...(typeof args.body==='string'?{body:args.body}:{})});
   if(result.ok){
    const data=result.data as Record<string,unknown>|undefined;
    const sha=typeof data?.sha==='string'&&/^[a-f0-9]{40}$/.test(data.sha);
    const valid=saved.toolName==='create_github_branch'?sha&&data?.sha===githubBranchReviewFromArgs(args)!.baseSha&&data?.ref===`refs/heads/${args.newBranchName}`:saved.toolName==='open_github_pull_request'?Number.isSafeInteger(data?.number)&&Number(data?.number)>0:sha;
    if(!valid)throw Error('agent_execution_provider_evidence_unavailable');
    if(saved.toolName==='open_github_pull_request')references=[{kind:'github_pull_request',id:String(data!.number)}];
   }
   outcome=result.ok?'confirmed':dispatchPossible?'unknown':'refused';
  }catch{outcome=dispatchPossible?'unknown':'refused'}
  // Outside the dispatch catch: never write a second outcome or resend after a
  // DB response loss. Recovery reads the consumed durable operation only.
  return store.complete(claimed.claim,outcome,{code:outcome==='confirmed'?'action_completed':outcome==='unknown'?'provider_outcome_unknown':'pre_dispatch_refused',...(outcome==='confirmed'&&references?{references}:{})});
 }});
}
