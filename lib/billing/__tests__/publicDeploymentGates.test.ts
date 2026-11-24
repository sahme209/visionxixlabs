import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({snapshot:vi.fn(),count:vi.fn(),create:vi.fn()}));
vi.mock('../publicBillingEntitlements',()=>({readPublicEntitlementSnapshot:m.snapshot}));
vi.mock('../publicCreditAuthority',()=>({publicDatabaseNow:async()=>new Date('2026-10-22T12:00:00Z')}));
import {checkDeploymentQuota} from '../deploymentQuota';
import {reserveDeploymentDispatch} from '../deploymentDispatchReservation';
function fixture(){const tx={$queryRawUnsafe:async()=>[],tenantBillingPlan:{findUnique:async()=>({tier:'public_pro_v1',status:'active'})},deploymentExecution:{findUnique:async()=>null,count:m.count,create:m.create,deleteMany:async()=>({count:0})}};return {...tx,$transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn(tx)};}
const input={organizationId:'org',idempotencyKey:'deploy-key',environmentId:'dev',repositoryFullName:'fixture/repo',sourceRef:'main',sourceKind:'branch' as const,sourceCommitSha:'a'.repeat(40),branchPolicyId:null,promotedFromExecutionId:null,pullRequestUrl:null,source:'desktop' as const,triggeredByUserId:'owner'};
describe('public workspace deployment entitlement',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID','acct_fixture');vi.stubEnv('AXIOM_STRIPE_MODE','test');m.snapshot.mockResolvedValue({usable:true,planId:'pro',monthlyDeployments:100});m.count.mockResolvedValue(12);m.create.mockResolvedValue({...input,id:'deploy',status:'reserved'});});afterEach(()=>vi.unstubAllEnvs());
 it('reports activity above the former limit for an active workspace',async()=>{expect(await checkDeploymentQuota(fixture() as never,'org')).toMatchObject({allowed:true,planId:'pro',used:12,limit:null,remaining:null});});
 it('denies an expired paid contract even if the projection remains active',async()=>{m.snapshot.mockResolvedValue({usable:false,planId:'pro',monthlyDeployments:0});expect(await checkDeploymentQuota(fixture() as never,'org')).toMatchObject({allowed:false,reason:'deployment_quota_unavailable'});expect(await reserveDeploymentDispatch(fixture() as never,input)).toMatchObject({ok:false,error:'deployment_quota_unavailable'});expect(m.create).not.toHaveBeenCalled();});
 it('reserves a new dispatch above the former cap without checking usage',async()=>{expect(await reserveDeploymentDispatch(fixture() as never,input)).toMatchObject({ok:true,planId:'pro',limit:null});expect(m.count).not.toHaveBeenCalled();expect(m.create).toHaveBeenCalledOnce();});
});
