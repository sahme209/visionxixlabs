import {afterEach,expect,it} from 'vitest';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parse} from 'yaml';
const workflow=parse(readFileSync('.github/workflows/desktop-release.yml','utf8'));
const step=workflow.jobs.build.steps.find((s:{name?:string})=>s.name==='Notarize and staple the distributable Mac disk image');
const roots:string[]=[];afterEach(()=>{for(const r of roots.splice(0))rmSync(r,{recursive:true,force:true});});
function run(overrides:Record<string,string>={}){
 const root=mkdtempSync(path.join(tmpdir(),'axiom-notary-fixture-'));roots.push(root);const bin=path.join(root,'bin');mkdirSync(bin);const dmg=path.join(root,'desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg');mkdirSync(dmg,{recursive:true});writeFileSync(path.join(dmg,'Axiom_0.1.21.dmg'),'synthetic bytes');if(overrides.MOCK_EXTRA_DMG)writeFileSync(path.join(dmg,'extra.dmg'),'synthetic bytes');if(overrides.MOCK_NO_DMG)rmSync(path.join(dmg,'Axiom_0.1.21.dmg'));const state=path.join(root,'calls.json');
 writeFileSync(path.join(bin,'xcrun'),`#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);const file=process.env.FIXTURE_STATE;const calls=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];calls.push(args.slice(0,2).join(' '));fs.writeFileSync(file,JSON.stringify(calls));if(args[0]==='notarytool'){if(process.env.MOCK_FAIL_SUBMIT)process.exit(1);console.log(JSON.stringify({status:process.env.MOCK_NOTARY_STATUS||'Accepted',id:process.env.MOCK_NOTARY_ID||'12345678-1234-4234-8234-123456789abc'}));}else if(args[1]==='staple'&&process.env.MOCK_FAIL_STAPLE)process.exit(1);\n`,{mode:0o700});
 const script=step.run.replaceAll('${{ matrix.target }}','aarch64-apple-darwin');const result=spawnSync('/bin/bash',['-e','-o','pipefail','-c',script],{cwd:root,encoding:'utf8',timeout:10000,env:{NODE_ENV:'test',PATH:bin+':'+path.dirname(process.execPath)+':/usr/bin:/bin',HOME:root,TMPDIR:root,APPLE_ID:'fixture@example.invalid',APPLE_PASSWORD:'synthetic-not-real-app-password',APPLE_TEAM_ID:'ABCDE12345',FIXTURE_STATE:state,...overrides}});return {result,calls:existsSync(state)?JSON.parse(readFileSync(state,'utf8')):[]};
}
it('requires an accepted complete notary response before stapling and validating the actual workflow disk image',()=>{const {result,calls}=run();expect(result.status,result.stderr).toBe(0);expect(calls).toEqual(['notarytool submit','stapler staple','stapler validate']);expect(step.run).toContain('--wait --timeout 20m --output-format json');expect(step.if).toBe("startsWith(matrix.platform, 'macos-')");});
it.each(['Invalid','In Progress','Rejected'])('refuses non-accepted submission %s without stapling',status=>{const {result,calls}=run({MOCK_NOTARY_STATUS:status});expect(result.status).not.toBe(0);expect(calls).toEqual(['notarytool submit']);expect(result.stderr).not.toContain('synthetic-not-real-app-password');});
it('refuses a malformed submission identity even when status claims accepted',()=>{const {result,calls}=run({MOCK_NOTARY_ID:'------------------------------------'});expect(result.status).not.toBe(0);expect(calls).toEqual(['notarytool submit']);});
it('does not staple after a failed submission command',()=>{const {result,calls}=run({MOCK_FAIL_SUBMIT:'1'});expect(result.status).not.toBe(0);expect(calls).toEqual(['notarytool submit']);});
it('does not validate after stapling fails',()=>{const {result,calls}=run({MOCK_FAIL_STAPLE:'1'});expect(result.status).not.toBe(0);expect(calls).toEqual(['notarytool submit','stapler staple']);});
it('refuses missing credentials before attempting any submission',()=>{const {result,calls}=run({APPLE_PASSWORD:''});expect(result.status).not.toBe(0);expect(calls).toEqual([]);});

it.each(['MOCK_EXTRA_DMG','MOCK_NO_DMG'])('refuses missing or ambiguous package input %s before submission',flag=>{const {result,calls}=run({[flag]:'1'});expect(result.status).not.toBe(0);expect(calls).toEqual([]);});
