import {describe,expect,it} from 'vitest';
import {planForStripeTier} from '../planRegistry';
describe('public policy cannot be reinterpreted as a legacy flat pool',()=>{
 it.each(['public_free_v1','public_pro_v1','public_enterprise_v1'])('rejects %s without authoritative contract resolution',tier=>{expect(()=>planForStripeTier(tier)).toThrow('public_plan_requires_contract');});
 it('retains legacy Growth unchanged',()=>{expect(planForStripeTier('growth').entitlements.includedAICreditsCents).toBe(20000);});
});
