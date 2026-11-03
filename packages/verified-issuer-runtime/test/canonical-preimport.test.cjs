'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');const os=require('node:os');const {spawnSync}=require('node:child_process');
const entry=path.resolve(__dirname,'../index.cjs');
test('actual main records preimport refusal without application loading on an unqualified root',()=>{
 const result=spawnSync(process.execPath,[entry],{env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},encoding:'utf8',timeout:5000});
 assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(result.stderr.trim(),'verified_issuer_launch_unavailable');
 // Negative regression only: this does not prove a qualified startup or native
 // constructor. Actual native preimport negatives have a separate owned fixture.
});
test('actual controlled-main gate rejects extra argv, module-cache exchange and supplied authority',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-canonical-uncontrolled-'));
 try{const file=path.join(dir,'foreign.cjs');fs.writeFileSync(file,`const assert=require('node:assert/strict');const first=require(${JSON.stringify(entry)});delete require.cache[require.resolve(${JSON.stringify(entry)})];const second=require(${JSON.stringify(entry)});for(const runtime of[first,second]){const state=runtime.readIssuerIdentity({status:'runtime_verified',issuerArtifactDigest:'a'.repeat(64)});assert.equal(state.status,'unavailable');assert.equal(state.executionAuthorized,false);assert.equal(Object.keys(runtime).join(','),'readIssuerIdentity')} console.log('foreign_and_reloaded_remain_unavailable')`);const result=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:5000});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'foreign_and_reloaded_remain_unavailable');}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
