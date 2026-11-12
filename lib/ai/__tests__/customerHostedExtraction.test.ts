import {it,expect,vi,afterEach,beforeEach} from 'vitest';
import {createCustomerHostedExtraction} from '../customerHostedExtraction';
import {parseCustomerHostedOperatorConfig} from '../customerHostedConfig';
import {CustomerHostedResponseError} from '../customerHostedProtocol';
beforeEach(()=>{vi.stubEnv('AXIOM_OFFLINE_MODE','true')});
afterEach(()=>{vi.unstubAllEnvs()});
function fixture(){
 const config=parseCustomerHostedOperatorConfig(JSON.stringify({format:'axiom.customer-hosted/1',installationId:'install',revision:'r1',server:{kind:'vllm',baseUrl:'https://models.private.test/v1',allowedHosts:['models.private.test']},models:[{id:'local',maxInputTokens:100,maxOutputTokens:20,maxInputBytes:8192}],budgets:[{organizationId:'org',windowId:'w',startsAt:'2026-11-11T00:00:00.000Z',expiresAt:'2026-11-12T00:00:00.000Z',limitTokens:10000}]}))!;
 const snapshot={config,modelId:'local',policyDigest:'a'.repeat(64),reservedTokens:120,windowId:'w'};
 const deps={readCurrent:vi.fn(async()=>snapshot),assertActor:vi.fn(async()=>{}),store:{reserveCustomerHostedCall:vi.fn(async()=> 'reservation'),claimCustomerHostedCall:vi.fn(async()=>Object.freeze({})),settleCustomerHostedCall:vi.fn(async()=>({status:'settled' as const,liabilityTokens:10}))},send:vi.fn(async(input:any)=>{await input.beforeSend();return {data:{ok:true},raw:'{"ok":true}',promptTokens:5,completionTokens:5,totalTokens:10}}),audit:vi.fn(async()=>{})};
 return {snapshot,deps,extract:createCustomerHostedExtraction({organizationId:'org',actorId:'actor'},deps)};
}
it('composes one exact reservation, fresh authority, dispatch claim and unpriced settlement',async()=>{
 const f=fixture(),result=await f.extract('input','{"ok":"boolean"}','request-1');
 expect(result).toMatchObject({data:{ok:true},usage:{promptTokens:5,completionTokens:5,totalTokens:10}});
 expect(f.deps.store.reserveCustomerHostedCall).toHaveBeenCalledOnce();expect(f.deps.store.claimCustomerHostedCall).toHaveBeenCalledOnce();expect(f.deps.send).toHaveBeenCalledOnce();
 expect(f.deps.store.settleCustomerHostedCall).toHaveBeenCalledWith(expect.any(Object),10,true);
 expect(f.deps.audit).toHaveBeenLastCalledWith(expect.objectContaining({settlement:'customer_hosted_unpriced',outcome:'confirmed',modelId:'local'}));
});
it('refuses revoked policy after reservation without dispatching a claim',async()=>{
 const f=fixture();f.deps.readCurrent.mockResolvedValueOnce(f.snapshot).mockRejectedValue(Error('policy revoked'));
 await expect(f.extract('input','shape','request-1')).rejects.toThrow();expect(f.deps.store.claimCustomerHostedCall).not.toHaveBeenCalled();
});
it('refuses caller revocation after an awaited claim without sending',async()=>{
 const f=fixture();let sent=false;f.deps.send.mockImplementation(async(input:any)=>{await input.beforeSend();sent=true;return {data:{ok:true},raw:'{}',promptTokens:1,completionTokens:1,totalTokens:2}});
 f.deps.store.claimCustomerHostedCall.mockImplementation(async()=>{f.deps.assertActor.mockRejectedValue(Error('revoked'));return {}});
 await expect(f.extract('input','shape','request-1')).rejects.toThrow();expect(sent).toBe(false);
 expect(f.deps.store.settleCustomerHostedCall).toHaveBeenCalledWith(expect.any(Object),null,false);
});
it('preserves reported larger liability on protocol refusal and does not resend',async()=>{
 const f=fixture();f.deps.send.mockImplementation(async(input:any)=>{await input.beforeSend();throw new CustomerHostedResponseError({promptTokens:100,completionTokens:50,totalTokens:150})});
 await expect(f.extract('input','shape','request-1')).rejects.toThrow();expect(f.deps.send).toHaveBeenCalledOnce();expect(f.deps.store.settleCustomerHostedCall).toHaveBeenCalledWith(expect.any(Object),150,false);
});
it('redacts schema and input before hashing and transmitting; audit contains neither',async()=>{
 const f=fixture();await f.extract('password=supersecretvalue','token=supersecretvalue','request-1');
 expect(f.deps.send.mock.calls[0][0].prompt).not.toContain('supersecretvalue');
 expect(JSON.stringify(f.deps.audit.mock.calls)).not.toContain('supersecretvalue');
});
it('does not reserve or read private authority in the isolated provider-disabled lane',async()=>{
 vi.stubEnv('AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME','1');const f=fixture();
 await expect(f.extract('input','shape','request-1')).rejects.toThrow();expect(f.deps.readCurrent).not.toHaveBeenCalled();expect(f.deps.store.reserveCustomerHostedCall).not.toHaveBeenCalled();expect(f.deps.send).not.toHaveBeenCalled();
});
