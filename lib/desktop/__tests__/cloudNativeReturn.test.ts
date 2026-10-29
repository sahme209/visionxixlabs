import {describe,expect,it,vi} from 'vitest';
import {CLOUD_NATIVE_RETURN,scheduleCloudNativeReturn} from '../cloudNativeReturn';
describe('fixed native cloud return',()=>{
 it('schedules only the registered app scheme without any callback data',()=>{const navigate=vi.fn(),schedule=vi.fn((fn:()=>void,delay:number)=>{expect(delay).toBe(350);fn();return 123});expect(scheduleCloudNativeReturn(navigate,schedule)).toBe(123);expect(navigate).toHaveBeenCalledExactlyOnceWith('axiom-agent://cloud/complete');expect(CLOUD_NATIVE_RETURN).not.toContain('?')});
});
