import {expect,it,vi} from 'vitest';
import {createImageExecutionStore} from '../imageExecutionStore';
it('missing real execution resources cannot claim, read a key, credential or provider',async()=>{
 const transaction=vi.fn(async()=>{throw Error('unexpected database access')});
 const store=createImageExecutionStore({transaction},{assertCurrent:async()=>{}});
 await expect(store.initialize('platform_action_11111111-1111-4111-8111-111111111111',1,{userId:'requester',sessionId:'session'})).rejects.toThrow('platform_image_execution_unavailable');
 await expect(store.put('platform_action_11111111-1111-4111-8111-111111111111',2,{userId:'requester',sessionId:'session'})).rejects.toThrow('platform_image_execution_unavailable');
 expect(transaction).not.toHaveBeenCalled();
});
