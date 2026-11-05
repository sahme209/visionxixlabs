/** @vitest-environment node */
import {beforeEach,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({tenant:'tenant-A',createClient:vi.fn(),get:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:async()=>({isAuthenticated:true,userId:'synthetic-user',organizationId:fixture.tenant,roles:[]})}));
vi.mock('@/lib/config/env',()=>({loadAppEnv:()=>({githubDefaultOrg:'synthetic-server-global-org'})}));
vi.mock('@/lib/config/features',()=>({serverFeatures:()=>({}),toClientFlags:(flags:unknown)=>flags}));
vi.mock('@/lib/config/providerModes',()=>({getConnectorMode:()=> 'live',getCloudProviderMode:()=> 'preview'}));
// The scanner stays real; only its external client/provider boundary is fake.
vi.mock('@/lib/connectors/github/githubLiveClient',()=>({getGithubMode:()=> 'live',createGithubClient:fixture.createClient}));
// Unrelated deterministic platform signals do not participate in this defect.
vi.mock('@/lib/validation/autonomousValidationLoop',()=>({runAutonomousValidationLoop:async()=>({probes:[]})}));
vi.mock('@/lib/agent/autonomousPlanningLoop',()=>({runAutonomousPlanningLoop:async()=>({candidates:[]})}));
import {GET,POST} from '../route';
const secretRepo='SYNTHETIC_SERVER_PRIVATE_REPOSITORY';
beforeEach(()=>{
 vi.clearAllMocks();fixture.tenant='tenant-A';
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
it.each([['GET',GET],['POST',POST]] as const)('%s must not disclose server-global GitHub diagnostics to unrelated authenticated tenants',async(_method,handler)=>{
 const observations:Array<{tenant:string,status:number,body:string}>=[];
 for(const tenant of ['tenant-A','tenant-B']){
  fixture.tenant=tenant;const response=await handler();const body=await response.json();
  observations.push({tenant,status:response.status,body:JSON.stringify(body)});
 }
 // Current request must not use the server-global collector merely because
 // the caller is authenticated. This remains intentionally RED until reviewed repair.
 expect(observations.filter(row=>row.body.includes(secretRepo)).map(row=>row.tenant)).toEqual([]);
 expect(fixture.createClient).not.toHaveBeenCalled();
 expect(fixture.get).not.toHaveBeenCalled();
});
