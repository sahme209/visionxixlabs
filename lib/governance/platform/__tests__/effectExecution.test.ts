import {it,expect,vi} from 'vitest';
import {bindPlatformExecution,runPlatformEffect} from '../effectExecution';
const effect={id:'deployment',kind:'settings.vercel' as const,target:{projectId:'project',settingsDigest:'a'.repeat(64)}};
function fixture(){const proof=Object.freeze({});const service={claimNextEffect:vi.fn(async()=>({effect,proof})),beforeEffectSend:vi.fn(async()=>{}),observeEffect:vi.fn(async()=>{})};return {service,binding:bindPlatformExecution(service,'platform_action_'+'a'.repeat(36)),proof}}
it('rejects client-shaped bindings before preparation or a send',async()=>{
 const prepare=vi.fn();await expect(runPlatformEffect({},effect,prepare)).rejects.toThrow();expect(prepare).not.toHaveBeenCalled();
});
it('matches exact approved effect before preparation and final-authorizes exactly once',async()=>{
 const f=fixture(),send=vi.fn(async()=>({outcome:'confirmed' as const,value:'safe-result'}));
 const result=await runPlatformEffect(f.binding,effect,async beforeSend=>{expect(f.service.claimNextEffect).toHaveBeenCalledTimes(1);await beforeSend();return send()});
 expect(result).toBe('safe-result');expect(send).toHaveBeenCalledTimes(1);expect(f.service.beforeEffectSend).toHaveBeenCalledWith(f.proof,effect);expect(f.service.observeEffect).toHaveBeenCalledWith(f.proof,'confirmed');
});
it('refuses changed payload before credential or transport preparation',async()=>{
 const f=fixture(),prepare=vi.fn();await expect(runPlatformEffect(f.binding,{...effect,target:{...effect.target,projectId:'different'}},prepare)).rejects.toThrow();expect(prepare).not.toHaveBeenCalled();expect(f.service.observeEffect).toHaveBeenCalledWith(f.proof,'refused');
});
it('retains uncertainty and never retries after a thrown or unconfirmed effect',async()=>{
 const f=fixture(),send=vi.fn(async()=>{throw Error('SECRET_PROVIDER_ERROR')});
 await expect(runPlatformEffect(f.binding,effect,async before=>{await before();return send()})).rejects.toThrow('platform_governance_effect_unavailable');
 expect(send).toHaveBeenCalledTimes(1);expect(f.service.observeEffect).toHaveBeenCalledTimes(1);expect(f.service.observeEffect).toHaveBeenCalledWith(f.proof,'unknown');
});
it('does not confirm a result without final authorization or accept a second send',async()=>{
 for(const duplicate of [false,true]){
  const f=fixture();await expect(runPlatformEffect(f.binding,effect,async before=>{if(duplicate){await before();await before()}return {outcome:'confirmed',value:'bad'}})).rejects.toThrow();
  expect(f.service.observeEffect).toHaveBeenCalledWith(f.proof,'unknown');expect(f.service.beforeEffectSend.mock.calls.length).toBeLessThanOrEqual(1);
 }
});
it('does not retry an uncertain observation commit or let it look successful',async()=>{
 const f=fixture();f.service.observeEffect.mockRejectedValue(Error('commit_unknown'));
 await expect(runPlatformEffect(f.binding,effect,async before=>{await before();return {outcome:'confirmed',value:'not-returned'}})).rejects.toThrow('platform_governance_outcome_unconfirmed');
 expect(f.service.observeEffect).toHaveBeenCalledTimes(1);
});
it('rejects concurrent use of the same binding before another claim',async()=>{
 const f=fixture();let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>{release=r}),started=new Promise<void>(r=>{entered=r});
 const first=runPlatformEffect(f.binding,effect,async before=>{await before();entered();await waiting;return {outcome:'confirmed',value:1}});await started;
 await expect(runPlatformEffect(f.binding,effect,async()=>({outcome:'confirmed',value:2}))).rejects.toThrow();release();expect(await first).toBe(1);expect(f.service.claimNextEffect).toHaveBeenCalledTimes(1);
});
