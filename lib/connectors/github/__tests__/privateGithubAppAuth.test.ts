import {generateKeyPairSync,verify} from 'node:crypto';
import {describe,it,expect,vi} from 'vitest';
import {createPrivateGithubAppAuth} from '../privateGithubAppAuth';
import {createPrivatePlatformGithubAppConfiguration} from '../privatePlatformGithubAppConfiguration';
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=keys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const request={installationId:42,repositories:['Repo'],permissionProfile:'contents_read' as const};
function fixture(){let time=1_800_000_000_000;const transport=vi.fn(async(_url: Parameters<typeof fetch>[0], _options?: RequestInit)=>new Response(JSON.stringify({token:'owned-simulated-token',expires_at:new Date(time+3600000).toISOString(),permissions:{contents:'read',metadata:'read'},repository_selection:'selected',repositories:[{name:'repo'}]}),{status:201}));const create=()=>createPrivateGithubAppAuth({configuration:{resolveSigningConfiguration:async()=>({appConfigured:true,appId:123,privateKey:pem}),getGithubConfig:async()=>({appConfigured:true,appId:123}),resolveGithubAppPrivateKey:async()=>pem},fetch:transport as typeof fetch,now:()=>time});return {transport,create,advance:(ms:number)=>{time+=ms},now:()=>time};}
describe('private App auth actual mechanics',()=>{
 it('cancels stalled configuration without transport and keeps distinct signing keys',async()=>{
  const f=fixture(),controller=new AbortController();
  const stalled=createPrivateGithubAppAuth({configuration:{resolveSigningConfiguration:()=>new Promise(()=>{}),getGithubConfig:()=>new Promise(()=>{}),resolveGithubAppPrivateKey:async()=>pem},fetch:f.transport as typeof fetch,now:f.now});
  const pending=stalled.resolveGithubInstallationToken({...request,signal:controller.signal});controller.abort();
  expect(await pending).toMatchObject({ok:false,errorCode:'github.app_token_cancelled'});expect(f.transport).not.toHaveBeenCalled();
  const other=generateKeyPairSync('rsa',{modulusLength:2048});
  const second=createPrivateGithubAppAuth({configuration:{resolveSigningConfiguration:async()=>({appConfigured:true,appId:456,privateKey:other.privateKey.export({type:"pkcs8",format:"pem"}).toString()}),getGithubConfig:async()=>({appConfigured:true,appId:456}),resolveGithubAppPrivateKey:async()=>other.privateKey.export({type:'pkcs8',format:'pem'}).toString()},fetch:f.transport as typeof fetch,now:f.now});
  await f.create().resolveGithubInstallationToken(request);await second.resolveGithubInstallationToken(request);
  expect(f.transport).toHaveBeenCalledTimes(2);
  const options=f.transport.mock.calls[1][1] as RequestInit;
  const [h,p,s]=(options.headers as Record<string,string>).Authorization.slice(7).split('.');
  expect(verify('RSA-SHA256',Buffer.from(`${h}.${p}`),other.publicKey,Buffer.from(s,'base64url'))).toBe(true);
  expect(verify('RSA-SHA256',Buffer.from(`${h}.${p}`),keys.publicKey,Buffer.from(s,'base64url'))).toBe(false);
 });
 it('does not reuse a cached token after configuration removal or App rotation',async()=>{
  const f=fixture();let appId=123,removed=false;
  const configuration={resolveSigningConfiguration:async()=>{if(removed)throw Error('removed');return {appConfigured:true,appId,privateKey:pem};},getGithubConfig:async()=>({appConfigured:true,appId}),resolveGithubAppPrivateKey:async()=>pem};
  const a=createPrivateGithubAppAuth({configuration,fetch:f.transport as typeof fetch,now:f.now});
  await a.resolveGithubInstallationToken(request);appId=456;await a.resolveGithubInstallationToken(request);expect(f.transport).toHaveBeenCalledTimes(2);removed=true;expect((await a.resolveGithubInstallationToken(request)).ok).toBe(false);expect(f.transport).toHaveBeenCalledTimes(2);
 });
 it('purge prevents an in-flight mint from restoring cached credentials',async()=>{
  const f=fixture(),a=f.create();let release!:()=>void;
  f.transport.mockImplementationOnce(async()=>{await new Promise<void>(resolve=>{release=resolve});return new Response(JSON.stringify({token:'pending',expires_at:new Date(f.now()+3600000).toISOString(),permissions:{contents:'read'},repository_selection:'selected',repositories:[{name:'repo'}]}),{status:201});});
  const pending=a.resolveGithubInstallationToken(request);await vi.waitFor(()=>expect(f.transport).toHaveBeenCalledTimes(1));a.purgeInstallationTokenCache(42);release();expect((await pending).ok).toBe(false);await a.resolveGithubInstallationToken(request);expect(f.transport).toHaveBeenCalledTimes(2);
 });
 it('reads bounded matching installation metadata without token minting',async()=>{
  const f=fixture(),a=f.create();f.transport.mockResolvedValueOnce(new Response(JSON.stringify({id:42,app_id:123,suspended_at:null,repository_selection:'selected',account:{id:9,login:'owned',type:'Organization'}})));
  expect(await a.readGithubAppInstallation('42',new AbortController().signal)).toMatchObject({installationId:'42',appId:123,accountId:'9',suspended:false,observedAt:new Date(f.now()).toISOString()});
  expect(f.transport.mock.calls[0][1]?.method).toBe('GET');
  f.transport.mockResolvedValueOnce(new Response('x'.repeat(65537)));await expect(a.readGithubAppInstallation('42',new AbortController().signal)).rejects.toThrow('github_installation_verification_unavailable');
 });

 it('signs actual RS256 claims and isolates per-instance cache, expiry and purge',async()=>{const f=fixture(),a=f.create(),b=f.create();expect((await a.resolveGithubInstallationToken(request)).ok).toBe(true);const opts=f.transport.mock.calls[0]?.[1] as RequestInit;const jwt=(opts.headers as Record<string,string>).Authorization.slice(7);const [h,p,s]=jwt.split('.');expect(JSON.parse(Buffer.from(h,'base64url').toString())).toEqual({alg:'RS256',typ:'JWT'});expect(verify('RSA-SHA256',Buffer.from(`${h}.${p}`),keys.publicKey,Buffer.from(s,'base64url'))).toBe(true);expect(JSON.parse(Buffer.from(p,'base64url').toString())).toEqual({iat:f.now()/1000-30,exp:f.now()/1000+540,iss:123});await a.resolveGithubInstallationToken(request);expect(f.transport).toHaveBeenCalledTimes(1);await b.resolveGithubInstallationToken(request);expect(f.transport).toHaveBeenCalledTimes(2);f.advance(56*60000);await a.resolveGithubInstallationToken(request);expect(f.transport).toHaveBeenCalledTimes(3);a.purgeInstallationTokenCache(42);await a.resolveGithubInstallationToken(request);expect(f.transport).toHaveBeenCalledTimes(4);});
 it('refuses mismatched grants and abort without retry or caching',async()=>{const f=fixture(),a=f.create();f.transport.mockResolvedValueOnce(new Response(JSON.stringify({token:'bad',expires_at:new Date(f.now()+3600000).toISOString(),permissions:{contents:'write'},repository_selection:'selected',repositories:[{name:'repo'}]}),{status:201}));expect(await a.resolveGithubInstallationToken(request)).toMatchObject({ok:false,errorCode:'github.app_read_scope_unverified'});const c=new AbortController();c.abort();expect(await a.resolveGithubInstallationToken({...request,signal:c.signal})).toMatchObject({ok:false,errorCode:'github.app_token_cancelled'});expect(f.transport).toHaveBeenCalledTimes(1);});
 it('rejects oversized token strings',async()=>{const f=fixture(),a=f.create();f.transport.mockResolvedValueOnce(new Response(JSON.stringify({token:'x'.repeat(4097),expires_at:new Date(f.now()+3600000).toISOString(),permissions:{contents:'read'},repository_selection:'selected',repositories:[{name:'repo'}]}),{status:201}));expect((await a.resolveGithubInstallationToken(request)).ok).toBe(false);});
 it('safe configuration never decrypts; key decrypt uses legacy context; missing row refuses',async()=>{const decrypt=vi.fn(()=>pem),findUnique=vi.fn(async()=>({appId:123,encryptedPrivateKey:'encrypted',slug:'app',name:'App',htmlUrl:'https://example.invalid',createdAt:new Date(0)}));const cfg=createPrivatePlatformGithubAppConfiguration({repo:{platformGithubAppCredential:{findUnique}} as never,vault:{decryptScopedCredential:decrypt}});expect(await cfg.readSafeConfiguration()).not.toHaveProperty('encryptedPrivateKey');expect(decrypt).not.toHaveBeenCalled();expect(await cfg.resolveGithubAppPrivateKey()).toBe(pem);expect(decrypt).toHaveBeenCalledWith('encrypted','platform_github_app:platform_github_app:privateKey');findUnique.mockResolvedValueOnce(null as never);await expect(cfg.getGithubConfig()).rejects.toThrow('private_github_configuration_unavailable');});
});
