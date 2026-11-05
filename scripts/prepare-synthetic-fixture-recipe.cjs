'use strict';
// Preparation function only. Importing never starts compiler/engine/SQL. Actual
// invocation requires the separately authorized artifact-generation packet.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),child=require('node:child_process'),os=require('node:os');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const SCHEMA='50e1fbbf50d5d28ba08e862a72789de3c5a9fdad5d7589751a86e0135c5eb031';
const ENGINE='57b090d47b947dc9284379d9480d11ffe14fe63155e3da515b359f3aa7fa408a';
function prepareSyntheticFixtureRecipe(repo,output,ports={run:child.spawnSync}){
 const root=fs.realpathSync(repo),schema=path.join(root,'prisma/schema.prisma'),engine=path.join(root,'node_modules/@prisma/engines/schema-engine-darwin-arm64'),cli=path.join(root,'node_modules/prisma/build/index.js');
 if(hash(fs.readFileSync(schema))!==SCHEMA||hash(fs.readFileSync(engine))!==ENGINE||fs.existsSync(output))throw Error('synthetic_recipe_unavailable');
 const original=fs.readFileSync(schema,'utf8');const needle='url      = env("DATABASE_URL")';if(original.split(needle).length!==2)throw Error('synthetic_recipe_datasource_unavailable');
 const staging=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-schema-only-'));let result;const prepared=original.replace(needle,'url      = "postgresql://qualification.invalid/qualification"');try{const input=path.join(staging,'schema.prisma');fs.writeFileSync(input,prepared,{mode:0o600,flag:'wx'});result=ports.run(process.execPath,[cli,'migrate','diff','--from-empty','--to-schema-datamodel',input,'--script'],{cwd:staging,env:{NODE_ENV:'production',PRISMA_SCHEMA_ENGINE_BINARY:engine,PRISMA_HIDE_UPDATE_MESSAGE:'true'},encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});}finally{fs.rmSync(staging,{recursive:true,force:true});}
 if(result.error||result.status!==0||typeof result.stdout!=='string'||!result.stdout.trim())throw Error('synthetic_recipe_unavailable');
 const schemaText=fs.readFileSync(schema,'utf8'),models=[...schemaText.matchAll(/^model ([A-Za-z0-9_]+) \{/gm)].map(m=>m[1]);
 // @@map names, if introduced, must be consciously handled before generation.
 if(/@@map\(/.test(schemaText)||models.some(name=>!result.stdout.includes('CREATE TABLE "'+name+'"')&&!result.stdout.includes('CREATE TABLE "public"."'+name+'"')))throw Error('synthetic_recipe_schema_coverage_unavailable');
 const sql=Buffer.from(result.stdout),seed=fs.readFileSync(path.join(root,'lib/governance/qualification/fixture-seed.sql'));
 fs.mkdirSync(output,{mode:0o700});for(const[name,data]of[['fixture-schema.sql',sql],['fixture-seed.sql',seed]])fs.writeFileSync(path.join(output,name),data,{mode:0o600,flag:'wx'});
 const binding={format:'axiom.synthetic-fixture-schema/1',schemaSha256:SCHEMA,engineSha256:ENGINE,diffInputSha256:hash(Buffer.from(prepared)),sqlSha256:hash(sql),seedSha256:hash(seed),models:models.sort(),completeSchema:true,qualification:false};fs.writeFileSync(path.join(output,'fixture-schema.binding.json'),JSON.stringify(binding)+'\n',{mode:0o600,flag:'wx'});return binding;
}
module.exports=Object.freeze({prepareSyntheticFixtureRecipe});
