import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';

it('refuses the actual legacy settings script before any environment or fetch access',async()=>{
 const source=readFileSync(resolve('scripts/setup-vercel-env.mjs'),'utf8').replace(/^#![^\n]*\n/,''),events:string[]=[];
 const context={process:{env:new Proxy({}, {get(){events.push('environment');throw Error('must not read credentials')}}),exit(code:number){events.push('exit:'+code);throw Error('fixture_exit')}},console:{error(message:string){events.push(message)},log(){events.push('log')}},fetch(){events.push('fetch');throw Error('must not fetch')}};
 await expect(runInNewContext('(async()=>{'+source+'\n})()',context)).rejects.toThrow('fixture_exit');
 expect(events).toEqual(['Axiom managed settings review is required. This legacy setup script is retired; no settings or deployment were changed.','exit:1']);
});
it('refuses the actual OAuth setup entrypoint without requiring CLI or credential setup',()=>{
 const result=spawnSync('/bin/bash',['scripts/setup-oauth.sh'],{cwd:process.cwd(),env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',NODE_ENV:'test'},encoding:'utf8',timeout:3000});
 expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr.trim()).toBe('Axiom managed settings review is required. This legacy OAuth setup script is retired; no settings or deployment were changed.');
 const source=readFileSync(resolve('scripts/setup-oauth.sh'),'utf8');expect(source).not.toMatch(/vercel (env|--prod)|CLIENT_SECRET|CLIENT_ID|command -v/);
});
