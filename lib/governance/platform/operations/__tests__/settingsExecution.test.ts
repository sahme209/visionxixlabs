import {it,expect,vi} from 'vitest';
import {createSettingsExecutor} from '../settingsExecution';
it('does not read source, custody or transport without a claimed exact parent',async()=>{
 const unused=vi.fn(async():Promise<never>=>{throw Error('synthetic unavailable')});
 const repo={transaction:unused},authority={assertCurrent:vi.fn()},source={readManifest:vi.fn(),assertCurrent:vi.fn(),readKey:vi.fn(),assertWriteProfile:vi.fn()},transport={send:vi.fn()};
 const executor=createSettingsExecutor(repo,authority,source,transport);await expect(executor.executeNext('platform_action_11111111-1111-4111-8111-111111111111',{userId:'u',sessionId:'s'},0)).rejects.toThrow();expect(transport.send).not.toHaveBeenCalled();expect(unused).not.toHaveBeenCalled();
});
