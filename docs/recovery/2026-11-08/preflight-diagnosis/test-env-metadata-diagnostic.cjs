'use strict';
// Mocked only: zero provider calls. Every case must leak no value, id or URL.
const assert=require('node:assert/strict'),path=require('node:path');
const d=require(path.join(__dirname,'env-metadata-diagnostic.cjs'));
const SECRET='FAKE_SECRET_VALUE_MUST_NOT_APPEAR_5521',ID='env_FAKEID_MUST_NOT_APPEAR';
const env=(o={})=>({id:ID,key:'DATABASE_URL',target:['production'],updatedAt:42,value:SECRET,...o});
const text=v=>({content:[{type:'text',text:JSON.stringify(v)}]});
const cases=[
 ['tool missing',null,'tool_unavailable',0],
 ['tool throws',()=>{throw Error(SECRET)},'tool_threw',1],
 ['isError',()=>({isError:true,content:[{type:'text',text:SECRET}]}),'tool_is_error',1],
 ['two text blocks',()=>({content:[{type:'text',text:'{}'},{type:'text',text:SECRET}]}),'text_block_count_not_one',1],
 ['non-JSON text',()=>({content:[{type:'text',text:'not json '+SECRET}]}),'text_not_json',1],
 ['envs nested under data',()=>text({data:{envs:[env()]}}),'envs_not_array',1],
 ['top-level array',()=>text([env()]),'envs_not_array',1],
 ['no DATABASE_URL',()=>text({envs:[env({key:'POSTGRES_URL'})]}),'production_database_url_count_not_one',1],
 ['two production DATABASE_URL',()=>text({envs:[env(),env({id:'env_two',gitBranch:'release'})]}),'production_database_url_count_not_one',1],
 ['target is string',()=>text({envs:[env({target:'production'})]}),'production_database_url_count_not_one',1],
 ['bad id',()=>text({envs:[env({id:'has space/'+SECRET})]}),'id_shape_invalid',1],
 ['updatedAt ISO string',()=>text({envs:[env({updatedAt:'2026-11-08T00:00:00Z'})]}),'updated_at_not_safe_integer',1],
 ['accepted via text',()=>text({envs:[env(),env({key:'OTHER'})]}),'metadata_shape_accepted',1],
 ['accepted via structuredContent',()=>({structuredContent:{envs:[env()]}}),'metadata_shape_accepted',1],
];
(async()=>{
 for(const [name,impl,reason,calls] of cases){
  let n=0,args=null;const tools=impl?{vercel_filter_project_envs:async a=>{n++;args=a;return impl();}}:{};
  const r=await d.runEnvMetadataDiagnostic(tools),s=JSON.stringify(r);
  assert.equal(r.reason,reason,name);assert.equal(r.providerCalls,calls,name);assert.equal(n,calls,name);
  for(const bad of [SECRET,ID,'postgresql://','env_two','release'])assert(!s.includes(bad),name+' leaked');
  if(args)assert.equal(args.decrypt,'false',name);
  assert(d.REASONS.includes(r.reason));
 }
 const two=await d.runEnvMetadataDiagnostic({vercel_filter_project_envs:async()=>text({envs:[env(),env({id:'env_two',gitBranch:'release'})]})});
 assert.equal(two.productionDatabaseUrlCount,2);assert.equal(two.databaseUrlWithGitBranchCount,1);
 process.stdout.write(cases.length+' mocked diagnostic cases PASS; zero provider calls; no values leaked\n');
})().catch(e=>{process.stderr.write('mocked diagnostic FAILED: '+(e&&e.message||'')+'\n');process.exitCode=1;});
