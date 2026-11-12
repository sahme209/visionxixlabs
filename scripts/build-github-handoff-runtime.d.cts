/** Local compile-only evidence; never native/setup qualification. */
export interface GithubHandoffRuntimeCompilation {
 readonly path:string;
 readonly runtimeSha256:string;
 readonly modules:readonly string[];
 readonly moduleHashes:Readonly<Record<string,string>>;
 readonly toolHashes:Readonly<Record<string,string>>;
 readonly profileSha256:string;
 readonly authority:'compiled_artifact_only';
 readonly installed:false;
 readonly executionAuthorized:false;
}
export function buildGithubHandoffRuntime(profile:unknown,directory:string):Promise<GithubHandoffRuntimeCompilation>;
