import {it,expect,vi} from 'vitest';
import {createSettingsPreparationStore} from '../settingsPreparation';
it('rejects malformed selection before source qualification or storage',async()=>{
 const source={assertCurrent:vi.fn(async()=>{})},repo={transaction:vi.fn()},authority={assertCurrent:vi.fn(async()=>{})};
 const store=createSettingsPreparationStore(repo,authority,source);await expect(store.prepare({value:'SECRET'},'11111111-1111-4111-8111-111111111111',{userId:'u',sessionId:'s'})).rejects.toThrow();expect(source.assertCurrent).not.toHaveBeenCalled();expect(repo.transaction).not.toHaveBeenCalled();
});
