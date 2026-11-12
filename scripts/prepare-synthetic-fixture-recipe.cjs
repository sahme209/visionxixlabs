'use strict';
// Preparation function only. Importing never starts compiler/engine/SQL. Actual
// invocation requires the separately authorized artifact-generation packet.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),child=require('node:child_process'),os=require('node:os');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Reviewed Prisma 7 generator/config-only delta; all 175 models are unchanged.
// Historical packet authority intentionally retains its original schema/source pins.
const SCHEMA='3506b845ca355b6485fce4a4600957fc65c7f6b1b2a96ca886e4264d385d21ae';
const ENGINE='6032ea1bdbd6dc3d453c36a22838d1d3b3554053083bf7695c104e9993637ba1';
const CLI_VERSION='7.10.1',ENGINE_VERSION='d1b3f377ca835d73fd50954a5e22128b9ebdd6b8';
const CLI_ENTRY='763611d694b08952ced7c5abb3b9d61906fed0a8997d9214ac918a43928e0fc8',CLI_BODY='4ab8a95f0072dfa7c3db869a5ff8f775499f22c346a4556991c0ae28eb1220fd';
function prepareSyntheticFixtureRecipe(repo,output,ports={run:child.spawnSync}){
 const root=fs.realpathSync(repo),schema=path.join(root,'prisma/schema.prisma'),engine=ports.schemaEnginePath===undefined?path.join(root,'node_modules/@prisma/engines/schema-engine-darwin-arm64'):ports.schemaEnginePath,cli=path.join(root,'node_modules/prisma/build/index.js');
 if(typeof engine!=='string'||!path.isAbsolute(engine)||engine.includes('\0'))throw Error('synthetic_recipe_engine_unavailable');
 if(hash(fs.readFileSync(schema))!==SCHEMA||hash(fs.readFileSync(engine))!==ENGINE||fs.existsSync(output))throw Error('synthetic_recipe_unavailable');
 const cliRoot=path.join(root,'node_modules/prisma');
 if(JSON.parse(fs.readFileSync(path.join(cliRoot,'package.json'),'utf8')).version!==CLI_VERSION||hash(fs.readFileSync(cli))!==CLI_ENTRY||hash(fs.readFileSync(path.join(cliRoot,'build/cli.js')))!==CLI_BODY)throw Error('synthetic_recipe_cli_unavailable');
 const prepared=fs.readFileSync(schema,'utf8');
 // Pure datamodel diff only: no datasource/config URL and no inherited env.
 if(/\burl\s*=|env\s*\(/.test(prepared))throw Error('synthetic_recipe_datasource_unavailable');
 const staging=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-schema-only-'));let result;try{const input=path.join(staging,'schema.prisma');fs.writeFileSync(input,prepared,{mode:0o600,flag:'wx'});result=ports.run(process.execPath,[cli,'migrate','diff','--from-empty','--to-schema',input,'--script'],{cwd:staging,env:{NODE_ENV:'production',PRISMA_SCHEMA_ENGINE_BINARY:engine,PRISMA_HIDE_UPDATE_MESSAGE:'true',CHECKPOINT_DISABLE:'1',PRISMA_GENERATE_SKIP_AUTOINSTALL:'true'},encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});}finally{fs.rmSync(staging,{recursive:true,force:true});}

 if(result.error||result.status!==0||typeof result.stdout!=='string'||!result.stdout.trim())throw Error('synthetic_recipe_unavailable');
 const schemaText=fs.readFileSync(schema,'utf8'),models=[...schemaText.matchAll(/^model ([A-Za-z0-9_]+) \{/gm)].map(m=>m[1]);
 // @@map names, if introduced, must be consciously handled before generation.
 if(/@@map\(/.test(schemaText)||models.some(name=>!result.stdout.includes('CREATE TABLE "'+name+'"')&&!result.stdout.includes('CREATE TABLE "public"."'+name+'"')))throw Error('synthetic_recipe_schema_coverage_unavailable');
 const sql=Buffer.from(result.stdout),seed=fs.readFileSync(path.join(root,'lib/governance/qualification/fixture-seed.sql'));
 fs.mkdirSync(output,{mode:0o700});for(const[name,data]of[['fixture-schema.sql',sql],['fixture-seed.sql',seed]])fs.writeFileSync(path.join(output,name),data,{mode:0o600,flag:'wx'});
 const binding={format:'axiom.synthetic-fixture-schema/2',prismaVersion:CLI_VERSION,engineVersion:ENGINE_VERSION,cliEntrySha256:CLI_ENTRY,cliBodySha256:CLI_BODY,schemaSha256:SCHEMA,engineSha256:ENGINE,diffInputSha256:hash(Buffer.from(prepared)),sqlSha256:hash(sql),seedSha256:hash(seed),models:models.sort(),completeSchema:true,qualification:false};fs.writeFileSync(path.join(output,'fixture-schema.binding.json'),JSON.stringify(binding)+'\n',{mode:0o600,flag:'wx'});return binding;
}
module.exports=Object.freeze({prepareSyntheticFixtureRecipe});
