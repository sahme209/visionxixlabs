import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {githubJobConfiguration,readGithubBootstrapProfile,createGithubBootstrap,type GithubJobEnvironmentReader} from './githubBootstrap';
import {createNativeGithubJobIdentity} from './nativeGithubJobIdentity';
import {createRemoteOperationalHandoffSource} from './remoteHandoffSource';
import {operationalWorkloadCommand} from './workloadCommand';
import {createOperationalWorkloadHandoff} from './workloadHandoff';
/** Fixed entrypoint factory. Artifact embeds a separately qualified profile.
 * Job environment is bootstrap context only; backend still authenticates JWT.
 * No ambient profile/default, credentials, SDK or provider issuer lives here. */
export function createGithubJobEntry(raw:unknown,read:GithubJobEnvironmentReader){
 const profile=readGithubBootstrapProfile(raw),{environment,protectionRevision,audience,endpoint,preflightEndpoint}=profile;
 const expected=sha256ContentHash({environment,protectionRevision,audience,endpoint,preflightEndpoint});let used=false;
 return async(command:unknown,configuration:unknown,parent:AbortSignal=new AbortController().signal)=>{
  if(used)throw Error('operational_job_unconfirmed');used=true;
  try{
   parent.throwIfAborted();if(sha256ContentHash(githubJobConfiguration.parse(configuration))!==expected)throw Error('mismatch');
   const parsedCommand=operationalWorkloadCommand.parse(command);
   const bootstrap=createGithubBootstrap(profile,read),native=createNativeGithubJobIdentity(bootstrap.source),source=createRemoteOperationalHandoffSource(bootstrap.remote,native);
   return await createOperationalWorkloadHandoff(source).submit(parsedCommand,parent);
  }catch{throw Error('operational_job_unconfirmed')}
 };
}
