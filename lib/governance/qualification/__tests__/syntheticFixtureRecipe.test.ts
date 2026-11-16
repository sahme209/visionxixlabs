import {it,expect,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);const {prepareSyntheticFixtureRecipe}=require('../../../../scripts/prepare-synthetic-fixture-recipe.cjs');

// Historical recipe pins remain closed to the live Google schema. This inert
// test fixture preserves only the approved bytes for mocked compiler tests.
const historicalSchema=fs.readFileSync(fileURLToPath(new URL('./fixtures/approved-historical-schema.prisma',import.meta.url)),'utf8');
const historicalSha='436c0991b65b878aba7754408b7d6bc5afeaf78e4e4f7d52333cc0cec31b6cf4';
function historicalView(parent:string){
 expect(createHash('sha256').update(historicalSchema).digest('hex')).toBe(historicalSha);
 const view=path.join(parent,'approved-historical-view');
 fs.mkdirSync(path.join(view,'prisma'),{recursive:true});
 fs.mkdirSync(path.join(view,'lib/governance/qualification'),{recursive:true});
 fs.writeFileSync(path.join(view,'prisma/schema.prisma'),historicalSchema);
 fs.copyFileSync('lib/governance/qualification/fixture-seed.sql',path.join(view,'lib/governance/qualification/fixture-seed.sql'));
 // Only reads of the existing pinned dependency bytes are needed; run stays mocked.
 fs.symlinkSync(path.resolve('node_modules'),path.join(view,'node_modules'),'dir');
 return view;
}

// scripts/prepare-synthetic-fixture-recipe.cjs pins the darwin-arm64 Prisma schema engine; it only exists on Apple-silicon Macs.
const appleSiliconMac=process.platform==='darwin'&&process.arch==='arm64';
it.skipIf(!appleSiliconMac)('binds complete approved historical schema and rejects missing-table synthetic compiler output without invoking engine',()=>{const parent=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-recipe-mock-'));try{const schema=historicalSchema;const models=[...schema.matchAll(/^model ([A-Za-z0-9_]+) \{/gm)].map(x=>x[1]);const run=vi.fn((_node:string,args:string[],options:{cwd:string})=>{const input=fs.readFileSync(args[args.indexOf('--to-schema')+1],'utf8');expect(input).not.toContain('env("DATABASE_URL")');expect(input).not.toContain('url =');expect(input).toBe(schema);expect(options.cwd).not.toBe(process.cwd());return{status:0,stdout:models.map(name=>`CREATE TABLE "${name}" (id text);`).join('\n')};});const result=prepareSyntheticFixtureRecipe(historicalView(parent),path.join(parent,'good'),{run});expect(result.models).toHaveLength(models.length);expect(result.qualification).toBe(false);expect(result.format).toBe('axiom.synthetic-fixture-schema/2');expect(result.prismaVersion).toBe('7.10.1');expect(run).toHaveBeenCalledOnce();const options=run.mock.calls[0] as unknown as [string,string[],{env:Record<string,string>}];expect(options[2].env.DATABASE_URL).toBeUndefined();expect(options[1]).toContain('--from-empty');expect(()=>prepareSyntheticFixtureRecipe(path.join(parent,'approved-historical-view'),path.join(parent,'bad'),{run:()=>({status:0,stdout:'CREATE TABLE "User" (id text);'})})).toThrow('synthetic_recipe_schema_coverage_unavailable');expect(fs.existsSync(path.join(parent,'bad'))).toBe(false);}finally{fs.rmSync(parent,{recursive:true,force:true});}});
it.skipIf(!appleSiliconMac)('selected separately pinned original engine supports an otherwise engine-free immutable dependency view, without changing default',()=>{const parent=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-recipe-engine-view-'));try{const view=path.join(parent,'source-view');fs.mkdirSync(path.join(view,'prisma'),{recursive:true});fs.mkdirSync(path.join(view,'lib/governance/qualification'),{recursive:true});const schema=historicalSchema;fs.writeFileSync(path.join(view,'prisma/schema.prisma'),schema);fs.copyFileSync('lib/governance/qualification/fixture-seed.sql',path.join(view,'lib/governance/qualification/fixture-seed.sql'));fs.mkdirSync(path.join(view,'node_modules/prisma/build'),{recursive:true});for(const name of ['package.json','build/index.js','build/cli.js'])fs.copyFileSync(path.join('node_modules/prisma',name),path.join(view,'node_modules/prisma',name));const engine=path.resolve('node_modules/@prisma/engines/schema-engine-darwin-arm64'),models=[...schema.matchAll(/^model ([A-Za-z0-9_]+) \{/gm)].map(x=>x[1]),run=vi.fn((_node:string,_argv:string[],options:{env:Record<string,string>})=>{expect(options.env.PRISMA_SCHEMA_ENGINE_BINARY).toBe(engine);return{status:0,stdout:models.map(name=>`CREATE TABLE "${name}" (id text);`).join('\n')}});const result=prepareSyntheticFixtureRecipe(view,path.join(parent,'selected'),{run,schemaEnginePath:engine});expect(result.engineSha256).toBe('6032ea1bdbd6dc3d453c36a22838d1d3b3554053083bf7695c104e9993637ba1');expect(run).toHaveBeenCalledTimes(1);expect(()=>prepareSyntheticFixtureRecipe(view,path.join(parent,'default'),{run})).toThrow();const wrong=path.join(parent,'wrong-engine');fs.writeFileSync(wrong,'INERT INCORRECT ENGINE');expect(()=>prepareSyntheticFixtureRecipe(view,path.join(parent,'wrong'),{run,schemaEnginePath:wrong})).toThrow('synthetic_recipe_unavailable');expect(run).toHaveBeenCalledTimes(1)}finally{fs.rmSync(parent,{recursive:true,force:true})}});

it('refuses any schema-byte drift before inspecting an engine or invoking a compiler',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-recipe-schema-drift-'));
 try{
  const view=path.join(parent,'source'),output=path.join(parent,'output');fs.mkdirSync(path.join(view,'prisma'),{recursive:true});
  fs.writeFileSync(path.join(view,'prisma/schema.prisma'),fs.readFileSync('prisma/schema.prisma','utf8')+'\n// synthetic unreviewed drift\n');
  const run=vi.fn();
  expect(()=>prepareSyntheticFixtureRecipe(view,output,{run,schemaEnginePath:path.join(parent,'engine-must-not-be-opened')})).toThrow('synthetic_recipe_unavailable');
  expect(run).not.toHaveBeenCalled();expect(fs.existsSync(output)).toBe(false);
 }finally{fs.rmSync(parent,{recursive:true,force:true})}
});
it.skipIf(!appleSiliconMac)('refuses CLI version or byte drift before an injected compiler can run',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-recipe-cli-drift-'));
 try{
  fs.mkdirSync(path.join(parent,'prisma'),{recursive:true});fs.mkdirSync(path.join(parent,'node_modules/prisma/build'),{recursive:true});
  fs.writeFileSync(path.join(parent,'prisma/schema.prisma'),historicalSchema);
  for(const name of ['package.json','build/index.js','build/cli.js'])fs.copyFileSync(path.join('node_modules/prisma',name),path.join(parent,'node_modules/prisma',name));
  const manifest=path.join(parent,'node_modules/prisma/package.json'),original=fs.readFileSync(manifest),run=vi.fn(),engine=path.resolve('node_modules/@prisma/engines/schema-engine-darwin-arm64');
  fs.writeFileSync(manifest,JSON.stringify({version:'5.22.0'}));
  expect(()=>prepareSyntheticFixtureRecipe(parent,path.join(parent,'wrong-version'),{run,schemaEnginePath:engine})).toThrow('synthetic_recipe_cli_unavailable');
  fs.writeFileSync(manifest,original);fs.appendFileSync(path.join(parent,'node_modules/prisma/build/cli.js'),'\n// unreviewed drift\n');
  expect(()=>prepareSyntheticFixtureRecipe(parent,path.join(parent,'wrong-bytes'),{run,schemaEnginePath:engine})).toThrow('synthetic_recipe_cli_unavailable');
  expect(run).not.toHaveBeenCalled();
 }finally{fs.rmSync(parent,{recursive:true,force:true})}
});
it.skipIf(!appleSiliconMac).each(['PlatformGovernanceEffect','PlatformManualRelease','PlatformManualReleaseEvent','PlatformOperationalDelegation','PlatformOperationalWorkloadUse','PlatformOperationalTarget','PlatformOperationalTargetReceipt','PlatformSettingsArtifact','PlatformCustodianBarrier','PlatformCustodianIntent','PlatformDeploymentTarget','PlatformDeploymentRequestReceipt','PlatformTemplateResource','PlatformTemplateReceipt','PlatformTemplateArtifact','PlatformTemplateDelivery','PlatformImageArtifact','PlatformImageUploadGrant'])('refuses a compiler output omitting only approved platform table %s',(missing)=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-recipe-platform-coverage-'));
 try{
  const schema=historicalSchema,models=[...schema.matchAll(/^model ([A-Za-z0-9_]+) \{/gm)].map(m=>m[1]),run=vi.fn(()=>({status:0,stdout:models.filter(name=>name!==missing).map(name=>`CREATE TABLE "${name}" (id text);`).join('\n')}));
  expect(models).toContain(missing);const view=historicalView(parent);expect(()=>prepareSyntheticFixtureRecipe(view,path.join(parent,'output'),{run})).toThrow('synthetic_recipe_schema_coverage_unavailable');expect(run).toHaveBeenCalledTimes(1);expect(fs.existsSync(path.join(parent,'output'))).toBe(false);
 }finally{fs.rmSync(parent,{recursive:true,force:true})}
});


it('keeps the current Google schema refused before engine access or compiler invocation',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-recipe-current-schema-refusal-'));
 try{
  const current=fs.readFileSync('prisma/schema.prisma');
  expect(current.toString()).toContain('model OAuthIdentity {');
  expect(current.toString()).toContain('model PendingGoogleIdentityLink {');
  expect(createHash('sha256').update(current).digest('hex')).not.toBe(historicalSha);
  const run=vi.fn(),output=path.join(parent,'output');
  expect(()=>prepareSyntheticFixtureRecipe(process.cwd(),output,{run,schemaEnginePath:path.join(parent,'engine-must-not-be-opened')})).toThrow('synthetic_recipe_unavailable');
  expect(run).not.toHaveBeenCalled();expect(fs.existsSync(output)).toBe(false);
 }finally{fs.rmSync(parent,{recursive:true,force:true})}
});
