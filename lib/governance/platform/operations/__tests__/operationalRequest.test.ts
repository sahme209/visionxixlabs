import {it,expect,vi} from 'vitest';
import {createOperationalDelegationRequestComposition} from '../operationalRequest';
it('rejects invalid signed-session possession before SQL, workload or provider-source access',async()=>{
 const repo={transaction:vi.fn()},source={readManifest:vi.fn(),assertCurrent:vi.fn()},identity={authenticate:vi.fn(),consume:vi.fn(),assertConsumedCurrent:vi.fn()};await expect(createOperationalDelegationRequestComposition({headers:new Headers({authorization:'Bearer invalid'})},{repo,source,identity,verifyDesktopToken:()=>{throw Error('PRIVATE')},readAdminEmails:()=>['admin@example.test']})).rejects.toThrow('operational_request_unavailable');expect(repo.transaction).not.toHaveBeenCalled();expect(source.readManifest).not.toHaveBeenCalled();expect(identity.authenticate).not.toHaveBeenCalled();
});
