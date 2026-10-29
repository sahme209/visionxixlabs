import {describe,expect,it,vi} from 'vitest';
import {verifyCloudResource} from '../resourceVerification';
const signal=new AbortController().signal;
describe('guided resource verification',()=>{
 it('verifies the exact active Google project using a fixed read-only request',async()=>{
  const read=vi.fn().mockResolvedValue({ok:true,status:200,json:{projectId:'axiom-visionxixlabs',lifecycleState:'ACTIVE',projectNumber:'988261678312'}});
  const result=await verifyCloudResource({provider:'gcp',resourceId:'axiom-visionxixlabs',accessToken:'private-token',signal},{read});
  expect(read).toHaveBeenCalledWith('https://cloudresourcemanager.googleapis.com/v1/projects/axiom-visionxixlabs',expect.objectContaining({method:'GET',headers:{Authorization:'Bearer private-token'}}));
  expect(result).toEqual({provider:'gcp',resourceId:'axiom-visionxixlabs',resourceReadVerified:true});expect(JSON.stringify(result)).not.toContain('private-token');
 });
 it('verifies the exact enabled Azure subscription',async()=>{
  const subscriptionId='12345678-1234-1234-1234-123456789012';const read=vi.fn().mockResolvedValue({ok:true,status:200,json:{subscriptionId,state:'Enabled'}});
  expect(await verifyCloudResource({provider:'azure',resourceId:subscriptionId,accessToken:'token',signal},{read})).toEqual({provider:'azure',resourceId:subscriptionId,resourceReadVerified:true});
  expect(read.mock.calls[0][0]).toBe(`https://management.azure.com/subscriptions/${subscriptionId}?api-version=2022-12-01`);
 });
 it.each([{projectId:'wrong',lifecycleState:'ACTIVE'},{projectId:'axiom-visionxixlabs',lifecycleState:'DELETE_REQUESTED'},{},null])('rejects invalid project evidence %j',async(json)=>{
  await expect(verifyCloudResource({provider:'gcp',resourceId:'axiom-visionxixlabs',accessToken:'token',signal},{read:vi.fn().mockResolvedValue({ok:true,status:200,json})})).rejects.toThrow('cloud_resource_unverified');
 });
 it('does not retry denied reads',async()=>{const read=vi.fn().mockResolvedValue({ok:false,status:403,json:{error:'denied'}});await expect(verifyCloudResource({provider:'gcp',resourceId:'axiom-visionxixlabs',accessToken:'token',signal},{read})).rejects.toThrow('cloud_resource_denied');expect(read).toHaveBeenCalledTimes(1)});
 it.each(['https://evil.example','abc/../../other','short'])('refuses malformed resource IDs before network %s',async(resourceId)=>{const read=vi.fn();await expect(verifyCloudResource({provider:'azure',resourceId,accessToken:'token',signal},{read})).rejects.toThrow();expect(read).not.toHaveBeenCalled()});
 it('rejects header injection before network',async()=>{const read=vi.fn();await expect(verifyCloudResource({provider:'gcp',resourceId:'axiom-visionxixlabs',accessToken:'token\r\nX: y',signal},{read})).rejects.toThrow();expect(read).not.toHaveBeenCalled()});
 it('rejects cancellation before and after an awaited provider request',async()=>{const c=new AbortController();const read=vi.fn().mockImplementation(async()=>{c.abort();return{ok:true,status:200,json:{projectId:'axiom-visionxixlabs',lifecycleState:'ACTIVE'}}});await expect(verifyCloudResource({provider:'gcp',resourceId:'axiom-visionxixlabs',accessToken:'token',signal:c.signal},{read})).rejects.toThrow();await expect(verifyCloudResource({provider:'gcp',resourceId:'axiom-visionxixlabs',accessToken:'token',signal:c.signal},{read})).rejects.toThrow();expect(read).toHaveBeenCalledTimes(1)});
});
