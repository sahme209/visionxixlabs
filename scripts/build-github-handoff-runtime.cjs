'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sources=[
 'lib/governance/platform/operations/githubJobEntry.ts',
 'lib/governance/platform/operations/githubBootstrap.ts',
 'lib/governance/platform/operations/nativeGithubJobIdentity.ts',
 'lib/governance/platform/operations/remoteHandoffSource.ts',
 'lib/governance/platform/operations/workloadHandoff.ts',
 'lib/governance/platform/operations/workloadCommand.ts',
 'lib/governance/platform/operations/handoffPreflightContract.ts',
 'lib/governance/platform/operations/contracts.ts',
 'lib/governance/platform/operations/ecsExecution.ts',
 'lib/governance/platform/operations/ecsResultContract.ts',
 'lib/governance/platform/contracts.ts',
 'lib/governance/platform/viewContract.ts',
 'lib/tauri/contentHash.ts',
 'lib/connectors/github/boundedGithubRead.ts',
];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
/** Fixed offline compiler; no arbitrary entry/code/loader/plugins are accepted.
 * Bytes/source hashes are evidence only, NOT bootstrap/setup qualification.
 * Never writes a workflow, runs emitted code, or reads actual job context. */
async function buildGithubHandoffRuntime(profile,directory){
 const directoryPath=fs.realpathSync(directory);
 if(fs.readdirSync(directoryPath).length)throw Error('handoff_output_not_empty');
 const expectedKeys=['format','purpose','environment','protectionRevision','audience','endpoint','preflightEndpoint','repository','ref','workflowPath','nativeOrigin','nativePath','nativeQueryKeys','expiresAt'];
 if(!profile||Object.getPrototypeOf(profile)!==Object.prototype||Object.keys(profile).sort().join('|')!==expectedKeys.sort().join('|')||Object.getOwnPropertySymbols(profile).length||Object.values(Object.getOwnPropertyDescriptors(profile)).some(d=>!('value'in d)))throw Error('handoff_profile_unavailable');
 if(profile.format!==3||profile.purpose!=='github_native_bootstrap_channel_v3'||profile.repository!=='sahme209/visionxixlabs'||profile.ref!=='refs/heads/main'||profile.workflowPath!=='.github/workflows/axiom-deploy-aws-ecs.yml'||!Number.isSafeInteger(profile.expiresAt)||profile.expiresAt<=Date.now()||!Array.isArray(profile.nativeQueryKeys)||profile.nativeQueryKeys.length>16||profile.nativeQueryKeys.some(k=>typeof k!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(k)||k==='audience')||new Set(profile.nativeQueryKeys).size!==profile.nativeQueryKeys.length||expectedKeys.filter(k=>!['format','expiresAt','nativeQueryKeys'].includes(k)).some(k=>typeof profile[k]!=='string'||profile[k].length>2048))throw Error('handoff_profile_unavailable');
 for(const key of ['endpoint','preflightEndpoint','nativeOrigin']){const u=new URL(profile[key]);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.href!==profile[key]&&(key!=='nativeOrigin'||u.origin!==profile[key]))throw Error('handoff_profile_unavailable')}
 if(new URL(profile.endpoint).origin!==new URL(profile.preflightEndpoint).origin||profile.endpoint===profile.preflightEndpoint||new URL(profile.nativeOrigin).origin!==profile.nativeOrigin||!new URL(profile.nativeOrigin).hostname.endsWith('.actions.githubusercontent.com')||!/^\/[A-Za-z0-9_./-]+$/.test(profile.nativePath)||!/^[-A-Za-z0-9_]{1,256}$/.test(profile.audience)||!/^[-A-Za-z0-9_ ]{1,128}$/.test(profile.environment)||!/^[a-f0-9]{64}$/.test(profile.protectionRevision))throw Error('handoff_profile_unavailable');
 const serialized=JSON.stringify(profile);
 if(!serialized||Buffer.byteLength(serialized)>8192)throw Error('handoff_profile_unavailable');
 const entry=path.join(directoryPath,'fixed-entry.mjs'),output=path.join(directoryPath,'runner.mjs');
 const allowed=new Set(sources.map(p=>fs.realpathSync(path.join(root,p))));
 const loader=path.join(root,'scripts/fixtures/github-handoff-typescript-loader.cjs');
 const zodRoot=fs.realpathSync(path.join(root,'node_modules/zod'))+path.sep;
 const before=new Map([...allowed,loader,__filename,path.join(root,'package-lock.json'),require.resolve('typescript'),require.resolve('next/dist/compiled/webpack/bundle5')].map(file=>[file,hash(fs.readFileSync(file))]));
 fs.writeFileSync(entry,`import {createMeasuredGithubJobEntry} from ${JSON.stringify(path.join(root,sources[0]))};\nconst profile=JSON.parse(${JSON.stringify(serialized)});\nexport default createMeasuredGithubJobEntry(profile,key=>process.env[key]);\n`,{flag:'wx',mode:0o600});
 const entryHash=hash(fs.readFileSync(entry));
 // Direct cached webpack bundle: no environment-selected alternate compiler.
 const {webpack}=require('next/dist/compiled/webpack/bundle5')();
 const graph=new Map();
 const compiler=webpack({mode:'production',target:'node22',context:root,entry,cache:false,devtool:false,experiments:{outputModule:true},output:{path:directoryPath,filename:'runner.mjs',module:true,library:{type:'module'},chunkLoading:false},optimization:{minimize:false},resolve:{extensions:['.ts','.js','.mjs','.cjs'],alias:{'@':root,'server-only':false},conditionNames:['import','node','default']},module:{rules:[{test:/\.ts$/,include:[path.join(root,'lib')],use:[{loader}]}]},externals:({'request':request},done)=>request==='node:crypto'?done(null,'module node:crypto'):done(),plugins:[{apply(compiler){
  compiler.hooks.normalModuleFactory.tap('AxiomClosedJobGraph',factory=>{
   factory.hooks.afterResolve.tap('AxiomClosedJobGraph',data=>{const resource=data.createData.resource;if(!resource)return;const resolved=fs.realpathSync(resource);
    if(resolved!==entry&&!allowed.has(resolved)&&!resolved.startsWith(zodRoot))throw Error('handoff_dependency_outside_closed_graph');
    graph.set(resolved,hash(fs.readFileSync(resolved)));
   });
   for(const kind of ['javascript/auto','javascript/esm','javascript/dynamic'])factory.hooks.parser.for(kind).tap('AxiomNoDynamicJobImports',parser=>{parser.hooks.importCall.tap('AxiomNoDynamicJobImports',()=>{throw Error('handoff_dynamic_import_unavailable')})});
  });
 }}]});
 const stats=await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(closeError=>error||closeError?reject(Error('handoff_compile_unavailable')):resolve(stats))));
 if(!stats||stats.hasErrors())throw Error('handoff_compile_unavailable');
 for(const module of stats.compilation.modules)if(module.constructor.name==='ExternalModule'&&module.request!=='node:crypto')throw Error('handoff_external_dependency_unavailable');
 for(const [file,expected]of before)if(hash(fs.readFileSync(file))!==expected)throw Error('handoff_source_changed');
 if(hash(fs.readFileSync(entry))!==entryHash)throw Error('handoff_entry_changed');
 for(const [file,expected]of graph)if(hash(fs.readFileSync(file))!==expected)throw Error('handoff_dependency_changed');
 const bytes=fs.readFileSync(output);if(bytes.length>1048576)throw Error('handoff_runtime_too_large');
 const modules=[...graph.keys()].filter(p=>p!==entry).map(p=>path.relative(root,p).split(path.sep).join('/')).sort();
 const moduleHashes=Object.fromEntries([...graph].filter(([p])=>p!==entry).map(([p,h])=>[path.relative(root,p).split(path.sep).join('/'),h]).sort(([a],[b])=>a.localeCompare(b)));
 return Object.freeze({path:output,runtimeSha256:hash(bytes),modules:Object.freeze(modules),moduleHashes:Object.freeze(moduleHashes),profileSha256:hash(serialized),toolHashes:Object.freeze(Object.fromEntries([...before].filter(([file])=>!allowed.has(file)).map(([file,h])=>[path.relative(root,file).split(path.sep).join('/'),h]))),authority:'compiled_artifact_only',installed:false,executionAuthorized:false});
}
module.exports={buildGithubHandoffRuntime};
