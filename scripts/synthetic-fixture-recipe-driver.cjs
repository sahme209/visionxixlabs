'use strict';
// Fixed future packet driver. Importing performs no work; actual execution is
// separately authorized. Tests supply fully mocked child-process observations.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),child=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const CAP=8*1024*1024;
function bytes(file,max=CAP){
 const before=fs.lstatSync(file);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size<1||before.size>max)throw Error('recipe_input_unavailable');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const opened=fs.fstatSync(fd);if(opened.ino!==before.ino||opened.dev!==before.dev||opened.size!==before.size)throw Error('recipe_input_changed');const chunks=[];let count=0;
  for(;;){const chunk=Buffer.alloc(Math.min(65536,opened.size-count+1)),n=fs.readSync(fd,chunk,0,chunk.length,null);if(!n)break;count+=n;if(count>opened.size||count>max)throw Error('recipe_input_changed');chunks.push(chunk.subarray(0,n));}
  const ended=fs.fstatSync(fd),current=fs.lstatSync(file);if(count!==opened.size||[ended,current].some(x=>x.ino!==opened.ino||x.dev!==opened.dev||x.size!==opened.size||x.mtimeMs!==opened.mtimeMs||x.ctimeMs!==opened.ctimeMs||x.mode!==opened.mode||x.nlink!==1))throw Error('recipe_input_changed');return Buffer.concat(chunks,count);
 }finally{fs.closeSync(fd)}
}
function write(file,b){fs.writeFileSync(file,b,{mode:0o600,flag:'wx'});}
const ERROR_CODES=new Set(['ENOBUFS','EACCES','EPERM','ETIMEDOUT','ENOENT','EEXIST','EIO','ERR_ENCODING_INVALID_ENCODED_DATA']);
const FAILURES=new Set(['recipe_input_unavailable','recipe_input_changed','recipe_command_unavailable','recipe_scratch_unavailable','recipe_diff_input_changed','recipe_no_retry','recipe_child_unavailable','recipe_capture_limit','recipe_engine_unavailable','synthetic_recipe_unavailable','synthetic_recipe_datasource_unavailable','synthetic_recipe_engine_unavailable','synthetic_recipe_schema_coverage_unavailable']);
function safeError(error){return{code:ERROR_CODES.has(error?.code)?error.code:'UNKNOWN',name:['Error','TypeError','RangeError','SyntaxError','SystemError'].includes(error?.name)?error.name:'Error'};}
function runRecipePacket(packet,ports={spawn:child.spawnSync,execPath:process.execPath,recipe:undefined}){
 if(!packet||packet.format!=='axiom.fixed-recipe-export/1'||packet.node.path!==ports.execPath||packet.executionAuthorized!==false)throw Error('recipe_packet_unavailable');
 if(packet.recipeHelper.path!==path.join(packet.sourceRepo,'scripts/prepare-synthetic-fixture-recipe.cjs')||!packet.inputs.some(x=>x.path===packet.recipeHelper.path&&x.sha256===packet.recipeHelper.sha256&&x.size===packet.recipeHelper.size)||!packet.inputs.some(x=>x.path===packet.engine.path&&x.sha256===packet.engine.sha256&&x.size===packet.engine.size))throw Error('recipe_fixed_inputs_unavailable');
 const root=fs.realpathSync(packet.repo),work=fs.realpathSync(packet.work),tmp=path.join(work,'tmp'),output=path.join(work,'recipe');const workStat=fs.lstatSync(work);if(root!==packet.repo||work!==packet.work||!workStat.isDirectory()||workStat.isSymbolicLink()||workStat.uid!==process.getuid()||(workStat.mode&0o077)||fs.existsSync(output))throw Error('recipe_packet_unavailable');
 let phase='input_validation';try{
 for(const item of packet.inputs){if(item.mode!==undefined&&fs.lstatSync(item.path).mode%4096!==item.mode)throw Error('recipe_input_changed');const b=bytes(item.path,item.size);if(b.length!==item.size||sha(b)!==item.sha256)throw Error('recipe_input_changed');}
 const record={format:'axiom.fixed-recipe-child/1',status:'unavailable',executionAuthorized:false};let entered=false;
 const run=(command,argv,options)=>{phase='scratch_capture';if(entered)throw Error('recipe_no_retry');entered=true;if(command!==packet.node.path||argv.length!==7||argv[0]!==path.join(root,'node_modules/prisma/build/index.js')||argv.slice(1,5).join('|')!=='migrate|diff|--from-empty|--to-schema-datamodel'||argv[6]!=='--script')throw Error('recipe_command_unavailable');
  const input=fs.realpathSync(argv[5]),directory=path.dirname(input);if(input!==argv[5]||path.basename(input)!=='schema.prisma'||!directory.startsWith(tmp+'/axiom-schema-only-')||options.cwd!==directory)throw Error('recipe_scratch_unavailable');
  const prepared=bytes(input);if(sha(prepared)!==packet.diffInputSha256)throw Error('recipe_diff_input_changed');write(path.join(work,'prepared-schema.prisma'),prepared);
  const environment={NODE_ENV:'production',PRISMA_SCHEMA_ENGINE_BINARY:packet.engine.path,PRISMA_HIDE_UPDATE_MESSAGE:'true',CHECKPOINT_DISABLE:'1',PRISMA_GENERATE_SKIP_AUTOINSTALL:'true',HOME:path.join(work,'home'),TMPDIR:tmp,XDG_CACHE_HOME:path.join(work,'home'),PATH:path.dirname(command)+':/usr/bin:/bin:/usr/sbin:/sbin',LANG:'C',TZ:'UTC'};
  record.argv=[command,...argv];record.cwd=directory;record.environment=environment;record.preparedInputSha256=sha(prepared);
  phase='cli_invocation';let result;try{result=ports.spawn(command,argv,{...options,env:environment,encoding:null,maxBuffer:CAP,timeout:60000,stdio:['ignore','pipe','pipe']});}catch(error){record.status='spawn_unknown';record.error=safeError(error);write(path.join(work,'child.json'),Buffer.from(JSON.stringify(record)+'\n'));throw Error('recipe_child_unavailable');}
  phase='capture_validation';const stdout=Buffer.isBuffer(result.stdout)?result.stdout:Buffer.alloc(0),stderr=Buffer.isBuffer(result.stderr)?result.stderr:Buffer.alloc(0);const overflow=stdout.length>CAP||stderr.length>CAP;write(path.join(work,'stdout.raw'),stdout.subarray(0,CAP));write(path.join(work,'stderr.raw'),stderr.subarray(0,CAP));
  Object.assign(record,{status:overflow?'capture_overflow':result.error?'error':result.status===0?'exited_zero':'nonzero',exit:result.status,signal:result.signal??null,...(result.error?{error:safeError(result.error)}:{}),stdout:{sha256:sha(stdout.subarray(0,CAP)),reportedSize:stdout.length,retainedSize:Math.min(CAP,stdout.length)},stderr:{sha256:sha(stderr.subarray(0,CAP)),reportedSize:stderr.length,retainedSize:Math.min(CAP,stderr.length)}});write(path.join(work,'child.json'),Buffer.from(JSON.stringify(record)+'\n'));
  if(overflow)throw Error('recipe_capture_limit');const text=new TextDecoder('utf-8',{fatal:true}).decode(stdout);phase='recipe_generation';return{...result,stdout:text};
 };
 const engineStat=fs.lstatSync(packet.engine.path);if(!engineStat.isFile()||engineStat.isSymbolicLink()||engineStat.nlink!==1||!(engineStat.mode&0o111))throw Error('recipe_engine_unavailable');
 phase='recipe_generation';const recipe=ports.recipe??require(packet.recipeHelper.path).prepareSyntheticFixtureRecipe;const binding=recipe(root,output,{run,schemaEnginePath:packet.engine.path});if(!entered||record.status!=='exited_zero')throw Error('recipe_child_unavailable');
 phase='post_validation';
 for(const item of packet.inputs){if(item.mode!==undefined&&fs.lstatSync(item.path).mode%4096!==item.mode)throw Error('recipe_input_changed');const b=bytes(item.path,item.size);if(b.length!==item.size||sha(b)!==item.sha256)throw Error('recipe_input_changed');}
 phase='result_recording';write(path.join(work,'driver-result.json'),Buffer.from(JSON.stringify({format:'axiom.fixed-recipe-driver-result/1',status:'exported',binding,executionAuthorized:false,runtimeQualification:'unavailable',descendantQuiescence:'unavailable'})+'\n'));return binding;
 }catch(error){const code=FAILURES.has(error?.message)?error.message:ERROR_CODES.has(error?.code)?error.code:'unknown_failure';try{write(path.join(work,'driver-failure.json'),Buffer.from(JSON.stringify({format:'axiom.fixed-recipe-driver-failure/1',phase,code,name:safeError(error).name,executionAuthorized:false})+'\n'));}catch{}throw error;}
}
module.exports=Object.freeze({runRecipePacket});
if(require.main===module){try{if(process.argv.length!==3)throw Error();const packet=JSON.parse(bytes(process.argv[2],4*1024*1024));runRecipePacket(packet);}catch{process.stderr.write('fixed_recipe_export_unavailable\n');process.exitCode=1;}}
