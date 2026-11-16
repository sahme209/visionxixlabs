import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { encode, getToken } from 'next-auth/jwt';
import { readFileSync } from 'node:fs';
import { assessCompiledProductGate, PRODUCT_CASES, runOwnedGateCommand, assessFictionalProductDownload } from '../../../scripts/check-compiled-product-journeys.mjs';

function good() {
 const wire={actualCompiledRoute:true,optionsPresent:false,searchPathPresent:false,authWrites:0,sqlWrites:0,connections:1,realTls:true,verifiedClientCaAndHostname:true,ownedSocketsClosed:true,safeReadinessLogOnly:true};
 const http={accepted:true,compiledProductionServer:true,actualOwnedPostgres:true,passwordVerificationAndCanonicalSession:true,wrongPasswordAndUnverifiedRefused:true,membershipBootstrap:true,actualCompiledAppTlsSessions:true,googleLinkHttp:{noPlatformSessionMint:true,intentConsumedOnce:true,replayRefused:true},googleOAuthVerified:false,liveMailAttempted:false,googleLinkIntentExplicitlySynthetic:true,statusStoresOperational:true,hostileRoleDefaultConfigured:true};
 return {schema:'axiom.compiled-product-gate/1',sourceSha:'a'.repeat(40),actualProductionBuild:true,compiledDigest:'b'.repeat(64),inputsUnchanged:true,cleanup:{childGroupsEmpty:true,containerAbsent:true,keysRemoved:true},cases:{
  'wire-old-control':{oldStartupControl:true,actualCompiledRoute:false,optionsPresent:true,responseStatus:503,authWrites:0,sqlWrites:0,ownedSocketsClosed:true},
  'wire-direct':{...wire},'wire-pooler':{...wire},'wire-unknown':{...wire},
  'compiled-http-direct':{...http,fourPlatformFictionalAssets:false,downloadStorageGate:'503_missing_then_404_no_external_asset_then_503_removed'},
  'compiled-http-alternate':{...http,fourPlatformFictionalAssets:true,downloadStorageGate:'503_missing_then_200_fictional_assets_then_503_removed'},
  'remote-transactions':{accepted:true,actualPostgres:true,hostileDefaultsPublic:true,twoRealBackendSessions:true,readOnlyAfterShow:true,isolationAndSavepoint:true,failedQueryRollback:true,simulatedCommitDeliveryLoss:true,committedEffectExactlyOnce:true,dirtyLeaseDiscarded:true,ownedPoolDisposed:true},
 }};
}
describe('mandatory compiled product gate',()=>{
 it('keeps successful synthetic coverage separate from real Google and release acceptance',()=>{
  expect(assessCompiledProductGate(good())).toMatchObject({accepted:true,selectedCases:7,releaseAccepted:false,realGoogle:'UNVERIFIED',mail:'UNVERIFIED',nativePairing:'UNVERIFIED'});
 });
 it('refuses omitted cases, including an empty selection',()=>{
  for(const key of PRODUCT_CASES){const receipt=good();delete (receipt.cases as Record<string,unknown>)[key];expect(assessCompiledProductGate(receipt).accepted).toBe(false)}
  expect(assessCompiledProductGate({...good(),cases:{}}).accepted).toBe(false);
 });
 it('refuses unsupported startup options on either remote route, and any auth/SQL in the startup-only probe',()=>{
  for(const name of ['wire-direct','wire-pooler','wire-unknown'] as const){for(const changed of [{optionsPresent:true},{searchPathPresent:true},{authWrites:1},{sqlWrites:1},{connections:0},{verifiedClientCaAndHostname:false}]){const receipt=good();Object.assign(receipt.cases[name],changed);expect(assessCompiledProductGate(receipt).accepted).toBe(false)}}
 });
 it('requires the actual old-options rejection control',()=>{
  const receipt=good();receipt.cases['wire-old-control'].optionsPresent=false;expect(assessCompiledProductGate(receipt).accepted).toBe(false);
 });
 it('refuses false authentication success and an asserted real provider result',()=>{
  for(const name of ['compiled-http-direct','compiled-http-alternate'] as const){for(const changed of [{passwordVerificationAndCanonicalSession:false},{wrongPasswordAndUnverifiedRefused:false},{googleOAuthVerified:true},{googleLinkIntentExplicitlySynthetic:false},{actualCompiledAppTlsSessions:false},{hostileRoleDefaultConfigured:false},{statusStoresOperational:false}]){const receipt=good();Object.assign(receipt.cases[name],changed);expect(assessCompiledProductGate(receipt).accepted).toBe(false)}}
  const receipt=good();receipt.cases['compiled-http-alternate'].googleLinkHttp.noPlatformSessionMint=false;expect(assessCompiledProductGate(receipt).accepted).toBe(false);
 });
 it('requires available downloads and the subsequent missing-store refusal',()=>{
  const receipt=good();receipt.cases['compiled-http-alternate'].downloadStorageGate='200';expect(assessCompiledProductGate(receipt).accepted).toBe(false);
 });
 it('requires real transaction rotation, readonly timing, savepoints, uncertainty and pool cleanup',()=>{
  for(const key of Object.keys(good().cases['remote-transactions'])){const receipt=good();(receipt.cases['remote-transactions'] as Record<string,boolean>)[key]=false;expect(assessCompiledProductGate(receipt).accepted).toBe(false)}
 });
 it('refuses changed inputs, absent compilation, invalid source binding and incomplete cleanup',()=>{
  for(const changed of [{inputsUnchanged:false},{actualProductionBuild:false},{sourceSha:'unknown'},{compiledDigest:''}])expect(assessCompiledProductGate({...good(),...changed}).accepted).toBe(false);
  for(const key of Object.keys(good().cleanup)){const receipt=good();(receipt.cleanup as Record<string,boolean>)[key]=false;expect(assessCompiledProductGate(receipt).accepted).toBe(false)}
 });
 it('refuses cancellation or a late failure even with seven successful receipts',()=>{
  expect(assessCompiledProductGate({...good(),cancelled:true}).accepted).toBe(false);
  expect(assessCompiledProductGate({...good(),failure:'owned_gate_failed_at_final'}).accepted).toBe(false);
 });
 it('kills surviving descendants when their leader already exited with inherited pipes',async()=>{
  let owner: any;let unconfirmed=false;const started=Date.now();
  const script="const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore',process.stdout,process.stderr]});child.unref();process.exit(0)";
  await expect(runOwnedGateCommand(process.execPath,['-e',script],{cwd:process.cwd(),env:{PATH:process.env.PATH,NODE_ENV:'test'},deadline:Date.now()+3000,limit:150,onOwner:child=>{owner=child},onUnconfirmed:()=>{unconfirmed=true}})).rejects.toThrow('owned_command_failed');
  expect(owner).toBeUndefined();expect(unconfirmed).toBe(false);expect(Date.now()-started).toBeLessThan(2500);
 },4000);
 it('rejects ARM bytes echoed as every platform despite internally consistent redirects',()=>{
  const platforms={ 'mac-arm':['macos-arm','V19_0.0.1_aarch64.dmg'], 'mac-intel':['macos-intel','V19_0.0.1_x64.dmg'], windows:['windows-x64','V19_0.0.1_x64_en-US.msi'], linux:['linux-x64','V19_0.0.1_amd64.AppImage'] };
  for(const [platform,[assetPlatform,fileName]] of Object.entries(platforms)){
   const downloadUrl='https://github.com/sahme209/axiom-releases/releases/download/desktop-v0.0.1/'+fileName;
   const body={status:'available',platform,version:'desktop-v0.0.1',asset:{platform:assetPlatform,fileName,sizeBytes:123,digest:'sha256:'+'a'.repeat(64),downloadUrl}};
   expect(assessFictionalProductDownload(platform,body,downloadUrl)).toBe(true);
   if(platform!=='mac-arm'){const wrongUrl='https://github.com/sahme209/axiom-releases/releases/download/desktop-v0.0.1/V19_0.0.1_aarch64.dmg';expect(assessFictionalProductDownload(platform,{...body,asset:{...body.asset,platform:'macos-arm',fileName:'V19_0.0.1_aarch64.dmg',downloadUrl:wrongUrl}},wrongUrl)).toBe(false)}
  }
 });
 it('supplies parsed real cookie values to installed NextAuth getToken without replacing its decoder',async()=>{
  const secret='fictional-owned-sdk-regression-secret';const encoded=await encode({token:{id:'owned-verified',identityVersion:1},secret});
  const cookie='next-auth.session-token='+encodeURIComponent(encoded);
  expect(await getToken({req:{headers:{cookie}} as never,secret,secureCookie:false})).toBeNull();
  const {parse}=createRequire(process.cwd()+'/package.json')('cookie');
  const actual=await getToken({req:{headers:{cookie},cookies:parse(cookie)} as never,secret,secureCookie:false});
  expect(actual).toMatchObject({id:'owned-verified',identityVersion:1});
 });
 it('waits for final TCP PostgreSQL rather than the temporary socket-only init server',()=>{
  const source=readFileSync('scripts/check-compiled-product-journeys.mjs','utf8');
  const readiness=(text:string)=>{
   const ast=ts.createSourceFile('gate.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);const found:string[][]=[];
   const visit=(node:ts.Node)=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='command'&&node.arguments[0]?.getText(ast)==="'docker'"&&node.arguments[1]&&ts.isArrayLiteralExpression(node.arguments[1])){
    const args=node.arguments[1].elements.map(x=>ts.isStringLiteral(x)?x.text:ts.isIdentifier(x)&&x.text==='name'?'owned-container':'UNSUPPORTED');
    if(args.includes('pg_isready'))found.push(args);
   }ts.forEachChild(node,visit)};visit(ast);expect(found).toHaveLength(1);return found[0];
  };
  const expected=['exec','owned-container','pg_isready','-h','127.0.0.1','-p','5432','-U','axiom_local_fixture'];
  expect(readiness(source)).toEqual(expected);
  const socketOnly=source.replace(",'pg_isready','-h','127.0.0.1','-p','5432'",",'pg_isready'");
  expect(readiness(socketOnly)).not.toEqual(expected);
 });
 it('runs once after the existing production build inside the existing required build job',()=>{
  const workflow=readFileSync('.github/workflows/test.yml','utf8');
  const build=workflow.slice(workflow.indexOf('\n  build:'),workflow.indexOf('\n  # Keeps the required status'));
  expect(build).toContain('timeout-minutes: 20');
  expect(build.match(/run: npm run build/g)).toHaveLength(1);
  expect(build.match(/run: node scripts\/check-compiled-product-journeys.mjs/g)).toHaveLength(1);
  expect(build.indexOf('run: npm run build')).toBeLessThan(build.indexOf('run: node scripts/check-compiled-product-journeys.mjs'));
  expect(build).toMatch(/name: Required compiled login and download journeys\n        timeout-minutes: 6\n        run: node scripts\/check-compiled-product-journeys.mjs/);
  expect(workflow).toContain('needs: [typecheck, vitest, build]');
 });
});
