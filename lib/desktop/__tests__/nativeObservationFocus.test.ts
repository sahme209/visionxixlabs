import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({listen:vi.fn(),blur:vi.fn(),invoke:vi.fn(),remove:vi.fn()}));
vi.mock('../../../desktop/node_modules/@tauri-apps/api/window.js',()=>({getCurrentWindow:()=>({label:'main',listen:m.listen,onFocusChanged:m.blur})}));
vi.mock('@tauri-apps/api/core',()=>({invoke:m.invoke}));
import {subscribeNativeObservationFocus} from '../../../desktop/src/lib/nativeObservationFocus';
beforeEach(()=>{vi.clearAllMocks();m.listen.mockResolvedValue(m.remove);m.invoke.mockResolvedValue(undefined)});
it('uses trusted application activation, so an owned modal window blur cannot cancel preparation',async()=>{
 const change=vi.fn();await subscribeNativeObservationFocus(change);
 expect(m.blur).not.toHaveBeenCalled();expect(m.listen).toHaveBeenCalledWith('native-observation-application-focus',expect.any(Function));
 const event=m.listen.mock.calls[0][1];event({payload:{sequence:1,active:true}});event({payload:{sequence:2,active:false}});
 expect(change.mock.calls).toEqual([[true],[false]]);
});
it('registers before native initial state, rejects stale and malformed focus messages and unsubscribes',async()=>{
 const change=vi.fn();const stop=await subscribeNativeObservationFocus(change);
 expect(m.listen.mock.invocationCallOrder[0]).toBeLessThan(m.invoke.mock.invocationCallOrder[0]);
 const event=m.listen.mock.calls[0][1];event({payload:{sequence:3,active:false}});event({payload:{sequence:2,active:true}});
 expect(change.mock.calls).toEqual([[false]]);event({payload:{sequence:4,active:'true'}});expect(change).toHaveBeenLastCalledWith(false);
 stop();event({payload:{sequence:5,active:true}});expect(change).toHaveBeenLastCalledWith(false);expect(m.remove).toHaveBeenCalledOnce();
});
it('cleans up and fails closed if the native activation monitor is unavailable',async()=>{
 m.invoke.mockRejectedValueOnce(Error('unavailable'));await expect(subscribeNativeObservationFocus(vi.fn())).rejects.toThrow('unavailable');expect(m.remove).toHaveBeenCalledOnce();
});
it('does not restart input checks when both panels request the same active initial state',async()=>{
 const change=vi.fn();await subscribeNativeObservationFocus(change);const event=m.listen.mock.calls[0][1];
 event({payload:{sequence:1,active:true}});event({payload:{sequence:2,active:true}});
 expect(change.mock.calls).toEqual([[true]]);
 event({payload:{sequence:3,active:false}});event({payload:{sequence:4,active:true}});
 expect(change.mock.calls).toEqual([[true],[false],[true]]);
});
