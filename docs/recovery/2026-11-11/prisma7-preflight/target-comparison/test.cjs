'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {selectProductionDatabaseId,compareTarget}=require('./compare.cjs');
const fixture={id:'synthetic-id',key:'DATABASE_URL',target:['production'],updatedAt:100};
const wrap=x=>({content:[{type:'text',text:JSON.stringify({result:x})}]});
test('selects exactly one production metadata identity without returning values',()=>{
 assert.deepEqual(selectProductionDatabaseId(wrap({envs:[{...fixture,value:'NEVER_RETURN_THIS'}]})),{id:'synthetic-id',updatedAt:100});
 assert.throws(()=>selectProductionDatabaseId(wrap({envs:[fixture,fixture]})),/target_metadata_unavailable/);
 assert.throws(()=>selectProductionDatabaseId(wrap({envs:[{...fixture,target:['preview']}]})),/target_metadata_unavailable/);
});
test('compares only exact approved endpoint and database; returns no URL or credential',()=>{
 for(const suffix of ['', '-pooler']){
  const result=compareTarget(wrap({...fixture,value:`postgresql://synthetic:NEVER_RETURN_THIS@ep-small-mountain-ailw0kvt${suffix}.c-4.us-east-1.aws.neon.tech/neondb`}),fixture.id,fixture.updatedAt);
  assert.deepEqual(result,{status:'observed',recordedEndpointMatches:true,databaseMatches:true,updatedAt:100,valuesReturned:false});
  assert.doesNotMatch(JSON.stringify(result),/NEVER_RETURN_THIS|postgresql:|neon\.tech/);
 }
});
test('reports a different endpoint without disclosing the new host',()=>{
 const out=compareTarget(wrap({...fixture,value:'postgresql://synthetic:synthetic@different.invalid/other'}),fixture.id,fixture.updatedAt);
 assert.equal(out.recordedEndpointMatches,false);assert.equal(out.databaseMatches,false);assert.doesNotMatch(JSON.stringify(out),/different|other/);
});
test('refuses wrong identity, error wrappers, malformed URL and non-postgres schemes with fixed errors',()=>{
 for(const response of [{isError:true},wrap({...fixture,id:'other',value:'SECRET'}),wrap({...fixture,value:'SECRET'}),wrap({...fixture,value:'https://SECRET.invalid/neondb'})]){
  assert.throws(()=>compareTarget(response,fixture.id,fixture.updatedAt),e=>e.message==='target_detail_unavailable');
 }
});

test('accepts the explicit env wrapper and refuses changed metadata timestamp',()=>{
 const env={...fixture,value:'postgresql://synthetic:synthetic@different.invalid/neondb'};
 assert.equal(compareTarget({structuredContent:{result:{env}}},fixture.id,100).databaseMatches,true);
 assert.throws(()=>compareTarget(wrap({...env,updatedAt:101}),fixture.id,100),/target_detail_unavailable/);
});
