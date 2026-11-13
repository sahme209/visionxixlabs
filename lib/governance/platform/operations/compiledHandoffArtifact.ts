import 'server-only';
import {z} from 'zod';
import {mkdtemp,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {buildGithubHandoffRuntime} from '../../../../scripts/build-github-handoff-runtime.cjs';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {githubBootstrapChannelProfile,readGithubBootstrapChannel} from './githubBootstrap';
import {prepareOperationalHandoffWorkflow} from './handoffWorkflowArtifact';
const definitionSchema=z.object({format:z.literal(3),sourceCommit:z.string().regex(/^[a-f0-9]{40}$/),bootstrapChannel:githubBootstrapChannelProfile}).strict();
type Definition=Readonly<z.infer<typeof definitionSchema>>;
export interface OperationalHandoffCompilationEvidence {
 readonly runtimeSha256:string;readonly workflowSha256:string;readonly profileSha256:string;
 readonly files:Readonly<{'.github/workflows/axiom-deploy-aws-ecs.yml':string;'.axiom/handoff/runner.mjs':string}>;
 readonly modules:readonly string[];readonly moduleHashes:Readonly<Record<string,string>>;readonly toolHashes:Readonly<Record<string,string>>;
}
/** Protected local setup/compile qualification, never request JSON or a Boolean
 * fallback. Real source/profile/tool/dependency provenance is still REQUIRED.
 * This connected preparer supplies no successful default qualifier. */
export interface OperationalCompiledHandoffSource {
 read(signal:AbortSignal):Promise<unknown>;
 assertSetupCurrent(value:Definition,signal:AbortSignal):Promise<void>;
 assertBuildCurrent(value:Definition,compilation:OperationalHandoffCompilationEvidence,signal:AbortSignal):Promise<void>;
}
const fail=():never=>{throw Error('operational_compiled_handoff_unavailable')};
function parse(raw:unknown):Definition{const p=definitionSchema.parse(raw);return Object.freeze({...p,bootstrapChannel:readGithubBootstrapChannel(p.bootstrapChannel)})}
/** Builds only the fixed actual runtime and prepares its held workflow in
 * memory. No caller JavaScript/compiler selection or active workflow writes.
 * Local temporary compile files are preserved; no compiled runtime executes. */
export async function prepareCompiledOperationalHandoff(source:OperationalCompiledHandoffSource,parent:AbortSignal){
 const controller=new AbortController(),signal=AbortSignal.any([parent,controller.signal]),timer=setTimeout(()=>controller.abort(),60000);
 try{
  signal.throwIfAborted();const value=parse(await withGithubAbort(source.read(signal),signal)),expected=sha256ContentHash(value);
  async function setupCurrent(){signal.throwIfAborted();await withGithubAbort(source.assertSetupCurrent(value,signal),signal);signal.throwIfAborted();const fresh=parse(await withGithubAbort(source.read(signal),signal));if(sha256ContentHash(fresh)!==expected)return fail();signal.throwIfAborted()}
  await setupCurrent();
  const directory=await mkdtemp(join(tmpdir(),'axiom-compiled-handoff-'));signal.throwIfAborted();
  const built=await withGithubAbort(buildGithubHandoffRuntime(value.bootstrapChannel,directory),signal);signal.throwIfAborted();
  const bytes=await readFile(built.path);signal.throwIfAborted();
  if(createHash('sha256').update(bytes).digest('hex')!==built.runtimeSha256||bytes.byteLength>1048576)return fail();
  const {environment,protectionRevision,audience,endpoint,preflightEndpoint}=value.bootstrapChannel;
  // Serialization is inert; no partial artifact escapes before pair qualification.
  // Actual workflow bytes exist before either build-qualification callback.
  const artifact=await prepareOperationalHandoffWorkflow({read:async()=>({format:1,environment,protectionRevision,audience,endpoint,preflightEndpoint,sourceCommit:value.sourceCommit,runtimeSha256:built.runtimeSha256,javascript:bytes.toString('utf8')}),assertCurrent:async()=>setupCurrent()},signal);
  const workflowSha256=createHash('sha256').update(artifact.files['.github/workflows/axiom-deploy-aws-ecs.yml']).digest('hex');
  const compilation:OperationalHandoffCompilationEvidence=Object.freeze({runtimeSha256:built.runtimeSha256,workflowSha256,files:artifact.files,profileSha256:built.profileSha256,modules:Object.freeze([...built.modules]),moduleHashes:Object.freeze({...built.moduleHashes}),toolHashes:Object.freeze({...built.toolHashes})});
  async function pairCurrent(){
   await setupCurrent();if(createHash('sha256').update(await readFile(built.path)).digest('hex')!==compilation.runtimeSha256||createHash('sha256').update(artifact.files['.github/workflows/axiom-deploy-aws-ecs.yml']).digest('hex')!==compilation.workflowSha256||artifact.files['.axiom/handoff/runner.mjs']!==bytes.toString('utf8'))return fail();
   await withGithubAbort(source.assertBuildCurrent(value,compilation,signal),signal);signal.throwIfAborted();await setupCurrent();if(createHash('sha256').update(await readFile(built.path)).digest('hex')!==compilation.runtimeSha256)return fail();signal.throwIfAborted();
  }
  await pairCurrent();await pairCurrent();
  return Object.freeze({...artifact,compilation});
 }catch{return fail()}finally{clearTimeout(timer);controller.abort()}
}
