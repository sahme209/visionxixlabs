import {z} from 'zod';
import {isAgentGithubBranchReference} from './agentGithubBranchReview';
import {AWS_ECS_DEPLOY_WORKFLOW_FILENAME} from '../releaseops/awsEcsDeployWorkflowTemplate';
const sha=z.string().regex(/^[a-f0-9]{40}$/),numeric=z.string().regex(/^[1-9][0-9]{0,15}$/);
export const agentRestartTagSchema=z.string().min(1).max(200).refine(v=>isAgentGithubBranchReference(v)&&!v.startsWith('refs/')&&!v.includes('@{'));
export const agentRestartRepositorySchema=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/);
/** Provider/source facts only. This descriptor cannot grant execution authority. */
export const agentRestartWorkflowSourceSchema=z.object({
 kind:z.literal('github_immutable_restart_source_v1'),repositoryFullName:agentRestartRepositorySchema,repositoryId:numeric,
 tagName:agentRestartTagSchema,ref:z.string(),tagObjectSha:sha,tagObjectType:z.enum(['commit','tag']),sourceCommitSha:sha,
 releaseId:numeric,publishedAt:z.string().datetime(),workflowFile:z.literal(AWS_ECS_DEPLOY_WORKFLOW_FILENAME),workflowBlobSha:sha,workflowContentSha256:z.string().regex(/^[a-f0-9]{64}$/),
}).strict().refine(v=>v.ref===`refs/tags/${v.tagName}`&&(v.tagObjectType!=='commit'||v.tagObjectSha===v.sourceCommitSha),'restart_source_mismatch');
export type AgentRestartWorkflowSource=z.infer<typeof agentRestartWorkflowSourceSchema>;
export function restartWorkflowSourceFromArgs(args:Record<string,unknown>):AgentRestartWorkflowSource|null{
 const value=agentRestartWorkflowSourceSchema.safeParse(args._restartSource);
 return value.success&&args.sourceKind==='tag'&&args.sourceRef===value.data.tagName&&args.repositoryFullName===value.data.repositoryFullName?value.data:null;
}
