import {describe,expect,it,vi} from 'vitest';
import {readGcpGuidedSummary} from '../summary';
const row={id:'account',organizationId:'org',externalAccountId:'axiom-visionxixlabs',credentialRef:'cloud-v2:account',enabled:false,autopilotMode:'observe_only',credential:{organizationId:'org',version:1,revokedAt:null,validatedAt:new Date('2026-10-26T12:00:00Z'),encryptedConfiguration:'encrypted'}};
const open=()=>JSON.stringify({kind:'gcp_guided_oauth_v1',projectId:'axiom-visionxixlabs',refreshToken:'private-refresh'});
describe('shared GCP canonical read-only status',()=>{
 it('reports shared read-only status from bound canonical storage without returning credentials',async()=>{const repo={cloudAccount:{findMany:vi.fn().mockResolvedValue([row])}};expect(await readGcpGuidedSummary(repo,'org',open)).toEqual({provider:'gcp',status:'read_only_connected',lastTransitionAt:'2026-10-26T12:00:00.000Z'});expect(repo.cloudAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:'org',provider:'gcp',enabled:false,autopilotMode:'observe_only'}}))});
 it('clears disconnected credentials and never trusts a legacy setup record',async()=>expect(await readGcpGuidedSummary({cloudAccount:{findMany:vi.fn().mockResolvedValue([{...row,credential:{...row.credential,revokedAt:new Date()}}])}},'org',open)).toMatchObject({status:'not_connected'}));
 it('fails closed on mismatched tenant or credential vault context',async()=>{expect(await readGcpGuidedSummary({cloudAccount:{findMany:vi.fn().mockResolvedValue([{...row,organizationId:'other'}])}},'org',open)).toMatchObject({status:'unavailable'});expect(await readGcpGuidedSummary({cloudAccount:{findMany:vi.fn().mockResolvedValue([row])}},'org',()=>{throw new Error('vault')})).toMatchObject({status:'unavailable'})});
});
