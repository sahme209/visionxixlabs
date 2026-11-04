import {generateKeyPairSync,verify} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {createPrivateGithubAppAuth} from '../privateGithubAppAuth';
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const privateKey=keys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const binding={organizationId:'org',connectionId:'conn',connectionRevision:'2026-11-03T00:00:00.000Z',installationId:'42',repositoryFullName:'owned/repo',purpose:'merge' as const,planDigest:'a'.repeat(64)};
const signal=()=>new AbortController().signal;
function fixture(){
 let time=1800000000000,enabled=true,current=true,count=0;
 const requests:{url:string;options:RequestInit}[]=[];
 const fetcher=async(url:Parameters<typeof fetch>[0],options?:RequestInit)=>{
  requests.push({url:String(url),options:options!});
  if(options?.method==='POST')return new Response(JSON.stringify({token:`synthetic-${++count}`,expires_at:new Date(time+3600000).toISOString(),permissions:JSON.parse(String(options.body)).permissions,repository_selection:'selected',repositories:[{name:'repo',full_name:'owned/repo',owner:{login:'owned'}}]}),{status:201});
  return new Response(JSON.stringify({id:42,app_id:123,suspended_at:null,repository_selection:'selected',account:{id:9,login:'owned',type:'Organization'},permissions:{contents:'write',pull_requests:'read',actions:'write'}}));
 };
 const configuration={resolveSigningConfiguration:async()=>({appConfigured:true,appId:123,privateKey}),getGithubConfig:async()=>{throw Error('split configuration forbidden')},resolveGithubAppPrivateKey:async()=>{throw Error('split key forbidden')}};
 const create=()=>createPrivateGithubAppAuth({configuration,fetch:fetcher as typeof fetch,now:()=>time});
 const authority={isEnabled:()=>enabled,assertCurrent:async()=>()=>{if(!current)throw Error('revoked')}};
 return {create,requests,authority,advance:(ms:number)=>{time+=ms},disable:()=>{enabled=false},revoke:()=>{current=false},now:()=>time};
}
describe('private actual release authentication',()=>{
 it('mints uncached exact repository profiles with atomic signing and fixed transport/time',async()=>{
  const f=fixture(),auth=f.create();
  expect(typeof (auth as any).resolveReleaseInstallationToken).toBe('function');
  for(const [purpose,permissions] of [ ['merge',{contents:'write',pull_requests:'read',metadata:'read'}],['dispatch',{actions:'write',contents:'read',metadata:'read'}],['merge_policy_read',{administration:'read',contents:'read',pull_requests:'read',metadata:'read'}]] as const){
   const result=await auth.resolveReleaseInstallationToken({...binding,...f.authority,purpose},signal());
   expect(result).toMatchObject({token:expect.stringMatching(/^synthetic-/),permissions});
   expect(JSON.parse(String(f.requests.at(-1)!.options.body))).toEqual({repositories:['repo'],permissions});
  }
  await auth.resolveReleaseInstallationToken({...binding,...f.authority},signal());expect(f.requests).toHaveLength(4);
  const jwt=(f.requests[0].options.headers as Record<string,string>).Authorization.slice(7),[h,p,s]=jwt.split('.');
  expect(verify('RSA-SHA256',Buffer.from(`${h}.${p}`),keys.publicKey,Buffer.from(s,'base64url'))).toBe(true);
  expect(JSON.parse(Buffer.from(p,'base64url').toString())).toEqual({iat:f.now()/1000-30,exp:f.now()/1000+540,iss:123});
 });
 it('captures transport at construction and ignores attempted business transport injection',async()=>{
  const f=fixture();let calls=0;
  const fixed=async()=>{calls++;return new Response('{}',{status:403})};
  const configuration={resolveSigningConfiguration:async()=>({appConfigured:true,appId:123,privateKey}),getGithubConfig:async()=>({appConfigured:true,appId:123}),resolveGithubAppPrivateKey:async()=>privateKey};
  const dependencies={configuration,fetch:fixed as typeof fetch,now:f.now};
  const auth=createPrivateGithubAppAuth(dependencies);
  dependencies.fetch=(async()=>{throw Error('replacement transport')}) as typeof fetch;
  expect(await auth.resolveReleaseInstallationToken({...binding,...f.authority,fetch:dependencies.fetch} as never,signal())).toBeNull();
  expect(calls).toBe(1);
 });
 it('refuses malformed atomic snapshots without split configuration fallback',async()=>{
  const f=fixture();let splitReads=0;
  const configuration={resolveSigningConfiguration:async()=>undefined as never,getGithubConfig:async()=>{splitReads++;return {appConfigured:true,appId:123}},resolveGithubAppPrivateKey:async()=>{splitReads++;return privateKey}};
  const auth=createPrivateGithubAppAuth({configuration,fetch:(async()=>new Response('{}',{status:403})) as typeof fetch,now:f.now});
  expect(await auth.resolveReleaseInstallationToken({...binding,...f.authority},signal())).toBeNull();
  expect(await auth.readReleaseInstallationEligibility({...binding,...f.authority},signal())).toBeNull();
  expect(splitReads).toBe(0);
 });
 it('retains same-instance one-use binding, five second freshness and current authority',async()=>{
  const f=fixture(),auth=f.create(),other=f.create();
  expect(typeof (auth as any).readReleaseInstallationEligibility).toBe('function');
  const read=()=>auth.readReleaseInstallationEligibility({...binding,...f.authority},signal());
  const proof=await read();expect(proof).not.toBeNull();
  expect(()=>other.consumeReleaseInstallationEligibility(proof!,binding)).toThrow();
  expect(()=>auth.consumeReleaseInstallationEligibility({...proof},binding)).toThrow();
  const consumed=auth.consumeReleaseInstallationEligibility(proof!,binding);expect(consumed.providerEligibilityVerified).toBe(true);
  expect(()=>auth.consumeReleaseInstallationEligibility(proof!,binding)).toThrow();
  f.advance(5000);expect(()=>consumed.assertFresh()).toThrow();
  const fresh=await read();expect(fresh).not.toBeNull();f.revoke();expect(()=>auth.consumeReleaseInstallationEligibility(fresh!,binding)).toThrow();
 });
});
