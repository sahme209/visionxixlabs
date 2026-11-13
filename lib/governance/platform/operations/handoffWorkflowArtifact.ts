import 'server-only';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
const definition=z.object({format:z.literal(1),environment:z.string().regex(/^[-A-Za-z0-9_ ]{1,128}$/),protectionRevision:z.string().regex(/^[a-f0-9]{64}$/),audience:z.string().regex(/^[-A-Za-z0-9_]{1,256}$/),endpoint:z.string().max(2048),preflightEndpoint:z.string().max(2048),sourceCommit:z.string().regex(/^[a-f0-9]{40}$/),runtimeSha256:z.string().regex(/^[a-f0-9]{64}$/),javascript:z.string().min(1).max(1048576)}).strict();
export type OperationalHandoffArtifactDefinition=z.infer<typeof definition>;
/** Private compiler/qualification supplier, NOT a caller code-upload API.
 * Must bind actual reviewed compiled entrypoint, complete dependency closure,
 * private native bootstrap, source and protection profile. No default supplier
 * or qualification is supplied by matching the declared runtime hash. */
export interface OperationalHandoffArtifactSource {
 read(signal:AbortSignal):Promise<unknown>;
 assertCurrent(value:Readonly<OperationalHandoffArtifactDefinition>,signal:AbortSignal):Promise<void>;
}
const fail=():never=>{throw Error('operational_handoff_artifact_unavailable')};
/** In-memory source-only artifact. Does not write .github, dispatch a workflow,
 * install a runtime, configure a protection or establish native qualification. */
export async function prepareOperationalHandoffWorkflow(source:OperationalHandoffArtifactSource,signal:AbortSignal){try{
 signal.throwIfAborted();const value=Object.freeze(definition.parse(await withGithubAbort(source.read(signal),signal)));
 const urls=[value.endpoint,value.preflightEndpoint].map(raw=>{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.href!==raw||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(u.hostname))return fail();return u});
 if(urls[0].origin!==urls[1].origin||urls[0].href===urls[1].href||Buffer.byteLength(value.javascript)>1048576||createHash('sha256').update(value.javascript).digest('hex')!==value.runtimeSha256)return fail();
 await withGithubAbort(source.assertCurrent(value,signal),signal);signal.throwIfAborted();
 const run=["node --input-type=module <<'AXIOM_HANDOFF_NODE'","import {constants,openSync,readSync,fstatSync,closeSync,realpathSync} from 'node:fs';","import {resolve} from 'node:path';","import {createHash} from 'node:crypto';","try {"," if(Number(process.versions.node.split('.')[0])<22)throw Error('unsupported');",
 " function boundedFile(path,max){if(!Number.isInteger(constants.O_NOFOLLOW)||realpathSync(path)!==resolve(path))throw Error('path');const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const before=fstatSync(fd);if(!before.isFile()||before.size<1||before.size>max)throw Error('size');const bytes=Buffer.alloc(before.size+1),count=readSync(fd,bytes,0,bytes.length,0),after=fstatSync(fd);if(count!==before.size||after.size!==before.size||after.dev!==before.dev||after.ino!==before.ino||after.mtimeMs!==before.mtimeMs)throw Error('changed');return bytes.subarray(0,count)}finally{closeSync(fd)}}",
 " const runtimeBytes=boundedFile('.axiom/handoff/runner.mjs',1048576);",` if(createHash('sha256').update(runtimeBytes).digest('hex')!==${JSON.stringify(value.runtimeSha256)})throw Error('changed');`,
 " const workflowBytes=boundedFile('.github/workflows/axiom-deploy-aws-ecs.yml',65536);"," const workflowSha256=createHash('sha256').update(workflowBytes).digest('hex');",
 " const runtime=await import('data:text/javascript;base64,'+runtimeBytes.toString('base64'));",` await runtime.default({actionId:process.env.AXIOM_ACTION_ID,delegationVersion:0},{environment:${JSON.stringify(value.environment)},protectionRevision:${JSON.stringify(value.protectionRevision)},audience:${JSON.stringify(value.audience)},endpoint:${JSON.stringify(value.endpoint)},preflightEndpoint:${JSON.stringify(value.preflightEndpoint)},workflowSha256});`,"}catch{console.error('Axiom handoff unconfirmed. Inspect the original action; do not automatically retry.');process.exitCode=1}","AXIOM_HANDOFF_NODE"].join('\n');
 const workflow={name:'Axiom reviewed platform handoff',on:{workflow_dispatch:{inputs:{action_id:{required:true,type:'string',description:'Original Axiom action reference; never an approval'}}}},permissions:{},concurrency:{group:'axiom-platform-handoff-${{ inputs.action_id }}','cancel-in-progress':false},jobs:{handoff:{'runs-on':'ubuntu-latest',environment:{name:value.environment},permissions:{contents:'read','id-token':'write'},'timeout-minutes':2,steps:[{name:'Read exact workflow source',uses:'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',with:{ref:'${{ github.sha }}','persist-credentials':false,'fetch-depth':1,'sparse-checkout':'.axiom/handoff/runner.mjs\n.github/workflows/axiom-deploy-aws-ecs.yml','sparse-checkout-cone-mode':false}},{name:'Submit one original reviewed action',env:{AXIOM_ACTION_ID:'${{ inputs.action_id }}'},run}]}}};
 // JSON is valid YAML; serialization keeps profile data out of shell syntax.
 const files=Object.freeze({'.github/workflows/axiom-deploy-aws-ecs.yml':JSON.stringify(workflow,null,2)+'\n','.axiom/handoff/runner.mjs':value.javascript});
 await withGithubAbort(source.assertCurrent(value,signal),signal);signal.throwIfAborted();
 return Object.freeze({format:1 as const,sourceCommit:value.sourceCommit,protectionRevision:value.protectionRevision,runtimeSha256:value.runtimeSha256,files,authority:'prepared_artifact_only' as const,executionAuthorized:false as const,installed:false as const});
}catch{return fail()}}
