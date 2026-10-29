import {beforeEach,it,expect,vi} from 'vitest';
import {generateKeyPairSync} from 'node:crypto';
const cfg=vi.hoisted(()=>({get:vi.fn(),key:vi.fn()}));
vi.mock('../githubConfig',()=>({getGithubConfig:cfg.get,resolveGithubAppPrivateKey:cfg.key}));
import {resolveReleaseInstallationToken,type ReleaseTokenPurpose} from '../githubAppAuth';
const privateKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'pem',type:'pkcs8'}).toString();
let response:any,requests:any[];
beforeEach(()=>{cfg.get.mockReset().mockResolvedValue({appConfigured:true,appId:7});cfg.key.mockReset().mockResolvedValue(privateKey);requests=[];response=null});
function deps(purpose:ReleaseTokenPurpose='workflow_read'){
 return{installationId:'123',repositoryFullName:'owner/fixture',purpose,isEnabled:()=>true,assertCurrent:vi.fn(async()=>{}),fetch:vi.fn(async(url:string,init:RequestInit)=>{
  const body=JSON.parse(init.body as string);requests.push({url,body});
  expect(init.redirect).toBe('error');expect(init.credentials).toBe('omit');
  return Response.json(response??{token:'ephemeral-fixture-token',expires_at:new Date(Date.now()+3600000).toISOString(),permissions:body.permissions,repository_selection:'selected',repositories:[{name:'fixture',full_name:'owner/fixture',owner:{login:'owner'}}]},{status:201});
 }) as unknown as typeof fetch};
}
it.each(['merge','dispatch','workflow_read','source_policy_read','merge_policy_read'] as const)('mints only explicit one-repository %s profile, never returning app JWT',async purpose=>{
 const result=await resolveReleaseInstallationToken(deps(purpose),new AbortController().signal);expect(result?.token).toBe('ephemeral-fixture-token');expect(result).not.toHaveProperty('jwt');expect(requests).toHaveLength(1);expect(requests[0].url).toBe('https://api.github.com/app/installations/123/access_tokens');expect(requests[0].body.repositories).toEqual(['fixture']);
 const expected={merge:{contents:'write',pull_requests:'read',metadata:'read'},dispatch:{actions:'write',contents:'read',metadata:'read'},workflow_read:{actions:'read',contents:'read',metadata:'read'},source_policy_read:{administration:'read',contents:'read',metadata:'read'},merge_policy_read:{administration:'read',contents:'read',pull_requests:'read',metadata:'read'}};
 expect(requests[0].body.permissions).toEqual(expected[purpose]);
});
it('refuses missing activation before reading server credentials',async()=>{const d=deps();d.isEnabled=()=>false;expect(await resolveReleaseInstallationToken(d,new AbortController().signal)).toBeNull();expect(cfg.key).not.toHaveBeenCalled()});
it('does not inherit ambient installation or repository scope',async()=>{const d=deps();d.installationId='';expect(await resolveReleaseInstallationToken(d,new AbortController().signal)).toBeNull();expect(cfg.get).not.toHaveBeenCalled()});
it('refuses identity changes immediately before mint',async()=>{const d=deps();d.assertCurrent=vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('replaced'));expect(await resolveReleaseInstallationToken(d,new AbortController().signal)).toBeNull();expect(d.fetch).not.toHaveBeenCalled()});
it('refuses a response after authority revocation',async()=>{const d=deps();d.assertCurrent=vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('revoked'));expect(await resolveReleaseInstallationToken(d,new AbortController().signal)).toBeNull()});
it.each(['extra_permission','all_repositories','wrong_repository','wrong_owner','expired'])('refuses broadened or stale token response %s',async mode=>{
 response={token:'fixture',expires_at:new Date(Date.now()+3600000).toISOString(),permissions:{actions:'read',contents:'read',metadata:'read'},repository_selection:'selected',repositories:[{name:'fixture',full_name:'owner/fixture',owner:{login:'owner'}}]};
 if(mode==='extra_permission')response.permissions.administration='write';
 if(mode==='all_repositories')response.repository_selection='all';
 if(mode==='wrong_repository')response.repositories[0].full_name='owner/other';
 if(mode==='wrong_owner')response.repositories[0].owner.login='different';
 if(mode==='expired')response.expires_at=new Date(Date.now()-1000).toISOString();
 expect(await resolveReleaseInstallationToken(deps(),new AbortController().signal)).toBeNull();
});
it('does not silently fall back after provider refusal',async()=>{const d=deps();d.fetch=vi.fn(async()=>Response.json({}, {status:403})) as unknown as typeof fetch;expect(await resolveReleaseInstallationToken(d,new AbortController().signal)).toBeNull();expect(d.fetch).toHaveBeenCalledOnce()});
it('refuses an already-aborted request',async()=>{const d=deps(),c=new AbortController();c.abort();expect(await resolveReleaseInstallationToken(d,c.signal)).toBeNull();expect(d.fetch).not.toHaveBeenCalled()});
