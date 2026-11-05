/** @vitest-environment node */
import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const fixture=vi.hoisted(()=>({tenant:'tenant-A',authenticated:true,mode:'live',createClient:vi.fn(),get:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:async()=>({isAuthenticated:fixture.authenticated,userId:'synthetic-user',organizationId:fixture.tenant,roles:[]})}));
vi.mock('@/lib/config/env',()=>({loadAppEnv:()=>({githubDefaultOrg:'synthetic-server-global-org'})}));
vi.mock('@/lib/config/features',()=>({serverFeatures:()=>({}),toClientFlags:(flags:unknown)=>flags}));
vi.mock('@/lib/config/providerModes',()=>({getConnectorMode:()=> fixture.mode,getCloudProviderMode:()=> 'preview'}));
// The scanner stays real; only its external client/provider boundary is fake.
vi.mock('@/lib/connectors/github/githubLiveClient',()=>({getGithubMode:()=> fixture.mode,createGithubClient:fixture.createClient}));
// Unrelated deterministic platform signals do not participate in this defect.
vi.mock('@/lib/validation/autonomousValidationLoop',()=>({runAutonomousValidationLoop:async()=>({probes:[]})}));
vi.mock('@/lib/agent/autonomousPlanningLoop',()=>({runAutonomousPlanningLoop:async()=>({candidates:[]})}));
import {GET,POST} from '../route';
import {GET as syncGet,POST as syncPost} from '@/app/api/github/sync/route';
import {GET as stateGet,POST as statePost} from '@/app/api/releaseops/state/route';
import {POST as scanPost} from '@/app/api/releaseops/scan/route';
import {runLiveGithubSync} from '@/lib/connectors/github/githubLiveScanner';
import {getReleaseOpsState} from '@/lib/releaseops/getReleaseOpsState';
vi.mock('@/lib/audit/secureAudit',()=>({record:fixture.audit}));
const secretRepo='SYNTHETIC_SERVER_PRIVATE_REPOSITORY';
beforeEach(()=>{
 vi.clearAllMocks();fixture.tenant='tenant-A';fixture.authenticated=true;fixture.mode='live';fixture.audit.mockResolvedValue(undefined);
 fixture.createClient.mockReturnValue({available:true,get:fixture.get});
 fixture.get.mockImplementation(async(path:string)=>{
  const success=(data:unknown)=>({ok:true,status:200,data,rateLimit:{}});
  if(path==='/user')return success({login:'synthetic-server-account'});
  if(path==='/orgs/synthetic-server-global-org/repos?per_page=30&type=all&sort=pushed')return success([{id:123,name:secretRepo,full_name:'synthetic-server-global-org/'+secretRepo,default_branch:'main',private:true,pushed_at:'2026-11-01T00:00:00Z'}]);
  const prefix='/repos/synthetic-server-global-org/'+secretRepo;
  if(path===prefix+'/actions/workflows?per_page=10')return success({workflows:[]});
  if(path===prefix+'/branches/main/protection')return {ok:false,status:404,errorKind:'not_found',rateLimit:{}};
  if(path===prefix+'/environments')return success({environments:[]});
  throw new Error('Unexpected synthetic provider path: '+path);
 });
});

const boundaryCode='github.tenant_source_required';
function request(organization?:string){return new NextRequest('https://local.invalid/legacy-source',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(organization?{organization}:{})});}
const routes=[
 ['graph GET',()=>GET()],['graph POST',()=>POST()],
 ['sync GET',()=>syncGet(request())],['sync POST',()=>syncPost(request('arbitrary-unowned-org'))],
 ['state GET',()=>stateGet()],['state POST',()=>statePost()],
 ['scan POST',()=>scanPost(request('arbitrary-unowned-org'))],
] as const;
it.each(routes)('%s refuses unbound legacy live source for both tenants before client construction',async(_label,handler)=>{
 for(const tenant of ['tenant-A','tenant-B']){
  fixture.tenant=tenant;const response=await handler();const body=await response.json();
  expect(response.status).toBe(412);expect(body).toMatchObject({ok:false,error:{code:boundaryCode,category:'precondition'}});
  expect(JSON.stringify(body)).not.toContain(secretRepo);
 }
 expect(fixture.createClient).not.toHaveBeenCalled();expect(fixture.get).not.toHaveBeenCalled();
});
it.each(['synthetic-server-global-org','arbitrary-unowned-org',undefined])('direct scanner refuses live input %j before client construction',async organization=>{
 await expect(runLiveGithubSync(organization===undefined?{} as never:{organization})).rejects.toMatchObject({code:boundaryCode,category:'precondition'});
 expect(fixture.createClient).not.toHaveBeenCalled();expect(fixture.get).not.toHaveBeenCalled();
});
it('explicit forcePreview stays labeled preview without legacy client construction',async()=>{
 const state=await getReleaseOpsState({forcePreview:true});expect(state.source).toBe('preview');
 expect(fixture.createClient).not.toHaveBeenCalled();expect(fixture.get).not.toHaveBeenCalled();
});
it('preview mode retains explicit synthetic preview and sync source labels',async()=>{
 fixture.mode='preview';const state=await getReleaseOpsState();expect(state.mode).toBe('preview');expect(state.source).toBe('preview');
 const response=await syncPost(request());expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true,data:{mode:'preview',source:'preview'}});
 expect(fixture.createClient).not.toHaveBeenCalled();expect(fixture.get).not.toHaveBeenCalled();
});
it('disabled mode retains disabled aggregator and no-call direct scanner behavior',async()=>{
 fixture.mode='disabled';const state=await getReleaseOpsState();expect(state.mode).toBe('disabled');expect(state.source).toBe('disabled');
 const direct=await runLiveGithubSync({organization:'unowned'});expect(direct.repos).toEqual([]);
 expect(fixture.createClient).not.toHaveBeenCalled();expect(fixture.get).not.toHaveBeenCalled();
});
it.each(routes)('%s preserves unauthenticated refusal before client construction',async(_label,handler)=>{
 fixture.authenticated=false;const response=await handler();expect(response.status).not.toBe(200);expect(await response.json()).toMatchObject({ok:false,error:{code:'auth.required'}});
 expect(fixture.createClient).not.toHaveBeenCalled();expect(fixture.get).not.toHaveBeenCalled();expect(fixture.audit).not.toHaveBeenCalled();
});
