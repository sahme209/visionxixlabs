'use strict';
// Compiler-only source/file closure. This is not an issuer or execution grant.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const closure=require('./fixture-producer-runtime-closure.json');
const PACKAGE_ROOT='/Volumes/Axiom Synthetic Issuer-c3b7bf334ce56a64575183b7a66e5109';
const builtin=new Set(require('node:module').builtinModules.flatMap(n=>[n,'node:'+n]));
const bundled=new Set(['zod','next/server','next/dist/compiled/@edge-runtime/cookies']);
function createFixtureProducerCompilerPolicy(root){
 root=path.resolve(root);const fixed={...closure.sourceFiles,...closure.packageFiles};
 if(closure.format!=='axiom.fixture-producer-compiler-closure/1'||!closure.sourceFiles['lib/governance/qualification/privateFixtureAuthentication.ts'])throw Error('fixture_compiler_closure_unavailable');
 function observe(name){if(typeof name!=='string'||path.posix.normalize(name)!==name||path.isAbsolute(name)||name.startsWith('../')||!fixed[name]||!/^[a-f0-9]{64}$/.test(fixed[name]))throw Error('fixture_compiler_resource_unavailable');const target=path.join(root,name),s=fs.lstatSync(target);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>8*1024*1024||fs.realpathSync(target)!==target)throw Error('fixture_compiler_input_changed');const fd=fs.openSync(target,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let b;try{const opened=fs.fstatSync(fd);if(opened.size!==s.size||opened.ino!==s.ino||opened.dev!==s.dev)throw Error('fixture_compiler_input_changed');const out=Buffer.alloc(s.size+1);let count=0;for(;;){const n=fs.readSync(fd,out,count,out.length-count,null);if(!n)break;count+=n;if(count>s.size)throw Error('fixture_compiler_input_changed');}const after=fs.fstatSync(fd),current=fs.lstatSync(target);if(count!==s.size||[after,current].some(x=>x.ino!==opened.ino||x.dev!==opened.dev||x.size!==opened.size||x.mode!==opened.mode||x.nlink!==1||x.mtimeMs!==opened.mtimeMs||x.ctimeMs!==opened.ctimeMs))throw Error('fixture_compiler_input_changed');b=out.subarray(0,count);}finally{fs.closeSync(fd)}if(b.length!==s.size||crypto.createHash('sha256').update(b).digest('hex')!==fixed[name])throw Error('fixture_compiler_input_changed');return b;}
 for(const name of Object.keys(fixed))observe(name);
 for(const name of ['next','zod']){const m=JSON.parse(observe('node_modules/'+name+'/package.json'));if(m.name!==name||m.version!==closure.versions[name])throw Error('fixture_compiler_version_changed');}
 function external({request},done){if(request==='@prisma/client')return done(null,'commonjs '+PACKAGE_ROOT+'/node_modules/@prisma/client');if(builtin.has(request))return done(null,'commonjs '+request);if(bundled.has(request)||request==='server-only'||request?.startsWith('.')||request?.startsWith('@/')||path.isAbsolute(request??''))return done();return done(Error('fixture_unmapped_external'));}
 function assertResource(data){const resource=data.createData?.resource;if(typeof resource!=='string'||resource.includes('?')||resource.includes('#'))throw Error('fixture_compiler_resource_unavailable');const resolved=path.resolve(resource);const relative=path.relative(root,resolved).split(path.sep).join('/');observe(relative);}
 function installParser(parser){
  parser.hooks.import.tap({name:'FixtureNextRequestOnly',stage:-10000},(statement,source)=>{if(source==='next/server'&&(statement.type!=='ImportDeclaration'||statement.specifiers.length!==1||statement.specifiers[0].type!=='ImportSpecifier'||statement.specifiers[0].imported.name!=='NextRequest'))throw Error('fixture_next_request_import_unavailable');});
  parser.hooks.exportImport.tap({name:'FixtureNextRequestOnly',stage:-10000},(_statement,source)=>{if(source==='next/server')throw Error('fixture_next_request_import_unavailable');});
  parser.hooks.importCall.tap({name:'FixtureLiteralClosure',stage:-10000},()=>{throw Error('fixture_dynamic_import_unavailable');});
  for(const hook of ['require','require.resolve'])parser.hooks.call.for(hook).tap({name:'FixtureNextRequestOnly',stage:-10000},expression=>{const args=expression.arguments;if(args.length!==1||args[0].type!=='Literal'||typeof args[0].value!=='string')throw Error('fixture_dynamic_import_unavailable');if(args[0].value==='next/server')throw Error('fixture_next_request_import_unavailable');});
 }
 const plugin={apply(compiler){compiler.hooks.normalModuleFactory.tap('FixtureProducerClosure',factory=>{factory.hooks.afterResolve.tap({name:'FixtureProducerClosure',stage:-10000},assertResource);for(const type of ['javascript/auto','javascript/esm','javascript/dynamic'])factory.hooks.parser.for(type).tap('FixtureProducerClosure',installParser);});}};
 return Object.freeze({alias:Object.freeze({'next/server$':path.join(root,'node_modules/next/dist/server/web/spec-extension/request.js'),'zod$':path.join(root,'node_modules/zod/index.js')}),external,assertResource,installParser,plugin});
}
module.exports=Object.freeze({createFixtureProducerCompilerPolicy});
